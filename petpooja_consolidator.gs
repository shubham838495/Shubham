/**
 * PetPooja reports → one consolidated Google Sheet (auto).
 *
 * Paste this into the Apps Script editor of the master sheet
 * ("NBC Vijay Nagar - Daily POS Reports (Item & Payment Wise)"),
 * enable the Drive advanced service, then use the "PetPooja" menu.
 *
 * It reads the report files PetPooja already emails you (no login to PetPooja),
 * preserves every column in Raw tabs, rebuilds a Consolidated daily summary,
 * and installs a daily trigger so it keeps itself up to date.
 *
 * SETUP (once):
 *   1. Master sheet → Extensions → Apps Script. Paste this file. Save.
 *   2. Left panel → Services (+) → add "Drive API" (advanced service).
 *   3. Reload the sheet. A "PetPooja" menu appears.
 *   4. PetPooja menu → "Run now (backfill / update)". Approve permissions.
 *      Re-run until the toast says "0 emails remaining" (history is large, so
 *      it processes in batches to stay within Apps Script time limits).
 *   5. PetPooja menu → "Install daily auto-update".
 */

// ---- Config ---------------------------------------------------------------

var MAX_PER_RUN = 40;               // emails processed per execution (time cap)
var DONE_LABEL = 'PP_Ingested';     // Gmail label marking a processed email
var OUTLET = 'NBC - Vijay Nagar, Indore';

// Each report: Gmail search + the Raw tab it lands in.
var REPORTS = [
  { key: 'ItemWise',     tab: 'Raw_ItemWise',
    query: 'from:support@petpooja.com subject:"Item Wise Report" has:attachment' },
  { key: 'PaymentWise',  tab: 'Raw_PaymentWise',
    query: 'from:support@petpooja.com subject:"Payment Wise Summary" has:attachment' },
  { key: 'StockSummary', tab: 'Raw_StockSummary',
    query: 'from:noreply@petpooja.com subject:"Stock summary" has:attachment' }
];

var META_HEADERS = ['Report Date', 'Outlet', 'Source File'];

// ---- Menu -----------------------------------------------------------------

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('PetPooja')
    .addItem('Run now (backfill / update)', 'runNow')
    .addItem('Rebuild Consolidated + Dashboard', 'rebuildDerived')
    .addSeparator()
    .addItem('Install daily auto-update', 'installDailyTrigger')
    .addItem('Remove daily auto-update', 'removeDailyTrigger')
    .addToUI();
}

// ---- Main -----------------------------------------------------------------

function runNow() {
  var res = ingestBatch();
  rebuildDerived();
  var msg = 'Added ' + res.processed + ' report(s). ' + res.remaining +
            ' email(s) remaining' + (res.remaining > 0 ? ' — run again.' : '.');
  try { SpreadsheetApp.getActive().toast(msg, 'PetPooja', 8); } catch (e) {}
  log('RUN', msg);
}

// Called by the daily trigger.
function scheduledUpdate() {
  ingestBatch();
  rebuildDerived();
}

function ingestBatch() {
  var ss = SpreadsheetApp.getActive();
  var doneLabel = GmailApp.getUserLabelByName(DONE_LABEL) ||
                  GmailApp.createLabel(DONE_LABEL);
  var processed = 0, remaining = 0;

  for (var r = 0; r < REPORTS.length; r++) {
    var rep = REPORTS[r];
    var sheet = tab(ss, rep.tab);
    var threads = GmailApp.search(rep.query + ' -label:' + DONE_LABEL, 0, 60);
    remaining += threads.length;

    for (var t = 0; t < threads.length && processed < MAX_PER_RUN; t++) {
      var msgs = threads[t].getMessages();
      var ok = false;
      for (var m = 0; m < msgs.length; m++) {
        var msg = msgs[m];
        var reportDate = parseReportDate(msg);
        var atts = msg.getAttachments();
        for (var a = 0; a < atts.length; a++) {
          var rows = attachmentToRows(atts[a]);
          if (!rows || rows.length < 2) continue;
          writeRaw(sheet, rows, reportDate, atts[a].getName());
          ok = true;
        }
      }
      if (ok) { threads[t].addLabel(doneLabel); processed++; remaining--; }
    }
  }
  return { processed: processed, remaining: Math.max(0, remaining) };
}

// ---- Parsing --------------------------------------------------------------

