#!/bin/bash
#
# Deploys the PetPooja report function to Google Cloud.
#
# Credentials are stored in Secret Manager, prompted for at deploy time.
# They are never written to this repository or passed on the command line.

set -euo pipefail

PROJECT_ID="centering-oxide-457800-p2"
FUNCTION_NAME="petpooja-daily-report"
REGION="us-central1"
RUNTIME="python311"
SHEET_ID="11_U8uBU2A6nbfCeBLsZaxi_AbLWA1TXkWVTMVWLzbnI"
PUBSUB_TOPIC="petpooja-trigger"
SCHEDULER_JOB="petpooja-daily-9am"
SERVICE_ACCOUNT="petpooja-function@${PROJECT_ID}.iam.gserviceaccount.com"

echo "=========================================="
echo "PetPooja Cloud Function Deployment"
echo "=========================================="
echo "Project:  $PROJECT_ID"
echo "Function: $FUNCTION_NAME"
echo "Region:   $REGION"
echo ""

gcloud config set project "$PROJECT_ID" --quiet

echo "[1/7] Enabling required APIs (this can take a minute)..."
gcloud services enable \
  cloudfunctions.googleapis.com \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  eventarc.googleapis.com \
  pubsub.googleapis.com \
  cloudscheduler.googleapis.com \
  secretmanager.googleapis.com \
  sheets.googleapis.com \
  --project="$PROJECT_ID"
echo "APIs enabled"
echo ""

echo "[2/7] Creating Pub/Sub topic..."
gcloud pubsub topics create "$PUBSUB_TOPIC" --project="$PROJECT_ID" --quiet 2>/dev/null \
  || echo "Topic already exists"
echo ""

echo "[3/7] Creating service account..."
gcloud iam service-accounts create petpooja-function \
  --display-name="PetPooja Report Function" \
  --project="$PROJECT_ID" --quiet 2>/dev/null \
  || echo "Service account already exists"
echo ""

echo "[4/7] Storing credentials in Secret Manager..."
echo "      (input is hidden and is not saved to shell history or git)"
read -r -p "PetPooja email: " PP_EMAIL
read -r -s -p "PetPooja password: " PP_PASSWORD
echo ""

for secret in petpooja-email petpooja-password; do
  gcloud secrets create "$secret" --replication-policy=automatic \
    --project="$PROJECT_ID" --quiet 2>/dev/null || true
done

printf '%s' "$PP_EMAIL"    | gcloud secrets versions add petpooja-email \
  --data-file=- --project="$PROJECT_ID" --quiet
printf '%s' "$PP_PASSWORD" | gcloud secrets versions add petpooja-password \
  --data-file=- --project="$PROJECT_ID" --quiet
unset PP_PASSWORD
echo "Secrets stored"
echo ""

echo "[5/7] Granting permissions..."
for secret in petpooja-email petpooja-password; do
  gcloud secrets add-iam-policy-binding "$secret" \
    --member="serviceAccount:${SERVICE_ACCOUNT}" \
    --role="roles/secretmanager.secretAccessor" \
    --project="$PROJECT_ID" --quiet >/dev/null
done
echo "Secret access granted"
echo ""

echo "[6/7] Deploying Cloud Function..."
gcloud functions deploy "$FUNCTION_NAME" \
  --gen2 \
  --runtime "$RUNTIME" \
  --trigger-topic "$PUBSUB_TOPIC" \
  --entry-point download_petpooja_report \
  --service-account "$SERVICE_ACCOUNT" \
  --region "$REGION" \
  --timeout 300 \
  --memory 256MB \
  --set-env-vars "SHEET_ID=${SHEET_ID}" \
  --source . \
  --project "$PROJECT_ID" \
  --quiet
echo "Function deployed"
echo ""

echo "[7/7] Scheduling daily run at 09:00 IST..."
gcloud scheduler jobs delete "$SCHEDULER_JOB" \
  --location="$REGION" --project="$PROJECT_ID" --quiet 2>/dev/null || true

gcloud scheduler jobs create pubsub "$SCHEDULER_JOB" \
  --location="$REGION" \
  --schedule="0 9 * * *" \
  --time-zone="Asia/Kolkata" \
  --topic="$PUBSUB_TOPIC" \
  --message-body='{"trigger":"daily"}' \
  --project="$PROJECT_ID" \
  --quiet
echo "Scheduler created"
echo ""

echo "=========================================="
echo "DEPLOYMENT COMPLETE"
echo "=========================================="
echo ""
echo "STILL REQUIRED - the job will not write any data until these are done:"
echo ""
echo "  1. Share the Google Sheet with the service account as an Editor:"
echo "     ${SERVICE_ACCOUNT}"
echo "     https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit"
echo ""
echo "  2. Verify the PetPooja scraping actually works. The login URL, form"
echo "     fields and table parsing in main.py are unverified guesses:"
echo "     python3 main.py"
echo ""
echo "Logs: https://console.cloud.google.com/functions/details/${REGION}/${FUNCTION_NAME}?project=${PROJECT_ID}"
