"""
PetPooja daily sales report -> Google Sheets.

Triggered by a Cloud Scheduler job publishing to a Pub/Sub topic.

--------------------------------------------------------------------------
IMPORTANT - UNVERIFIED SCRAPING LOGIC
--------------------------------------------------------------------------
The PetPooja login endpoint, form field names, report query parameters and
HTML table structure in this file have NOT been validated against the live
site. They are best guesses. Run `verify_login` (see bottom of this file)
against the real site and correct LOGIN_URL / LOGIN_FIELDS / REPORT_PARAMS
before trusting the scheduled runs.

Until that is done, expect this function to authenticate incorrectly and/or
return zero rows.
--------------------------------------------------------------------------

Credentials are read from Google Secret Manager, never hardcoded. Create them
once with:

    printf '%s' 'your-email' | gcloud secrets create petpooja-email \
        --data-file=- --project=PROJECT_ID
    printf '%s' 'your-password' | gcloud secrets create petpooja-password \
        --data-file=- --project=PROJECT_ID
"""

import logging
import os
import re
from datetime import datetime, timedelta

import functions_framework
import requests
from google.auth import default as google_auth_default
from google.cloud import secretmanager
from googleapiclient.discovery import build

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- Configuration -------------------------------------------------------

LOGIN_URL = "https://billing.petpooja.com/users/login"
REPORT_URL = "https://billing.petpooja.com/custom_reports/view_report/9"

SHEET_ID = os.environ.get("SHEET_ID", "")
REPORT_SHEET_NAME = "Reports"
LOGS_SHEET_NAME = "Logs"

SECRET_EMAIL = "petpooja-email"
SECRET_PASSWORD = "petpooja-password"

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
)

# Field names on the login form. UNVERIFIED - inspect the real form and fix.
LOGIN_FIELDS = {"email": "email", "password": "password"}


# --- Secrets -------------------------------------------------------------


def _project_id():
    pid = os.environ.get("GCP_PROJECT") or os.environ.get("GOOGLE_CLOUD_PROJECT")
    if pid:
        return pid
    _, pid = google_auth_default()
    return pid


def get_secret(secret_id):
    """Read the latest version of a Secret Manager secret."""
    client = secretmanager.SecretManagerServiceClient()
    name = f"projects/{_project_id()}/secrets/{secret_id}/versions/latest"
    response = client.access_secret_version(request={"name": name})
    return response.payload.data.decode("utf-8")


# --- Sheets --------------------------------------------------------------


def get_sheets_service():
    credentials, _ = google_auth_default(
        scopes=["https://www.googleapis.com/auth/spreadsheets"]
    )
    return build("sheets", "v4", credentials=credentials, cache_discovery=False)


def log_to_sheet(service, status, message, details=""):
    """Append a row to the Logs tab. Never raises - logging must not break the run."""
    try:
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        service.spreadsheets().values().append(
            spreadsheetId=SHEET_ID,
            range=f"{LOGS_SHEET_NAME}!A:D",
            valueInputOption="USER_ENTERED",
            body={"values": [[timestamp, status, message, details]]},
        ).execute()
    except Exception as exc:  # noqa: BLE001
        logger.error("Could not write to Logs sheet: %s", exc)


def existing_report_dates(service):
    """Dates already present in column A, used to skip duplicate runs."""
    try:
        result = (
            service.spreadsheets()
            .values()
            .get(spreadsheetId=SHEET_ID, range=f"{REPORT_SHEET_NAME}!A:A")
            .execute()
        )
        rows = result.get("values", [])
        return {row[0] for row in rows if row}
    except Exception as exc:  # noqa: BLE001
        logger.warning("Could not read existing dates: %s", exc)
        return set()


def append_rows(service, rows):
    result = (
        service.spreadsheets()
        .values()
        .append(
            spreadsheetId=SHEET_ID,
            range=f"{REPORT_SHEET_NAME}!A:Z",
            valueInputOption="USER_ENTERED",
            body={"values": rows},
        )
        .execute()
    )
    return result.get("updates", {}).get("updatedRows", 0)


# --- PetPooja ------------------------------------------------------------


