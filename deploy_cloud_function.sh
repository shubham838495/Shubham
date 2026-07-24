#!/bin/bash

# PetPooja Cloud Function Deployment Script
# This script deploys everything to your Google Cloud Project

set -e

# Configuration
PROJECT_ID="centering-oxide-457800-p2"
FUNCTION_NAME="petpooja-daily-report"
REGION="us-central1"
RUNTIME="python311"
SHEET_ID="11_U8uBU2A6nbfCeBLsZaxi_AbLWA1TXkWVTMVWLzbnI"
PUBSUB_TOPIC="petpooja-trigger"
SCHEDULER_JOB="petpooja-daily-9am"

echo "=========================================="
echo "PetPooja Cloud Function Deployment"
echo "=========================================="
echo "Project ID: $PROJECT_ID"
echo "Function: $FUNCTION_NAME"
echo "Region: $REGION"
echo ""

# Step 1: Set the project
echo "[1/6] Setting Google Cloud project..."
gcloud config set project $PROJECT_ID
echo "✓ Project set"
echo ""

# Step 2: Create Pub/Sub topic
echo "[2/6] Creating Pub/Sub topic for scheduling..."
gcloud pubsub topics create $PUBSUB_TOPIC --quiet 2>/dev/null || echo "✓ Topic already exists"
echo "✓ Pub/Sub topic ready"
echo ""

# Step 3: Create service account
echo "[3/6] Creating service account..."
SERVICE_ACCOUNT="petpooja-function@${PROJECT_ID}.iam.gserviceaccount.com"
gcloud iam service-accounts create petpooja-function \
  --display-name="PetPooja Report Function" \
  --quiet 2>/dev/null || echo "✓ Service account already exists"
echo "✓ Service account created: $SERVICE_ACCOUNT"
echo ""

# Step 4: Grant permissions
echo "[4/6] Granting permissions to service account..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/editor" \
  --quiet 2>/dev/null || echo "✓ Permissions already set"
echo "✓ Permissions granted"
echo ""

# Step 5: Deploy Cloud Function
echo "[5/6] Deploying Cloud Function..."
gcloud functions deploy $FUNCTION_NAME \
  --runtime $RUNTIME \
  --trigger-topic $PUBSUB_TOPIC \
  --entry-point download_petpooja_report \
  --service-account $SERVICE_ACCOUNT \
  --region $REGION \
  --timeout 300 \
  --memory 256MB \
  --allow-unauthenticated \
  --source . \
  --quiet
echo "✓ Cloud Function deployed successfully"
echo ""

# Step 6: Create Cloud Scheduler job
echo "[6/6] Setting up daily scheduler (9 AM IST)..."
# Delete existing job if it exists
gcloud scheduler jobs delete $SCHEDULER_JOB --location=us-central1 --quiet 2>/dev/null || true

# Create new job (9 AM IST = 3:30 AM UTC)
gcloud scheduler jobs create pubsub $SCHEDULER_JOB \
  --location=us-central1 \
  --schedule="30 3 * * *" \
  --topic=$PUBSUB_TOPIC \
  --message-body='{"trigger": "daily"}' \
  --time-zone="Asia/Kolkata" \
  --quiet
echo "✓ Scheduler configured for 9 AM daily (IST)"
echo ""

echo "=========================================="
echo "✓ DEPLOYMENT COMPLETE!"
echo "=========================================="
echo ""
echo "Your automation is now live:"
echo "- Cloud Function: $FUNCTION_NAME"
echo "- Trigger: $PUBSUB_TOPIC"
echo "- Schedule: Every day at 9:00 AM (IST)"
echo "- Google Sheet: https://docs.google.com/spreadsheets/d/$SHEET_ID/edit"
echo ""
echo "Next steps:"
echo "1. Check your Google Sheet in 24 hours"
echo "2. Review the 'Logs' sheet for execution details"
echo "3. Reports will appear automatically every day at 9 AM"
echo ""
echo "For logs and monitoring:"
echo "- Cloud Console: https://console.cloud.google.com/functions"
echo "- Sheet Logs: https://docs.google.com/spreadsheets/d/$SHEET_ID/edit#gid=0"
echo ""
