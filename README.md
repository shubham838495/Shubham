# PetPooja Daily Report Automation

Pulls the PetPooja daily sales report and appends it to a Google Sheet on a
schedule, unattended. Report date is always **yesterday**; the sheet gets a
`Reports` tab for data and a `Logs` tab for run history.

## Pick one path — not both

This repo holds two implementations of the same job. Run one.

### Path A — Google Apps Script *(recommended default)*

No GCP project, no billing, no deployment pipeline. Credentials live in Script
Properties, encrypted at rest.

- Code: `apps-script/` (`main.gs`, `auth.gs`, `config.gs`, `download.gs`, `sheets.gs`)
- Start here: [`docs/apps-script-setup-overview.md`](docs/apps-script-setup-overview.md)
- Click-by-click: [`docs/apps-script-setup-steps.md`](docs/apps-script-setup-steps.md)

### Path B — Google Cloud Function

Python on Cloud Functions, triggered by Pub/Sub from Cloud Scheduler. Needs a
GCP project with billing enabled. Use this only if you need it to run
independently of a Google account's Apps Script quota.

- Code: `cloud-function/` (`main.py`, `deploy.sh`, `requirements.txt`)
- Deploy from Cloud Shell: [`docs/cloud-function-deploy-via-cloud-shell.md`](docs/cloud-function-deploy-via-cloud-shell.md)
- Manual deploy: [`docs/cloud-function-deploy.md`](docs/cloud-function-deploy.md)

## Currently live

> **Not yet recorded.** Set this line to Path A or Path B so future work
> changes the right one. Until it says which, assume neither is authoritative.

## Configuration

No credential is stored in this repository. It is public — keep it that way.

**Path A** reads Script Properties: `PETPOOJA_EMAIL`, `PETPOOJA_PASSWORD`,
`SHEET_ID`, `NOTIFICATION_EMAIL`.

**Path B** reads environment variables of the same names. Export them before
deploying; `deploy.sh` refuses to run without them:

```bash
export SHEET_ID='your-sheet-id'
export PETPOOJA_EMAIL='your-petpooja-login'
export PETPOOJA_PASSWORD='your-petpooja-password'
export NOTIFICATION_EMAIL='alerts-go-here'
./cloud-function/deploy.sh
```

## Known gaps

- Secrets reach the Cloud Function as plain env vars. Secret Manager is the
  next step.
- `deploy.sh` grants `roles/editor` and `--allow-unauthenticated` on a
  Pub/Sub-triggered function — both wider than required.