def login():
    """Authenticate and return a requests.Session carrying the cookies."""
    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT})

    payload = {
        LOGIN_FIELDS["email"]: get_secret(SECRET_EMAIL),
        LOGIN_FIELDS["password"]: get_secret(SECRET_PASSWORD),
    }

    response = session.post(LOGIN_URL, data=payload, timeout=30)
    response.raise_for_status()

    # A 200 does not prove success - many sites re-render the login form on
    # bad credentials. Treat a password field in the response as a failure.
    if re.search(r"type=[\"']password[\"']", response.text, re.IGNORECASE):
        raise RuntimeError(
            "Login appears to have failed - the response still contains a "
            "password field. Check credentials and LOGIN_FIELDS."
        )

    return session


def fetch_report(session, report_date):
    """Fetch the report page for a single day and return parsed rows."""
    params = {
        "start_date": report_date,
        "end_date": report_date,
        "order_status": "Success",
        "outlet": "",
    }
    response = session.get(REPORT_URL, params=params, timeout=60)
    response.raise_for_status()
    return parse_table(response.text)


def parse_table(html):
    """Extract data rows from the first <table> in the report page."""
    table = re.search(r"<table[^>]*>.*?</table>", html, re.IGNORECASE | re.DOTALL)
    if not table:
        logger.warning("No <table> found in report response")
        return []

    rows = []
    for row_html in re.findall(
        r"<tr[^>]*>.*?</tr>", table.group(0), re.IGNORECASE | re.DOTALL
    ):
        cells = []
        for cell_html in re.findall(
            r"<t[dh][^>]*>.*?</t[dh]>", row_html, re.IGNORECASE | re.DOTALL
        ):
            text = re.sub(r"<[^>]+>", "", cell_html)
            text = text.replace("&nbsp;", " ").replace("&amp;", "&").strip()
            cells.append(text)

        if not cells or not any(cells):
            continue
        # Skip the header row.
        if "restaurant" in cells[0].lower():
            continue
        rows.append(cells)

    return rows


# --- Entry point ---------------------------------------------------------


def run():
    """Download yesterday's report and append it to the sheet."""
    if not SHEET_ID:
        raise RuntimeError("SHEET_ID environment variable is not set")

    service = get_sheets_service()
    report_date = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
    logger.info("Report date: %s", report_date)

    if report_date in existing_report_dates(service):
        message = f"Data for {report_date} already present, skipping"
        logger.info(message)
        log_to_sheet(service, "SKIPPED", "Duplicate date", message)
        return message

    try:
        session = login()
        rows = fetch_report(session, report_date)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Report download failed")
        log_to_sheet(service, "ERROR", "Download failed", str(exc))
        raise

    if not rows:
        message = f"No rows returned for {report_date}"
        logger.warning(message)
        log_to_sheet(service, "WARNING", "No data", message)
        return message

    dated = [[report_date] + row for row in rows]
    added = append_rows(service, dated)

    message = f"Added {added} rows for {report_date}"
    logger.info(message)
    log_to_sheet(service, "SUCCESS", "Report appended", message)
    return message


@functions_framework.cloud_event
def download_petpooja_report(cloud_event):
    """Pub/Sub entry point. Cloud Scheduler publishes to the trigger topic."""
    run()


def verify_login():
    """
    Diagnostic helper. Run this against the live site before trusting the
    scheduled job.

    Prints the login status, whether a password field is still present
    (a strong sign login failed) and the first few parsed table rows, so you
    can compare against what the browser shows.
    """
    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT})

    payload = {
        LOGIN_FIELDS["email"]: get_secret(SECRET_EMAIL),
        LOGIN_FIELDS["password"]: get_secret(SECRET_PASSWORD),
    }
    login_response = session.post(LOGIN_URL, data=payload, timeout=30)
    still_showing_form = bool(
        re.search(r"type=[\"']password[\"']", login_response.text, re.IGNORECASE)
    )
    print(f"login status={login_response.status_code} url={login_response.url}")
    print(f"password field still present: {still_showing_form}")

    report_date = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
    report_response = session.get(
        REPORT_URL,
        params={
            "start_date": report_date,
            "end_date": report_date,
            "order_status": "Success",
            "outlet": "",
        },
        timeout=60,
    )
    print(
        f"report status={report_response.status_code} "
        f"bytes={len(report_response.content)}"
    )
    rows = parse_table(report_response.text)
    print(f"parsed rows: {len(rows)}")
    for row in rows[:3]:
        print(row)
    return f"parsed {len(rows)} rows"


if __name__ == "__main__":
    verify_login()
