/**
 * PetPooja reports → one consolidated Google Sheet (auto).
 *
 * Reads the report files PetPooja already emails you (no PetPooja login),
 * parses each report's real table (skipping the title rows), preserves every
 * column in Raw tabs, builds a Consolidated daily summary + Dashboard, and
 * self-installs a daily trigger.
 *
 * SETUP (once):
 *   1. Master sheet → Extensions → Apps Script. Paste this file. Save.
 *   2. Left panel → Services (＋) → add "Drive API".
 *   3. Reload the sheet → use the "PetPooja" menu.
 *   4. PetPooja → "Reset & re-import (clean)". Approve permissions. Then keep
 *      clicking PetPooja → "Run now" until it says "0 emails remaining".
 *   5. PetPooja → "Install daily auto-update".
 */

// ---- Config ---------------------------------------------------------------

var MAX_PER_RUN = 500;              // effectively "all", bounded by the time guard
var DEADLINE_MS = 5 * 60 * 1000;    // stop before Apps Script's 6-min limit
var DONE_LABEL = 'PP_Ingested';
var OUTLET = 'NBC - Vijay Nagar, Indore';
var META = ['Report Date', 'Outlet', 'Source File'];

// Processed in this order. anchor = a cell that appears in the real header row.
var REPORTS = [
  { key: 'PaymentWise',  tab: 'Raw_PaymentWise',
    query: 'from:support@petpooja.com subject:"Payment Wise Summary" has:attachment',
    anchor: /^payment type$/i },
  { key: 'StockSummary', tab: 'Raw_StockSummary',
    query: 'from:noreply@petpooja.com subject:"Stock summary" has:attachment',
    anchor: /^raw material$/i },
  { key: 'ItemWise',     tab: 'Raw_ItemWise',
    query: 'from:support@petpooja.com subject:"Item Wise Report" has:attachment',
    anchor: /^final total$/i }
];

var MY_TABS = ['Raw_PaymentWise', 'Raw_StockSummary', 'Raw_ItemWise',
               'Consolidated', 'Dashboard'];

// Payment modes as they appear in the Payment Wise report header.
var PAY_MODES = ['Cash', 'Card', 'UPI', 'Online', 'Wallet', 'Other',
                 'Due Payment', 'Not Paid'];
var SALES_MODES = ['Cash', 'Card', 'UPI', 'Online', 'Wallet', 'Other', 'Due Payment'];

// ---- Menu -----------------------------------------------------------------

function onOpen() {
  SpreadsheetApp.getUi().createMenu('PetPooja')
    .addItem('Run now (backfill / update)', 'runNow')
    .addItem('Rebuild Consolidated + Dashboard', 'rebuildDerived')
    .addSeparator()
    .addItem('Reset & re-import (clean)', 'resetAndReimport')
    .addSeparator()
    .addItem('Install daily auto-update', 'installDailyTrigger')
    .addItem('Remove daily auto-update', 'removeDailyTrigger')
    .addToUi();
}

// ---- Main -----------------------------------------------------------------

function runNow() {
  var res = ingestBatch();
  rebuildDerived();
  toast('Added ' + res.processed + ' report(s). ' + res.remaining +
        ' remaining' + (res.remaining > 0 ? ' — run again.' : ' — done!'));
}

function scheduledUpdate() { ingestBatch(); rebuildDerived(); }

function resetAndReimport() {
  var ss = SpreadsheetApp.getActive();
  MY_TABS.forEach(function (n) { var s = ss.getSheetByName(n); if (s) s.clear(); });
  var lbl = GmailApp.getUserLabelByName(DONE_LABEL);
  if (lbl) lbl.deleteLabel();     // un-marks every previously processed email
  log('RESET', 'Cleared tabs and processed-labels');
  toast('Reset done. Now click "Run now" repeatedly until 0 remaining.');
}

