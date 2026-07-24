// ============================================================================
// SHEETS.GS - Google Sheets Data Management
// ============================================================================
// Appends data to Google Sheet, handles sheet creation and formatting

// Append report data to the Reports sheet
function appendReportData(reportData, reportDate) {
  try {
    if (!reportData || reportData.length === 0) {
      Logger.log('No data to append');
      logToSheet('WARNING', 'No Data', 'Report query returned no results');
      return 0;
    }

    const sheet = getOrCreateSheet(CONFIG.SHEET_REPORT_NAME);

    // Initialize sheet with headers if new
    initializeSheet(sheet, CONFIG.HEADERS);

    // Check for duplicate date
    if (isDuplicateDate(sheet, reportDate)) {
      const msg = `Report data for ${reportDate} already exists in sheet`;
      Logger.log(msg);
      logToSheet('INFO', 'Duplicate Skipped', msg);
      return 0;
    }

    // Filter and validate data before appending
    const validData = filterValidRows(reportData);

    if (validData.length === 0) {
      Logger.log('No valid rows to append');
      logToSheet('WARNING', 'No Valid Rows', 'Report data was empty or invalid');
      return 0;
    }

    // Append each row to the sheet
    for (const row of validData) {
      sheet.appendRow(row);
    }

    const msg = `Added ${validData.length} rows for ${reportDate}`;
    Logger.log(msg);
    logToSheet('SUCCESS', 'Data Appended', msg);

    // Format the sheet
    formatReportSheet(sheet);

    return validData.length;

  } catch (e) {
    const errorMsg = 'Failed to append data: ' + e.message;
    Logger.log(errorMsg);
    logToSheet('ERROR', 'Append Failed', e.message);
    sendErrorEmail('Data Append Failed', `Could not append report data to sheet:\n\n${e.message}`);
    throw e;
  }
}

// Filter out invalid rows (empty or malformed)
function filterValidRows(data) {
  return data.filter(row => {
    // Row must have at least 2 columns (date + restaurant name)
    if (!row || row.length < 2) {
      return false;
    }

    // First column should be date
    if (!row[0] || !isValidDate(row[0])) {
      return false;
    }

    // At least one data column should have content
    if (row.slice(1).every(cell => !cell || cell.trim() === '')) {
      return false;
    }

    return true;
  });
}

// Check if string is a valid date
function isValidDate(dateStr) {
  // Check YYYY-MM-DD format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  return dateRegex.test(dateStr);
}

// Format the Reports sheet
function formatReportSheet(sheet) {
  try {
    // Make header row bold
    const headerRange = sheet.getRange(1, 1, 1, sheet.getLastColumn());
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#4285F4');
    headerRange.setFontColor('#FFFFFF');

    // Adjust column widths
    sheet.autoResizeColumns(1, sheet.getLastColumn());

  } catch (e) {
    Logger.log('Error formatting sheet: ' + e);
    // Formatting errors shouldn't stop the process
  }
}

// Verify sheet exists and has data
function verifySheetSetup() {
  try {
    const sheet = getOrCreateSheet(CONFIG.SHEET_REPORT_NAME);

    if (sheet.getLastRow() === 0) {
      initializeSheet(sheet, CONFIG.HEADERS);
      Logger.log('Initialized Reports sheet with headers');
    }

    const logsSheet = getOrCreateSheet(CONFIG.SHEET_LOGS_NAME);
    if (logsSheet.getLastRow() === 0) {
      logsSheet.appendRow(['Timestamp', 'Status', 'Message', 'Details']);
      Logger.log('Initialized Logs sheet with headers');
    }

    Logger.log('Sheet setup verified');
    return true;

  } catch (e) {
    Logger.log('Error verifying sheet setup: ' + e);
    return false;
  }
}

// Get count of rows in Reports sheet
function getReportRowCount() {
  try {
    const sheet = getOrCreateSheet(CONFIG.SHEET_REPORT_NAME);
    return Math.max(0, sheet.getLastRow() - 1);  // Subtract 1 for header
  } catch (e) {
    return 0;
  }
}

// Get last data entry date
function getLastEntryDate() {
  try {
    const sheet = getOrCreateSheet(CONFIG.SHEET_REPORT_NAME);
    const lastRow = sheet.getLastRow();

    if (lastRow <= 1) {
      return null;  // No data yet
    }

    const lastDate = sheet.getRange(lastRow, 1).getValue();
    return lastDate;

  } catch (e) {
    Logger.log('Error getting last entry date: ' + e);
    return null;
  }
}
