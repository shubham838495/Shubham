# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this project is

A single-purpose automation: every morning it logs in to **PetPooja** (the restaurant
billing/POS used by the Nothing Before Coffee cafés), downloads the previous day's
sales report, and appends the rows to a Google Sheet, with a `Logs` tab and email
alerts on failure.

There is **no build, no test suite, and no package to install**. The repo is a set of
Google Apps Script source files plus setup documentation. Nothing here runs locally —
it runs inside Google Apps Script, bound to the Google Sheet.

## Architecture

Runs bound to the Google Sheet, triggered daily at 9 AM by an Apps Script time-based
trigger. Files are copy-pasted into the Apps Script editor (see
`APPS_SCRIPT_SETUP.md`); there is no `clasp` setup, so file names here must match the
file names created in the editor.

| File | Role |
|---|---|
| `config.gs` | `CONFIG` constants, `getCredentials()` (reads Script Properties), date helpers, `logToSheet()`, `sendErrorEmail()`, duplicate check |
| `auth.gs` | PetPooja form login via `UrlFetchApp`, holds `sessionCookies` in a module-level variable, builds authenticated headers |
| `download.gs` | Posts the report form, regex-parses the HTML `<table>` into rows, prepends the report date |
| `sheets.gs` | Appends to the `Reports` tab, validates rows, formats headers, status helpers |
| `main.gs` | `runDailyReport()` entry point (the trigger target), plus `testReportDownload()`, `getAutomationStatus()`, `enableAutomation()`, `disableAutomation()` |

Load order matters conceptually (`config` → `auth` → `download` → `sheets` → `main`),
but Apps Script shares one global scope, so all top-level functions and `CONFIG` are
visible everywhere.

A Google Cloud Function port of this workflow was removed in favour of a single
implementation. It duplicated the scraping and sheet logic, hardcoded credentials in
source, and its deploy script paired an HTTP-style handler with a `--trigger-topic`
deployment, so the scheduled run never fired correctly. The Apps Script trigger
already runs unattended, which was the Cloud Function's only advantage. **Do not
reintroduce a second implementation** unless Apps Script quotas force it; if that
happens, the two must share one source of truth rather than being hand-ported.

## Conventions to follow

- **Credentials belong in Script Properties, never in code or documentation.**
  `getCredentials()` reads `PETPOOJA_EMAIL`, `PETPOOJA_PASSWORD`, `SHEET_ID` and
  `NOTIFICATION_EMAIL`. Docs use placeholders, never real values — anything committed
  stays in git history after deletion.
- **Every step logs twice:** `Logger.log()` for the execution log, and `logToSheet()`
  for the owner-visible `Logs` tab.
- **Failures must be visible to a non-technical operator.** Wrap work in try/catch,
  write an `ERROR` row to `Logs`, and email the notification address. Formatting
  failures are deliberately swallowed — they must never abort a run.
- **The report is always for *yesterday*** (`getYesterdayDate()`), in `Asia/Kolkata`
  time, formatted `YYYY-MM-DD`.
- Sheet layout: a `Reports` tab with headers `Report Date, Restaurants, Invoice Nos.,
  Total, Min.`, and a `Logs` tab with `Timestamp, Status, Message, Details`. Changing
  `CONFIG.HEADERS` means the existing sheet must be migrated by hand.
- Re-running for a date already present is a no-op (`isDuplicateDate()`).
- Documentation here is written for a phone-first, non-developer reader: numbered
  steps, exact URLs, no shell assumptions. Keep new docs in that voice.

## Verifying a change

There is no automated test harness. Verification is manual:

1. Run `testReportDownload()` from the Apps Script editor — it checks credentials,
   login, sheet access and date helpers without writing report rows.
2. Run `runDailyReport()` once by hand and inspect the `Reports` and `Logs` tabs.

## Known issues worth fixing before extending

- The HTML scraping is regex-based and matches only the *first* `<table>`; any
  PetPooja markup change breaks it silently (zero rows, logged as a `WARNING`
  rather than an error).
- The login flow never verifies it actually authenticated — a login page returned
  with HTTP 200 counts as success, so a wrong password surfaces later as "no data"
  rather than as an auth error.
- `convertExcelToArray()` in `download.gs` creates a temp sheet it never uses and
  parses an `.xlsx` blob as CSV; in practice the Excel path always falls back to
  HTML parsing. `downloadReportAsExcel()` is dead code today.
- The PetPooja password was previously committed in plaintext and remains in git
  history (commits `f534332`, `c852693`, `eebc5de`). It must be treated as exposed
  and rotated in PetPooja; removing it from history additionally requires a rewrite
  of all three commits.
