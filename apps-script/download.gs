// ============================================================================
// DOWNLOAD.GS - Download & Parse Excel Report
// ============================================================================
// Downloads the Excel report from PetPooja and extracts data

// Fetch the report page and extract data
function downloadAndParseReport(startDate, endDate) {
  try {
    Logger.log(`Fetching report for date range: ${startDate} to ${endDate}`);

    // Build form data for report generation
    const formData = {
      'start_date': startDate,
      'end_date': endDate,
      'order_status': 'Success',
      'outlet': ''  // All outlets
    };

    // Prepare request options
    const options = {
      method: 'post',
      headers: getAuthenticatedHeaders(),
      payload: formData,
      followRedirects: true,
      muteHttpExceptions: true
    };

    // Fetch the report page
    const response = UrlFetchApp.fetch(CONFIG.PETPOOJA_REPORT_URL, options);
    const responseCode = response.getResponseCode();

    if (responseCode !== 200) {
      throw new Error(`Report fetch failed with status ${responseCode}`);
    }

    const htmlContent = response.getContentText();
    Logger.log('Report page fetched successfully');

    // Parse the HTML to extract table data
    const reportData = parseReportTable(htmlContent);

    if (!reportData || reportData.length === 0) {
      Logger.log('No data found in report');
      return [];
    }

    Logger.log(`Parsed ${reportData.length} rows from report`);
    return reportData;

  } catch (e) {
    const errorMsg = 'Report Download Error: ' + e.message;
    Logger.log(errorMsg);
    logToSheet('ERROR', 'Report Download Failed', e.message);
    sendErrorEmail('Report Download Failed', `Could not download report:\n\n${e.message}`);
    throw e;
  }
}

// Parse HTML table from PetPooja report page
function parseReportTable(htmlContent) {
  try {
    // Look for the results table
    const tableMatch = htmlContent.match(/<table[^>]*>[\s\S]*?<\/table>/i);

    if (!tableMatch) {
      Logger.log('No table found in HTML');
      return [];
    }

    const tableHtml = tableMatch[0];
    const rows = [];

    // Extract rows from table
    const rowMatches = tableHtml.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi);

    if (!rowMatches) {
      return [];
    }

    let isHeader = true;

    for (const rowHtml of rowMatches) {
      const cells = [];
      const cellMatches = rowHtml.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi);

      if (cellMatches) {
        for (const cellHtml of cellMatches) {
          // Extract text from cell, removing HTML tags
          let cellText = cellHtml
            .replace(/<[^>]+>/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .trim();

          cells.push(cellText);
        }
      }

      // Skip header row
      if (isHeader && cells.length > 0 && cells[0].toLowerCase().includes('restaurant')) {
        isHeader = false;
        continue;
      }

      // Add data rows (skip empty rows)
      if (!isHeader && cells.length > 0 && cells[0].trim()) {
        rows.push(cells);
      }
    }

    Logger.log(`Extracted ${rows.length} data rows from table`);
    return rows;

  } catch (e) {
    Logger.log('Error parsing report table: ' + e);
    return [];
  }
}

// Fetch report as Excel and convert to array
function downloadReportAsExcel(startDate, endDate) {
  try {
    Logger.log(`Attempting to download Excel report for ${startDate}`);

    // Build URL for Excel export
    const params = new URLSearchParams({
      'start_date': startDate,
      'end_date': endDate,
      'order_status': 'Success',
      'outlet': '',
      'export': 'excel'  // Request Excel format
    });

    const excelUrl = CONFIG.PETPOOJA_REPORT_URL + '?' + params.toString();

    const options = {
      method: 'get',
      headers: getAuthenticatedHeaders(),
      followRedirects: true,
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(excelUrl, options);
    const responseCode = response.getResponseCode();

    if (responseCode !== 200) {
      throw new Error(`Excel download failed with status ${responseCode}`);
    }

    // Get the blob (file content)
    const blob = response.getBlob();
    Logger.log('Excel file downloaded: ' + blob.getName());

    // Convert Excel to array data
    const data = convertExcelToArray(blob);
    return data;

  } catch (e) {
    Logger.log('Excel download error, falling back to HTML parsing: ' + e);
    // Fall back to HTML parsing if Excel export fails
    return downloadAndParseReport(startDate, endDate);
  }
}

// Convert Excel blob to array data
function convertExcelToArray(blob) {
  try {
    // Import as temp sheet
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const tempSheet = ss.insertSheet('_TEMP_IMPORT_');

    // Use Apps Script built-in Sheets import
    const data = Utilities.parseCsv(blob.getDataAsString());

    // Clean up temp sheet
    ss.deleteSheet(tempSheet);

    Logger.log(`Converted Excel to array: ${data.length} rows`);
    return data;

  } catch (e) {
    Logger.log('Error converting Excel to array: ' + e);
    return [];
  }
}

// Main function to get report data with date
function getReportData(reportDate) {
  // For now, use HTML parsing as primary method
  const data = downloadAndParseReport(reportDate, reportDate);

  // Add report date to each row
  if (data && data.length > 0) {
    data.forEach(row => {
      row.unshift(reportDate);  // Add date as first column
    });
  }

  return data;
}