function ingestBatch() {
  var lbl = GmailApp.getUserLabelByName(DONE_LABEL) || GmailApp.createLabel(DONE_LABEL);
  var ss = SpreadsheetApp.getActive();
  var processed = 0, remaining = 0, t0 = Date.now();

  for (var r = 0; r < REPORTS.length; r++) {
    var rep = REPORTS[r];
    var threads = GmailApp.search(rep.query + ' -label:' + DONE_LABEL, 0, 200);
    remaining += threads.length;
    var sheet = tab(ss, rep.tab);

    for (var t = 0; t < threads.length && processed < MAX_PER_RUN &&
                    (Date.now() - t0) < DEADLINE_MS; t++) {
      var msgs = threads[t].getMessages(), ok = false;
      for (var m = 0; m < msgs.length; m++) {
        var msg = msgs[m], date = parseReportDate(msg), atts = msg.getAttachments();
        for (var a = 0; a < atts.length; a++) {
          var grid = attachmentToRows(atts[a]);
          var tbl = extractTable(grid, rep.anchor);
          if (!tbl || tbl.data.length === 0) continue;
          writeReport(sheet, tbl.header, tbl.data, date, atts[a].getName());
          ok = true;
        }
      }
      if (ok) { threads[t].addLabel(lbl); processed++; remaining--; }
    }
  }
  log('RUN', 'Added ' + processed + ', ' + Math.max(0, remaining) + ' remaining');
  return { processed: processed, remaining: Math.max(0, remaining) };
}

// ---- Parsing --------------------------------------------------------------

function parseReportDate(msg) {
  var body = ''; try { body = msg.getBody() || ''; } catch (e) {}
  var m = body.match(/of\s*<strong>\s*(\d{4}-\d{2}-\d{2})/i) || body.match(/(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  return Utilities.formatDate(new Date(msg.getDate().getTime() - 864e5), tz(), 'yyyy-MM-dd');
}

// Attachment (.xls HTML or real .xlsx) → 2D array.
function attachmentToRows(att) {
  var vals = null;
  try { vals = convertViaDrive(att.copyBlob()); } catch (e) { log('CONVERT_ERR', String(e)); }
  if (vals && vals.length > 1) return vals;
  try {
    var html = att.getDataAsString();
    if (html && /<table/i.test(html)) return htmlTableToRows(html);
  } catch (e2) {}
  return vals || [];
}

function convertViaDrive(blob) {
  var id;
  if (Drive.Files.insert) {                       // advanced Drive service v2
    id = Drive.Files.insert({ title: 'tmp_pp_' + Date.now(),
      mimeType: MimeType.GOOGLE_SHEETS }, blob, { convert: true }).id;
  } else if (Drive.Files.create) {                // advanced Drive service v3
    id = Drive.Files.create({ name: 'tmp_pp_' + Date.now(),
      mimeType: MimeType.GOOGLE_SHEETS }, blob).id;
  } else { return null; }
  var vals = SpreadsheetApp.openById(id).getSheets()[0].getDataRange().getValues();
  try { Drive.Files.remove ? Drive.Files.remove(id) : Drive.Files.trash(id); } catch (e) {}
  return vals;
}

function htmlTableToRows(html) {
  var rows = [];
  (html.match(/<tr[\s\S]*?<\/tr>/gi) || []).forEach(function (tr) {
    var cells = (tr.match(/<t[dh][\s\S]*?<\/t[dh]>/gi) || []).map(function (c) {
      return c.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();
    });
    if (cells.length && cells.some(function (x) { return x !== ''; })) rows.push(cells);
  });
  return rows;
}

// Find the real header row (via anchor) and return { header, data }.
function extractTable(grid, anchor) {
  if (!grid || !grid.length) return null;
  var hi = -1;
  for (var i = 0; i < grid.length; i++) {
    if (grid[i].some(function (c) { return anchor.test(String(c).trim()); })) { hi = i; break; }
  }
  if (hi < 0) return null;
  var header = grid[hi].map(function (c) { return String(c).trim(); });
  while (header.length && header[header.length - 1] === '') header.pop();
  var data = [];
  for (var j = hi + 1; j < grid.length; j++) {
    var row = grid[j];
    var nonEmpty = row.filter(function (c) { return c !== '' && c !== null; }).length;
    if (nonEmpty < 2) continue;                       // blank/spacer
    if (/^total/i.test(String(row[0]).trim())) continue; // footer total
    data.push(row);
  }
  return { header: header, data: data };
}

// ---- Writing --------------------------------------------------------------

function writeReport(sheet, header, data, reportDate, fileName) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(META.concat(header));
    sheet.getRange(1, 1, 1, sheet.getLastColumn())
      .setFontWeight('bold').setBackground('#1a73e8').setFontColor('#fff');
    sheet.setFrozenRows(1);
  }
  var width = sheet.getLastColumn();
  var out = data.map(function (row) {
    var full = [reportDate, OUTLET, fileName].concat(row);
    while (full.length < width) full.push('');
    return full.slice(0, width);
  });
  if (out.length) sheet.getRange(sheet.getLastRow() + 1, 1, out.length, width).setValues(out);
}

