/**
 * PetPooja report -> Google Sheet, via Gmail.
 *
 * This does NOT log in to PetPooja. It watches Gmail for the report file
 * (either emailed automatically by PetPooja, or forwarded by you after you
 * tap "Excel"), reads the attachment, and appends its rows to the sheet with
 * the report date. Safe, no credentials, no risk to your PetPooja account.
 *
 * SETUP (once):
 *   1. Open your Google Sheet -> Extensions -> Apps Script.
 *   2. Paste this file in, Save.
 *   3. In Gmail, make a label called "PetpoojaReport" and a filter that
 *      applies it to the report emails (e.g. subject contains "petpooja
 *      report", or has an .xlsx attachment from PetPooja).
 *   4. Back in Apps Script: run `ingestReports` once and approve permissions.
 *   5. Triggers (clock icon) -> add a time-driven trigger for `ingestReports`,
 *      e.g. every hour or once a day. Done.
 */

var SHEET_ID = '11_U8uBU2A6nbfCeBLsZaxi_AbLWA1TXkWVTMVWLzbnI';
var REPORT_TAB = 'Reports';
var LOG_TAB = 'Logs';
var GMAIL_QUERY = 'label:PetpoojaReport has:attachment -label:PetpoojaDone';
var DONE_LABEL = 'PetpoojaDone';

function ingestReports() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var reportSheet = sheetOrCreate(ss, REPORT_TAB);
  var doneLabel = GmailApp.getUserLabelByName(DONE_LABEL) ||
                  GmailApp.createLabel(DONE_LABEL);

  var threads = GmailApp.search(GMAIL_QUERY, 0, 20);
  if (threads.length === 0) {
    log(ss, 'INFO', 'No new report emails', GMAIL_QUERY);
    return;
  }

  var totalRows = 0;
  for (var t = 0; t < threads.length; t++) {
    var messages = threads[t].getMessages();
    for (var m = 0; m < messages.length; m++) {
      var msg = messages[m];
      var reportDate = dateFromMessage(msg);
      var attachments = msg.getAttachments();
      for (var a = 0; a < attachments.length; a++) {
        var rows = readAttachment(attachments[a]);
        if (rows.length === 0) continue;
        var dated = rows.map(function (r) { return [reportDate].concat(r); });
        reportSheet.getRange(reportSheet.getLastRow() + 1, 1,
                             dated.length, dated[0].length).setValues(pad(dated));
        totalRows += dated.length;
      }
    }
    threads[t].addLabel(doneLabel);
  }
  log(ss, 'SUCCESS', 'Ingested report emails',
      totalRows + ' rows from ' + threads.length + ' thread(s)');
}

/** Read an attachment (xlsx or csv) into a 2D array of strings. */
function readAttachment(att) {
  var name = (att.getName() || '').toLowerCase();
  try {
    if (name.slice(-4) === '.csv') {
      return Utilities.parseCsv(att.getDataAsString());
    }
    if (name.slice(-5) === '.xlsx' || name.slice(-4) === '.xls') {
      // Convert the Excel file to a temporary Google Sheet to read it.
      var tmp = Drive.Files.insert(
        { title: 'tmp_petpooja_' + Date.now(),
          mimeType: MimeType.GOOGLE_SHEETS },
        att.copyBlob(), { convert: true });
      var values = SpreadsheetApp.openById(tmp.id)
                     .getSheets()[0].getDataRange().getValues();
      Drive.Files.remove(tmp.id);
      return values.filter(function (row) {
        return row.some(function (c) { return c !== '' && c !== null; });
      });
    }
  } catch (e) {
    Logger.log('readAttachment failed for ' + name + ': ' + e);
  }
  return [];
}

/** Report date = day before the email arrived (yesterday's sales). */
function dateFromMessage(msg) {
  var d = new Date(msg.getDate().getTime() - 24 * 60 * 60 * 1000);
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function sheetOrCreate(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

/** Pad ragged rows to equal width so setValues() does not throw. */
function pad(rows) {
  var w = 0;
  rows.forEach(function (r) { w = Math.max(w, r.length); });
  return rows.map(function (r) {
    while (r.length < w) r.push('');
    return r;
  });
}

function log(ss, status, message, details) {
  var s = sheetOrCreate(ss, LOG_TAB);
  if (s.getLastRow() === 0) {
    s.appendRow(['Timestamp', 'Status', 'Message', 'Details']);
  }
  s.appendRow([new Date(), status, message, details || '']);
}
