# CLAUDE.md — PetPooja Daily Report Automation

## What this repo is

One job: pull the PetPooja daily sales report and append it to a Google Sheet,
on a schedule, unattended.

There are **two implementations of that one job**. They are alternatives, not
layers — only one should be running in production:

| Path | What it is | Needs |
| --- | --- | --- |
| `apps-script/` | Google Apps Script, credentials in Script Properties | A Google account. No GCP, no billing. |
| `cloud-function/` | Python on Cloud Functions + Pub/Sub + Cloud Scheduler | A GCP project with billing. |

`docs/` holds the setup guides, named by the path they belong to.
`README.md` records which path is live. Keep that honest.

## What does NOT belong here

- Dashboards, reporting UI, menu-mix or performance analysis → **NBC Analytics**
- SHUBH INC (Vijay Nagar) payroll, handover, reconciliation, register → **SHUBH INC**
- Reusable tooling with no entity attached → **Build Lab**

If it is not "fetch the daily report into a Sheet", it belongs somewhere else.
Say so rather than adding it here.

## Before you build anything

This repo already contains the same job built twice. Before adding a third way
to do anything:

1. Check whether `apps-script/` or `cloud-function/` already does it.
2. If both do, change the one `README.md` marks live, and say in the commit
   message why the other was left alone.
3. Do not add a third implementation path unless I ask for one.

## Hard rules

- **Never hardcode credentials, passwords, personal emails, sheet IDs or
  project IDs.** This repository is public. Apps Script reads Script
  Properties; the Cloud Function reads environment variables through
  `_required_env()` and fails loudly when one is missing.
- The report date is **yesterday**, never today.
- PetPooja's biller closes around 09:00 the following day. Any date matching
  must use a configurable business-day boundary, not midnight.
- Timezone is `Asia/Kolkata` everywhere.
- A run must not append a date already present in the sheet.
- Apps Script: editor changes are not live at `/exec` until a new deployment
  version is created, and `doGet` cannot be tested with the Run button.

## Conventions

- Sheet tabs: `Reports` (data), `Logs` (timestamp, status, message, details).
- Report columns: Report Date, Restaurants, Invoice Nos., Total, Min.
- Every run logs success or failure to `Logs`; failures also email
  `NOTIFICATION_EMAIL`.

## Open decisions — ask, do not assume

- **Which path is live.** Apps Script or Cloud Function. `README.md` holds the
  answer once I decide.
- **Which entity this is.** The report returns a row per restaurant, so this
  looks chain-wide (corporate), not SHUBH INC. Confirm before mixing it with my
  own outlet's figures.
- `cloud-function/deploy.sh` grants the service account `roles/editor` and
  passes `--allow-unauthenticated` to a Pub/Sub-triggered function. Both are
  wider than needed; tightening is pending.
- Secrets reach the Cloud Function as plain env vars, readable by anyone with
  project access. Moving them to Secret Manager is the next step.