// PetPooja states the report's own date in the body ("...of 2026-09-28.").
function parseReportDate(msg) {
  var body = '';
  try { body = msg.getBody() || ''; } catch (e) {}
  var m = body.match(/of\s*<strong>\s*(\d{4}-\d{2}-\d{2})\s*<\/strong>/i) ||
          body.match(/(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  // Fallback: the day before the email arrived.
  var d = new Date(msg.getDate().getTime() - 864e5);
  return Utilities.formatDate(d, ss_tz(), 'yyyy-MM-dd');
}

// Convert an .xls/.xlsx attachment to a 2D array. Falls back to HTML-table
// parsing for PetPooja's HTML-based .xls exports.
function attachmentToRows(att) {
  var name = (att.getName() || '').toLowerCase();
  // Try Drive conversion (handles real .xlsx and .xls).
  try {
    var file = Drive.Files.insert(
      { title: 'tmp_pp_' + Date.now(), mimeType: MimeType.GOOGLE_SHEETS },
      att.copyBlob(), { convert: true });
    var vals = SpreadsheetApp.openById(file.id).getSheets()[0]
                 .getDataRange().getValues();
    Drive.Files.remove(file.id);
    if (vals && vals.length) return trimEmpty(vals);
  } catch (e) {
    // fall through to HTML parsing
  }
  // Fallback: HTML table saved as .xls
  try {
    var html = att.getDataAsString();
    if (html && /<table/i.test(html)) return htmlTableToRows(html);
  } catch (e2) {}
  return [];
}

function htmlTableToRows(html) {
  var rows = [];
  var trs = html.match(/<tr[\s\S]*?<\/tr>/gi) || [];
  for (var i = 0; i < trs.length; i++) {
    var cells = trs[i].match(/<t[dh][\s\S]*?<\/t[dh]>/gi) || [];
    var row = cells.map(function (c) {
      return c.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ')
              .replace(/&amp;/g, '&').trim();
    });
    if (row.length && row.some(function (x) { return x !== ''; })) rows.push(row);
  }
  return rows;
}

// ---- Writing raw ----------------------------------------------------------

function writeRaw(sheet, rows, reportDate, fileName) {
  var header = rows[0];
  var data = rows.slice(1);

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(META_HEADERS.concat(header));
    sheet.getRange(1, 1, 1, sheet.getLastColumn())
         .setFontWeight('bold').setBackground('#1a73e8').setFontColor('#ffffff');
    sheet.setFrozenRows(1);
  }
  var width = sheet.getLastColumn();
  var out = data.map(function (row) {
    var full = [reportDate, OUTLET, fileName].concat(row);
    while (full.length < width) full.push('');
    return full.slice(0, width);
  });
  if (out.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, out.length, width).setValues(out);
  }
}

// ---- Consolidated + Dashboard --------------------------------------------

function rebuildDerived() {
  buildConsolidated();
  buildDashboard();
}

// Best-effort daily summary. Payment Wise gives sales by mode; Item Wise gives
// order count + gross. Column names are matched by pattern so it survives minor
// header differences. Refine here once real headers are confirmed in the Logs.
function buildConsolidated() {
  var ss = SpreadsheetApp.getActive();
  var out = ss.getSheetByName('Consolidated') || ss.insertSheet('Consolidated');
  out.clear();

  var byDate = {};   // date -> { modes:{}, gross:0, orders:set }
  function bucket(d) {
    if (!byDate[d]) byDate[d] = { modes: {}, gross: 0, bills: {} };
    return byDate[d];
  }

  // Payment Wise → amount per payment mode per date
  var pw = readTab('Raw_PaymentWise');
  if (pw.rows.length) {
    var pMode = findCol(pw.header, [/payment/i, /mode/i, /type/i]);
    var pAmt  = findCol(pw.header, [/amount/i, /total/i, /net/i, /sale/i]);
    var pDate = 0; // 'Report Date' is column 0
    pw.rows.forEach(function (row) {
      var d = row[pDate]; if (!d) return;
      var b = bucket(d);
      var mode = (pMode >= 0 ? row[pMode] : 'Total') || 'Unknown';
      var amt = num(pAmt >= 0 ? row[pAmt] : 0);
      b.modes[mode] = (b.modes[mode] || 0) + amt;
      b.gross += amt;
    });
  }

  // Item Wise → distinct bills = orders (gross from payment wise preferred)
  var iw = readTab('Raw_ItemWise');
  if (iw.rows.length) {
    var iBill = findCol(iw.header, [/invoice/i, /bill/i, /order.*no/i]);
    iw.rows.forEach(function (row) {
      var d = row[0]; if (!d) return;
      var b = bucket(d);
      if (iBill >= 0 && row[iBill]) b.bills[row[iBill]] = true;
    });
  }

  var modeSet = {};
  Object.keys(byDate).forEach(function (d) {
    Object.keys(byDate[d].modes).forEach(function (mo) { modeSet[mo] = true; });
  });
  var modes = Object.keys(modeSet).sort();

  var header = ['Date', 'Outlet', 'Total Sales', 'Orders'].concat(modes);
  var rows = Object.keys(byDate).sort().map(function (d) {
    var b = byDate[d];
    var row = [d, OUTLET, round2(b.gross), Object.keys(b.bills).length];
    modes.forEach(function (mo) { row.push(round2(b.modes[mo] || 0)); });
    return row;
  });

  out.appendRow(header);
  out.getRange(1, 1, 1, header.length)
     .setFontWeight('bold').setBackground('#0b8043').setFontColor('#ffffff');
  out.setFrozenRows(1);
  if (rows.length) out.getRange(2, 1, rows.length, header.length).setValues(rows);
}

