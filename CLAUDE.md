# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this project is

A single-purpose automation: every morning it logs in to **PetPooja** (the restaurant
billing/POS used by the Nothing Before Coffee cafés), downloads the previous day's
sales report, and appends the rows to a Google Sheet, with a `Logs` tab and email
alerts on failure.

There is **no build, no test suite, and no package to install**. The repo is a
collection of deployable source files plus setup documentation. Nothing here runs
locally — it runs either inside Google Apps Script or as a Google Cloud Function.

## Two parallel implementations — keep them in sync

The same workflow exists twice. A change to the scraping or sheet logic usually
needs to be made in both places.

### 1. Google Apps Script (`*.gs`) — the primary implementation

Runs bound to the Google Sheet, triggered daily at 9 AM by an Apps Script
time-based trigger. Files are copy-pasted into the Apps Script editor (see
`APPS_SCRIPT_SETUP.md`); there is no `clasp` setup, so file names here must match
the file names created in the editor.

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

### 2. Google Cloud Function (`cloud_function_main.py`) — the "phone-free" path

A flat Python port of the same flow. Entry point `download_petpooja_report`
(`functions_framework.http`), deployed by `deploy_cloud_function.sh`, which also
creates a Pub/Sub topic and a Cloud Scheduler job at 9 AM IST. Writes to Sheets
with Application Default Credentials via a service account, not OAuth.

## Conventions to follow

- **Credentials belong in Script Properties / environment variables, never in code.**
  Apps Script reads `PETPOOJA_EMAIL`, `PETPOOJA_PASSWORD`, `SHEET_ID` and
  `NOTIFICATION_EMAIL` through `getCredentials()`. Follow that pattern in any new
  code. (See *Known issues* — the Python path currently violates this.)
- **Every step logs twice:** `Logger.log()` / `logger.info()` for the execution log,
  and `logToSheet()` / `log_execution()` for the owner-visible `Logs` tab.
- **Failures must be visible to a non-technical operator.** Wrap work in try/catch,
  write an `ERROR` row to `Logs`, and email the notification address. Formatting
  failures are deliberately swallowed — they must never abort a run.
- **The report is always for *yesterday*** (`getYesterdayDate()` /
  `get_yesterday_date()`), in `Asia/Kolkata` time, formatted `YYYY-MM-DD`.
- Sheet layout: a `Reports` tab with headers `Report Date, Restaurants, Invoice Nos.,
  Total, Min.`, and a `Logs` tab with `Timestamp, Status, Message, Details`. Changing
  `CONFIG.HEADERS` means the existing sheet must be migrated by hand.
- Re-running for a date already present is a no-op in Apps Script
  (`isDuplicateDate()`). The Python path has **no** duplicate guard.
- Documentation here is written for a phone-first, non-developer reader: numbered
  steps, exact URLs, no shell assumptions. Keep new docs in that voice.

## Verifying a change

There is no automated test harness. Verification is manual:

- Apps Script: run `testReportDownload()` from the editor — it checks credentials,
  login, sheet access and date helpers without writing report rows. Then run
  `runDailyReport()` once by hand and inspect the `Reports` and `Logs` tabs.
- Cloud Function: deploy with `./deploy_cloud_function.sh`, then trigger the
  scheduler job manually and read Cloud Logging.
- Python syntax check only (no dependencies are installed in this repo):
  `python3 -m py_compile cloud_function_main.py`

## Known issues worth fixing before extending

- `cloud_function_main.py` and `deploy_cloud_function.sh` hardcode the PetPooja
  login, **its password**, the Sheet ID and the GCP project. The password is in git
  history and must be rotated, then moved to Secret Manager or env vars.
- `deploy_cloud_function.sh` grants `roles/editor` project-wide and deploys with
  `--allow-unauthenticated`; it also pairs an HTTP-decorated handler with a
  `--trigger-topic` deployment, which will not receive Pub/Sub events correctly.
- The HTML scraping is regex-based and matches only the *first* `<table>`; any
  PetPooja markup change breaks it silently (zero rows, logged as a `WARNING`
  rather than an error).
- The login flow never verifies it actually authenticated — a login page returned
  with HTTP 200 counts as success, so a wrong password surfaces later as "no data".
- `convertExcelToArray()` in `download.gs` creates a temp sheet it never uses and
  parses an `.xlsx` blob as CSV; in practice the Excel path always falls back to
  HTML parsing.
