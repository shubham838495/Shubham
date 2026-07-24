// ============================================================================
// CONFIG.GS - Configuration & Utilities
// ============================================================================
// Stores configuration constants and credential access functions

// Get credentials from secure Script Properties
function getCredentials() {
  const props = PropertiesService.getScriptProperties();
  return {
    email: props.getProperty('PETPOOJA_EMAIL'),
    password: props.getProperty('PETPOOJA_PASSWORD'),
    sheetId: props.getProperty('SHEET_ID'),
    notificationEmail: props.getProperty('NOTIFICATION_EMAIL')
  };
}

// Configuration constants
const CONFIG = {
  PETPOOJA_LOGIN_URL: 'https://billing.petpooja.com/users/login',
  PETPOOJA_REPORT_URL: 'https://billing.petpooja.com/custom_reports/view_report/9',
  SHEET_REPORT_NAME: 'Reports',
  SHEET_LOGS_NAME: 'Logs',
  TIMEZONE: 'Asia/Kolkata',
  HEADERS: ['Report Date', 'Restaurants', 'Invoice Nos.', 'Total', 'Min.']
};

// Utility: Get today's date in YYYY-MM-DD format
function getTodayDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Utility: Get yesterday's date in YYYY-MM-DD format
function getYesterdayDate() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const year = yesterday.getFullYear();
  const month = String(yesterday.getMonth() + 1).padStart(2, '0');
  const day = String(yesterday.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Utility: Format timestamp for logging
function getFormattedTimestamp() {
  const now = new Date();
  return now.toLocaleString('en-IN', { timeZone: CONFIG.TIMEZONE });
}

// Utility: Get or create sheet
function getOrCreateSheet(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  return sheet;
}

// Utility: Initialize sheet with headers
function initializeSheet(sheet, headers) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  }
}

// Utility: Log to Logs sheet
function logToSheet(status, message, details = '') {
  try {
    const logsSheet = getOrCreateSheet(CONFIG.SHEET_LOGS_NAME);

    // Initialize logs sheet with headers if empty
    if (logsSheet.getLastRow() === 0) {
      logsSheet.appendRow(['Timestamp', 'Status', 'Message', 'Details']);
    }

    const timestamp = getFormattedTimestamp();
    logsSheet.appendRow([timestamp, status, message, details]);
  } catch (e) {
    Logger.log('Error logging to sheet: ' + e);
  }
}

// Utility: Send error email
function sendErrorEmail(subject, body) {
  try {
    const creds = getCredentials();
    if (!creds.notificationEmail) return;

    GmailApp.sendEmail(
      creds.notificationEmail,
      `[PetPooja Report] ${subject}`,
      body
    );
  } catch (e) {
    Logger.log('Error sending email: ' + e);
  }
}

// Utility: Check if duplicate exists (by date)
function isDuplicateDate(sheet, dateStr) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === dateStr) {
      return true;
    }
  }
  return false;
}
