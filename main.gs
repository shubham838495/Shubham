// ============================================================================
// MAIN.GS - Main Orchestration & Entry Point
// ============================================================================
// Main function called by the daily trigger - orchestrates the full workflow

// Main function - Called by daily trigger at 9 AM
function runDailyReport() {
  const startTime = new Date();
  Logger.log('='.repeat(60));
  Logger.log('PetPooja Daily Report - Execution Started');
  Logger.log('Time: ' + getFormattedTimestamp());
  Logger.log('='.repeat(60));

  try {
    // Step 1: Verify sheet setup
    Logger.log('\n[STEP 1] Verifying sheet setup...');
    if (!verifySheetSetup()) {
      throw new Error('Failed to verify or initialize sheets');
    }

    // Step 2: Authenticate with PetPooja
    Logger.log('\n[STEP 2] Authenticating with PetPooja...');
    authenticateWithPetPooja();
    Logger.log('✓ Authentication successful');

    // Step 3: Get report date (yesterday)
    const reportDate = getYesterdayDate();
    Logger.log(`\n[STEP 3] Fetching report for date: ${reportDate}`);

    // Step 4: Download and parse report
    Logger.log('[STEP 4] Downloading report data...');
    const reportData = getReportData(reportDate);

    if (!reportData || reportData.length === 0) {
      throw new Error('No data returned from report');
    }

    Logger.log(`✓ Downloaded ${reportData.length} rows`);

    // Step 5: Append to Google Sheet
    Logger.log('\n[STEP 5] Appending data to Google Sheet...');
    const rowsAdded = appendReportData(reportData, reportDate);
    Logger.log(`✓ Added ${rowsAdded} rows to sheet`);

    // Success summary
    const endTime = new Date();
    const duration = Math.round((endTime - startTime) / 1000);

    const successMsg = `Completed successfully in ${duration}s. Added ${rowsAdded} rows.`;
    Logger.log('\n' + '='.repeat(60));
    Logger.log('✓ EXECUTION SUCCESSFUL');
    Logger.log(successMsg);
    Logger.log('='.repeat(60));

    logToSheet('SUCCESS', 'Report Completed', `${rowsAdded} rows added for ${reportDate}. Duration: ${duration}s`);

  } catch (error) {
    // Error handling
    const errorMsg = error.message || error.toString();
    Logger.log('\n' + '='.repeat(60));
    Logger.log('✗ EXECUTION FAILED');
    Logger.log('Error: ' + errorMsg);
    Logger.log('='.repeat(60));

    logToSheet('ERROR', 'Execution Failed', errorMsg);

    // Send alert email
    sendErrorEmail(
      'Report Execution Failed',
      `PetPooja daily report failed at ${getFormattedTimestamp()}\n\n` +
      `Error: ${errorMsg}\n\n` +
      `Please check the Logs sheet in your Google Sheet for details.`
    );

    throw error;
  }
}

// Manual test function (can be run from Apps Script editor)
function testReportDownload() {
  Logger.log('Testing report download with current configuration...');

  try {
    // Test credentials exist
    const creds = getCredentials();
    if (!creds.email || !creds.password || !creds.sheetId) {
      Logger.log('ERROR: Missing credentials in Script Properties');
      Logger.log('Please set: PETPOOJA_EMAIL, PETPOOJA_PASSWORD, SHEET_ID');
      return;
    }

    Logger.log('✓ Credentials found');

    // Test authentication
    Logger.log('Testing authentication...');
    authenticateWithPetPooja();
    Logger.log('✓ Authentication successful');

    // Test sheet access
    Logger.log('Testing sheet access...');
    const sheet = getOrCreateSheet(CONFIG.SHEET_REPORT_NAME);
    Logger.log('✓ Sheet accessible: ' + sheet.getName());

    // Test date functions
    Logger.log('Testing date functions...');
    Logger.log('Today: ' + getTodayDate());
    Logger.log('Yesterday: ' + getYesterdayDate());
    Logger.log('✓ Date functions working');

    Logger.log('\n✓ All tests passed! Ready to run daily automation.');

  } catch (e) {
    Logger.log('✗ Test failed: ' + e.message);
  }
}

// Get automation status/statistics
function getAutomationStatus() {
  try {
    const reportCount = getReportRowCount();
    const lastEntry = getLastEntryDate();

    const status = {
      isActive: true,
      rowsCollected: reportCount,
      lastEntryDate: lastEntry,
      sheetUrl: SpreadsheetApp.getActiveSpreadsheet().getUrl(),
      lastExecution: getFormattedTimestamp()
    };

    Logger.log('Automation Status:');
    Logger.log(JSON.stringify(status, null, 2));

    return status;

  } catch (e) {
    Logger.log('Error getting status: ' + e);
    return null;
  }
}

// Disable the automation trigger
function disableAutomation() {
  try {
    const scriptId = ScriptApp.getScriptId();
    const triggers = ScriptApp.getProjectTriggers();

    let disabled = 0;
    for (const trigger of triggers) {
      if (trigger.getHandlerFunction() === 'runDailyReport') {
        ScriptApp.deleteTrigger(trigger);
        disabled++;
      }
    }

    Logger.log(`Disabled ${disabled} trigger(s)`);
    logToSheet('INFO', 'Automation Disabled', 'Report automation has been disabled');

  } catch (e) {
    Logger.log('Error disabling automation: ' + e);
  }
}

// Enable the automation trigger
function enableAutomation() {
  try {
    // First check if trigger already exists
    const triggers = ScriptApp.getProjectTriggers();
    for (const trigger of triggers) {
      if (trigger.getHandlerFunction() === 'runDailyReport') {
        Logger.log('Trigger already exists');
        return;
      }
    }

    // Create new trigger for 9 AM daily
    ScriptApp.newTrigger('runDailyReport')
      .timeBased()
      .atHour(9)
      .everyDays(1)
      .create();

    Logger.log('Automation trigger created for 9 AM daily');
    logToSheet('INFO', 'Automation Enabled', 'Report automation trigger enabled');

  } catch (e) {
    Logger.log('Error enabling automation: ' + e);
  }
}