// ---- Consolidated + Dashboard --------------------------------------------

function rebuildDerived() { buildConsolidated(); buildDashboard(); }

function buildConsolidated() {
  var ss = SpreadsheetApp.getActive();
  var out = tab(ss, 'Consolidated'); out.clear();
  var pw = readTab('Raw_PaymentWise');

  var header = ['Date', 'Orders', 'Total Sales'].concat(PAY_MODES);
  out.appendRow(header);
  out.getRange(1, 1, 1, header.length).setFontWeight('bold')
     .setBackground('#0b8043').setFontColor('#fff');
  out.setFrozenRows(1);
  if (!pw.rows.length) return;

  var cInv = col(pw.header, ['Invoice No.', 'Invoice No', 'Invoice']);
  var cStatus = col(pw.header, ['Status']);
  var cMode = {}; PAY_MODES.forEach(function (mo) { cMode[mo] = col(pw.header, [mo]); });

  var byDate = {};
  pw.rows.forEach(function (row) {
    var d = ymd(row[0]); if (!d) return;
    if (cStatus >= 0 && !/success/i.test(String(row[cStatus]))) return; // sales = success only
    var b = byDate[d] || (byDate[d] = { orders: {}, modes: {} });
    if (cInv >= 0 && row[cInv] !== '' && row[cInv] != null) b.orders[row[cInv]] = true;
    PAY_MODES.forEach(function (mo) {
      if (cMode[mo] >= 0) b.modes[mo] = (b.modes[mo] || 0) + numv(row[cMode[mo]]);
    });
  });

  var rows = Object.keys(byDate).sort().map(function (d) {
    var b = byDate[d];
    var total = 0; SALES_MODES.forEach(function (mo) { total += (b.modes[mo] || 0); });
    var r = [d, Object.keys(b.orders).length, round2(total)];
    PAY_MODES.forEach(function (mo) { r.push(round2(b.modes[mo] || 0)); });
    return r;
  });
  if (rows.length) out.getRange(2, 1, rows.length, header.length).setValues(rows);
}