function buildDashboard() {
  var ss = SpreadsheetApp.getActive();
  var dash = ss.getSheetByName('Dashboard') || ss.insertSheet('Dashboard');
  dash.clear();
  dash.getCharts().forEach(function (c) { dash.removeChart(c); });

  var con = ss.getSheetByName('Consolidated');
  if (!con || con.getLastRow() < 2) { dash.getRange(1, 1).setValue('No data yet.'); return; }

  dash.getRange(1, 1).setValue('NBC Vijay Nagar — Sales Dashboard')
      .setFontSize(16).setFontWeight('bold');
  dash.getRange(2, 1).setValue('Auto-updated from PetPooja emails. Last refresh: ' +
      Utilities.formatDate(new Date(), ss_tz(), 'yyyy-MM-dd HH:mm'));

  var last = con.getLastRow();
  // KPI: last 30 rows total
  var start = Math.max(2, last - 29);
  var salesRange = con.getRange(start, 3, last - start + 1, 1);
  dash.getRange(4, 1).setValue('Total sales (last 30 days)').setFontWeight('bold');
  dash.getRange(4, 2).setFormula('=SUM(Consolidated!C' + start + ':C' + last + ')');
  dash.getRange(5, 1).setValue('Total orders (last 30 days)').setFontWeight('bold');
  dash.getRange(5, 2).setFormula('=SUM(Consolidated!D' + start + ':D' + last + ')');

  // Sales trend chart
  var dateRange = con.getRange(1, 1, last, 1);
  var salesCol = con.getRange(1, 3, last, 1);
  var trend = dash.newChart().asLineChart()
    .addRange(dateRange).addRange(salesCol)
    .setPosition(7, 1, 0, 0)
    .setOption('title', 'Daily Total Sales')
    .setOption('width', 640).setOption('height', 320)
    .setOption('legend', { position: 'none' })
    .build();
  dash.insertChart(trend);

  // Payment-mode split (columns E onward in Consolidated) — pie of last row
  var lastColn = con.getLastColumn();
  if (lastColn >= 5) {
    var modeHeader = con.getRange(1, 5, 1, lastColn - 4);
    var modeVals = con.getRange(last, 5, 1, lastColn - 4);
    var pie = dash.newChart().asPieChart()
      .addRange(modeHeader).addRange(modeVals)
      .setPosition(7, 8, 0, 0)
      .setOption('title', 'Payment Mode Split (latest day)')
      .setOption('width', 420).setOption('height', 320)
      .build();
    dash.insertChart(pie);
  }
}

// ---- Triggers -------------------------------------------------------------

function installDailyTrigger() {
  removeDailyTrigger();
  ScriptApp.newTrigger('scheduledUpdate').timeBased().everyDays(1).atHour(10).create();
  try { SpreadsheetApp.getActive().toast('Daily auto-update installed (runs ~10 AM).', 'PetPooja', 6); } catch (e) {}
}

function removeDailyTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'scheduledUpdate') ScriptApp.deleteTrigger(t);
  });
}

// ---- Helpers --------------------------------------------------------------

function tab(ss, name) { return ss.getSheetByName(name) || ss.insertSheet(name); }
function ss_tz() { return SpreadsheetApp.getActive().getSpreadsheetTimeZone() || 'Asia/Kolkata'; }

function readTab(name) {
  var sh = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sh || sh.getLastRow() < 2) return { header: [], rows: [] };
  var values = sh.getDataRange().getValues();
  return { header: values[0], rows: values.slice(1) };
}

function findCol(header, patterns) {
  for (var p = 0; p < patterns.length; p++) {
    for (var i = 0; i < header.length; i++) {
      if (patterns[p].test(String(header[i]))) return i;
    }
  }
  return -1;
}

function num(v) {
  if (typeof v === 'number') return v;
  var n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? 0 : n;
}
function round2(n) { return Math.round(n * 100) / 100; }
function trimEmpty(vals) {
  return vals.filter(function (row) {
    return row.some(function (c) { return c !== '' && c !== null; });
  });
}

function log(status, message) {
  var ss = SpreadsheetApp.getActive();
  var s = ss.getSheetByName('Logs') || ss.insertSheet('Logs');
  if (s.getLastRow() === 0) s.appendRow(['Timestamp', 'Status', 'Message']);
  s.appendRow([new Date(), status, message]);
}
