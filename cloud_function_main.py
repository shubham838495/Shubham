import functions_framework
import requests
from datetime import datetime, timedelta
from google.oauth2 import service_account
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
import logging
import json
import base64

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration
PETPOOJA_LOGIN_URL = 'https://billing.petpooja.com/users/login'
PETPOOJA_REPORT_URL = 'https://billing.petpooja.com/custom_reports/view_report/9'
SHEET_ID = '11_U8uBU2A6nbfCeBLsZaxi_AbLWA1TXkWVTMVWLzbnI'
REPORT_SHEET_NAME = 'Reports'
LOGS_SHEET_NAME = 'Logs'

# Credentials (from environment variables)
PETPOOJA_EMAIL = 'jain.shubhamjain98@gmail.com'
PETPOOJA_PASSWORD = 'Shubham@8384954929'
NOTIFICATION_EMAIL = 'jain.shubhamjain98@gmail.com'


def get_yesterday_date():
    """Get yesterday's date in YYYY-MM-DD format"""
    yesterday = datetime.now() - timedelta(days=1)
    return yesterday.strftime('%Y-%m-%d')


def log_execution(sheet_service, status, message, details=''):
    """Log execution to Logs sheet"""
    try:
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        body = {
            'values': [[timestamp, status, message, details]]
        }
        sheet_service.spreadsheets().values().append(
            spreadsheetId=SHEET_ID,
            range=f'{LOGS_SHEET_NAME}!A:D',
            valueInputOption='USER_ENTERED',
            body=body
        ).execute()
        logger.info(f'Logged: {status} - {message}')
    except Exception as e:
        logger.error(f'Error logging: {e}')


def authenticate_petpooja():
    """Authenticate with PetPooja"""
    try:
        logger.info('Authenticating with PetPooja...')
        session = requests.Session()

        payload = {
            'email': PETPOOJA_EMAIL,
            'password': PETPOOJA_PASSWORD,
            'remember-me': 'on'
        }

        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }

        response = session.post(PETPOOJA_LOGIN_URL, data=payload, headers=headers, timeout=30)

        if response.status_code in [200, 302]:
            logger.info('Authentication successful')
            return session
        else:
            raise Exception(f'Login failed with status {response.status_code}')
    except Exception as e:
        logger.error(f'Authentication error: {e}')
        raise


def download_report(session, report_date):
    """Download report from PetPooja"""
    try:
        logger.info(f'Fetching report for {report_date}...')

        params = {
            'start_date': report_date,
            'end_date': report_date,
            'order_status': 'Success',
            'outlet': ''
        }

        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }

        response = session.get(PETPOOJA_REPORT_URL, params=params, headers=headers, timeout=30)

        if response.status_code == 200:
            logger.info('Report fetched successfully')
            # Parse HTML to extract table data
            report_data = parse_report_html(response.text)
            return report_data
        else:
            raise Exception(f'Report download failed with status {response.status_code}')
    except Exception as e:
        logger.error(f'Download error: {e}')
        raise


def parse_report_html(html_content):
    """Parse HTML table from report"""
    try:
        import re

        rows = []
        # Find table in HTML
        table_match = re.search(r'<table[^>]*>[\s\S]*?</table>', html_content, re.IGNORECASE)

        if not table_match:
            logger.info('No table found in HTML')
            return []

        table_html = table_match.group(0)
        row_matches = re.findall(r'<tr[^>]*>[\s\S]*?</tr>', table_html, re.IGNORECASE)

        is_header = True
        for row_html in row_matches:
            cells = []
            cell_matches = re.findall(r'<t[dh][^>]*>[\s\S]*?</t[dh]>', row_html, re.IGNORECASE)

            for cell_html in cell_matches:
                cell_text = re.sub(r'<[^>]+>', '', cell_html)
                cell_text = cell_text.replace('&nbsp;', ' ').replace('&amp;', '&').strip()
                cells.append(cell_text)

            # Skip header row
            if is_header and cells and 'restaurant' in cells[0].lower():
                is_header = False
                continue

            # Add data rows
            if not is_header and cells and cells[0].strip():
                rows.append(cells)

        logger.info(f'Extracted {len(rows)} rows from table')
        return rows
    except Exception as e:
        logger.error(f'Parse error: {e}')
        return []


def append_report_to_sheet(sheet_service, report_data, report_date):
    """Append report data to Google Sheet"""
    try:
        if not report_data:
            logger.warning('No data to append')
            return 0

        # Add report date to each row
        data_with_date = []
        for row in report_data:
            data_with_date.append([report_date] + row)

        # Append to sheet
        body = {
            'values': data_with_date
        }

        result = sheet_service.spreadsheets().values().append(
            spreadsheetId=SHEET_ID,
            range=f'{REPORT_SHEET_NAME}!A:E',
            valueInputOption='USER_ENTERED',
            body=body
        ).execute()

        rows_added = result.get('updates', {}).get('updatedRows', 0)
        logger.info(f'Added {rows_added} rows to sheet')
        return rows_added
    except Exception as e:
        logger.error(f'Append error: {e}')
        raise


def get_sheet_service():
    """Get authorized Google Sheets service"""
    try:
        # Use Application Default Credentials
        from google.auth import default
        credentials, project = default(scopes=['https://www.googleapis.com/auth/spreadsheets'])
        service = build('sheets', 'v4', credentials=credentials)
        return service
    except Exception as e:
        logger.error(f'Error getting Sheet service: {e}')
        raise


@functions_framework.http
def download_petpooja_report(request):
    """HTTP Cloud Function to download PetPooja report"""
    try:
        logger.info('=== PetPooja Report Download Started ===')

        # Get sheet service
        sheet_service = get_sheet_service()

        # Get report date (yesterday)
        report_date = get_yesterday_date()
        logger.info(f'Report date: {report_date}')

        # Authenticate with PetPooja
        session = authenticate_petpooja()

        # Download report
        report_data = download_report(session, report_date)

        if not report_data:
            msg = f'No data found for {report_date}'
            log_execution(sheet_service, 'WARNING', 'No Data', msg)
            return {'status': 'warning', 'message': msg}, 200

        # Append to Google Sheet
        rows_added = append_report_to_sheet(sheet_service, report_data, report_date)

        # Log success
        success_msg = f'Added {rows_added} rows for {report_date}'
        log_execution(sheet_service, 'SUCCESS', 'Report Completed', success_msg)

        logger.info('=== PetPooja Report Download Completed ===')
        return {'status': 'success', 'message': success_msg, 'rows_added': rows_added}, 200

    except Exception as e:
        error_msg = str(e)
        logger.error(f'Execution failed: {error_msg}')

        try:
            sheet_service = get_sheet_service()
            log_execution(sheet_service, 'ERROR', 'Execution Failed', error_msg)
        except:
            pass

        return {'status': 'error', 'message': error_msg}, 500
