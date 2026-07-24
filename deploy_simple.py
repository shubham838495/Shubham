#!/usr/bin/env python3
"""
Simple Cloud Function Deployment Script
Deploys the petpooja report function to Google Cloud
"""

import subprocess
import sys
import os

def run_command(cmd, description):
    """Run a shell command and return success status"""
    print(f"\n{description}...")
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        if result.returncode == 0:
            print(f"✓ {description} successful")
            return True
        else:
            print(f"✗ Error: {result.stderr}")
            return False
    except Exception as e:
        print(f"✗ Exception: {e}")
        return False

def main():
    print("=" * 50)
    print("PetPooja Cloud Function Deployment")
    print("=" * 50)

    # Configuration
    project_id = "centering-oxide-457800-p2"
    function_name = "petpooja-daily-report"
    region = "us-central1"
    topic = "petpooja-trigger"
    service_account = "petpooja-function@530982326426.iam.gserviceaccount.com"

    print(f"\nProject: {project_id}")
    print(f"Function: {function_name}")
    print(f"Region: {region}")

    # Step 1: Set project
    if not run_command(f"gcloud config set project {project_id}", "[1/2] Setting project"):
        sys.exit(1)

    # Step 2: Deploy function
    deploy_cmd = (
        f"gcloud functions deploy {function_name} "
        f"--runtime python311 "
        f"--trigger-topic {topic} "
        f"--entry-point download_petpooja_report "
        f"--service-account {service_account} "
        f"--region {region} "
        f"--timeout 300 "
        f"--memory 256MB "
        f"--allow-unauthenticated "
        f"--source . "
        f"--project {project_id} "
        f"--quiet"
    )

    if not run_command(deploy_cmd, "[2/2] Deploying Cloud Function"):
        sys.exit(1)

    print("\n" + "=" * 50)
    print("✓ DEPLOYMENT COMPLETE!")
    print("=" * 50)
    print(f"\nFunction deployed: {function_name}")
    print(f"Region: {region}")
    print(f"Trigger: Pub/Sub topic '{topic}'")
    print(f"\nDaily reports will run at 9 AM IST")
    print(f"Check your Google Sheet for data!")
    print("=" * 50)

if __name__ == "__main__":
    main()