function buildDashboard() {
  var ss = SpreadsheetApp.getActive();
  var dash = tab(ss, 'Dashboard'); dash.clear();
  dash.getCharts().forEach(function (c) { dash.removeChart(c); });

  var con = ss.getSheetByName('Consolidated');
  dash.getRange(1, 1).setValue('NBC Vijay Nagar — Sales Dashboard')
      .setFontSize(16).setFontWeight('bold');
  dash.getRange(2, 1).setValue('Auto-updated from PetPooja emails · ' +
      Utilities.formatDate(new Date(), tz(), 'yyyy-MM-dd HH:mm'));
  if (!con || con.getLastRow() < 2) { dash.getRange(4, 1).setValue('No data yet.'); return; }

  var last = con.getLastRow(), start = Math.max(2, last - 29);
  dash.getRange(4, 1).setValue('Sales (last 30 days)').setFontWeight('bold');
  dash.getRange(4, 2).setFormula('=SUM(Consolidated!C' + start + ':C' + last + ')');
  dash.getRange(5, 1).setValue('Orders (last 30 days)').setFontWeight('bold');
  dash.getRange(5, 2).setFormula('=SUM(Consolidated!B' + start + ':B' + last + ')');

  dash.insertChart(dash.newChart().asLineChart()
    .addRange(con.getRange(1, 1, last, 1)).addRange(con.getRange(1, 3, last, 1))
    .setPosition(7, 1, 0, 0).setOption('title', 'Daily Total Sales')
    .setOption('width', 640).setOption('height', 320)
    .setOption('legend', { position: 'none' }).build());

  // Payment split: sum each mode over last 30 days (cols D.. in Consolidated)
  var modeCount = PAY_MODES.length;
  var split = con.getRange(start, 4, last - start + 1, modeCount).getValues();
  var sums = new Array(modeCount).fill(0);
  split.forEach(function (r) { r.forEach(function (v, i) { sums[i] += numv(v); }); });
  var tmp = tab(ss, 'Dashboard');
  tmp.getRange(24, 1, 1, modeCount).setValues([PAY_MODES]);
  tmp.getRange(25, 1, 1, modeCount).setValues([sums]);
  dash.insertChart(dash.newChart().asPieChart()
    .addRange(tmp.getRange(24, 1, 2, modeCount))
    .setNumHeaders(1).setTransposeRowsAndColumns(true)
    .setPosition(7, 8, 0, 0).setOption('title', 'Payment Mode Split (30d)')
    .setOption('width', 420).setOption('height', 320).build());
}

// ---- Triggers -------------------------------------------------------------

function installDailyTrigger() {
  removeDailyTrigger();
  ScriptApp.newTrigger('scheduledUpdate').timeBased().everyDays(1).atHour(10).create();
  toast('Daily auto-update installed (~10 AM).');
}
function removeDailyTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'scheduledUpdate') ScriptApp.deleteTrigger(t);
  });
}

// ---- Helpers --------------------------------------------------------------

function tab(ss, n) { return ss.getSheetByName(n) || ss.insertSheet(n); }
function tz() { return SpreadsheetApp.getActive().getSpreadsheetTimeZone() || 'Asia/Kolkata'; }
function toast(m) { try { SpreadsheetApp.getActive().toast(m, 'PetPooja', 8); } catch (e) {} }

function readTab(name) {
  var s = SpreadsheetApp.getActive().getSheetByName(name);
  if (!s || s.getLastRow() < 2) return { header: [], rows: [] };
  var v = s.getDataRange().getValues();
  return { header: v[0], rows: v.slice(1) };
}
function col(header, names) {
  for (var n = 0; n < names.length; n++)
    for (var i = 0; i < header.length; i++)
      if (String(header[i]).trim().toLowerCase() === names[n].toLowerCase()) return i;
  return -1;
}
function numv(v) {
  if (typeof v === 'number') return v;
  var n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? 0 : n;
}
function round2(n) { return Math.round(n * 100) / 100; }
function ymd(v) {
  if (v instanceof Date) return Utilities.formatDate(v, tz(), 'yyyy-MM-dd');
  var s = String(v).trim(), m = s.match(/\d{4}-\d{2}-\d{2}/);
  if (m) return m[0];
  var d = new Date(s); return isNaN(d) ? s : Utilities.formatDate(d, tz(), 'yyyy-MM-dd');
}
function log(status, message) {
  var ss = SpreadsheetApp.getActive();
  var s = ss.getSheetByName('Logs') || ss.insertSheet('Logs');
  if (s.getLastRow() === 0) s.appendRow(['Timestamp', 'Status', 'Message']);
  s.appendRow([new Date(), status, message]);
}
