# Google Cloud Function Deployment Guide - Phone Friendly

**Time needed:** ~10 minutes on phone
**Your Project ID:** `530982326426`
**Your Sheet ID:** `11_U8uBU2A6nbfCeBLsZaxi_AbLWA1TXkWVTMVWLzbnI`

---

## Step 1: Create Service Account (Gives Cloud Function Permission to Access Your Sheet)

1. Open Google Cloud Console on your phone:
   - Go to: https://console.cloud.google.com/
   - Sign in with: jain.shubhamjain98@gmail.com

2. Click the **hamburger menu** (≡) top left
3. Go to **IAM & Admin** → **Service Accounts**
4. Click **Create Service Account** (top)
5. Fill in:
   - **Service account name:** `petpooja-report-function`
   - **Service account ID:** (auto-fills)
   - Click **Create and Continue**

6. Grant roles:
   - Click **Grant this service account access to project**
   - Add role: Search for and select **Editor**
   - Click **Continue** → **Done**

7. Back on Service Accounts page:
   - Click on the service account you just created
   - Go to **Keys** tab (top)
   - Click **Add Key** → **Create new key**
   - Choose **JSON**
   - This downloads a JSON file to your phone
   - **Keep this file safe!** (You'll need it soon)

---

## Step 2: Set Up Cloud Function

1. In Google Cloud Console:
   - Click hamburger menu (≡)
   - Go to **Cloud Functions**
   - Click **Create Function**

2. Configure the function:
   - **Environment:** Python 3.11
   - **Function name:** `petpooja-daily-report`
   - **Trigger type:** Cloud Pub/Sub
   - **Trigger topic:** Create a new topic
     - Name: `petpooja-trigger`
     - Click **Create Topic**
   - Click **Save**

3. Now click **Next** at the bottom

---

## Step 3: Add Code to Cloud Function

1. In the code editor, you'll see:
   - **main.py** (on the left)
   - **requirements.txt** (on the left)

2. **Replace main.py:**
   - Select all code in main.py
   - Delete it
   - Copy this code from GitHub: https://raw.githubusercontent.com/shubham838495/Shubham/claude/in-it-agtoyp/cloud_function_main.py
   - Paste it into main.py

3. **Replace requirements.txt:**
   - Select all code in requirements.txt
   - Delete it
   - Copy this code from GitHub: https://raw.githubusercontent.com/shubham838495/Shubham/claude/in-it-agtoyp/requirements.txt
   - Paste it into requirements.txt

4. Click **Deploy** (bottom)
   - Wait 2-3 minutes for deployment to complete
   - You should see a green checkmark

---

## Step 4: Set Up Automatic Scheduling (Cloud Scheduler)

This makes the function run every day at 9 AM!

1. In Google Cloud Console:
   - Click hamburger menu (≡)
   - Go to **Cloud Scheduler**
   - Click **Create Job** (top)

2. Configure the job:
   - **Name:** `petpooja-daily-9am`
   - **Frequency:** `0 9 * * *` (9 AM every day, UTC timezone)
   - **Timezone:** Click and select your timezone (Asia/Kolkata for India)
   - Click **Continue**

3. Set execution:
   - **Execution settings:** Cloud Pub/Sub
   - **Topic:** `petpooja-trigger` (select from dropdown)
   - **Message body:** `{"trigger": "daily"}`
   - Click **Create**

✅ **Done!** Your Cloud Function will now run every day at 9 AM!

---

## Step 5: Test the Function

1. In Google Cloud Console:
   - Go back to **Cloud Functions**
   - Click on `petpooja-daily-report`
   - Click the **Testing** tab
   - Click **Trigger** (creates a test event)

2. Wait 30 seconds and check:
   - Go to your Google Sheet: https://docs.google.com/spreadsheets/d/11_U8uBU2A6nbfCeBLsZaxi_AbLWA1TXkWVTMVWLzbnI/edit
   - You should see 1-2 rows of data added to the "Reports" sheet!
   - Check the "Logs" sheet for execution details

If you see data:
✅ **Everything works! You're done!**

If you see errors:
- Check the "Logs" sheet for the error message
- Common issues:
  - Wrong credentials stored
  - PetPooja website structure changed
  - Network timeout (try again in a few minutes)

---

## Step 6: Monitor Execution

Every day at 9 AM:
1. Your Google Sheet will get new data automatically
2. Check the "Logs" sheet to confirm it ran
3. If something fails, you'll get an email alert

---

## What's Running Now

✅ **Cloud Function:** `petpooja-daily-report`
- Runs Python code to download reports
- Uses your Google Sheet API permissions
- Completely serverless (no PC needed)

✅ **Cloud Scheduler:** `petpooja-daily-9am`
- Triggers function every day at 9 AM
- Sends signal to function via Pub/Sub

✅ **Your Google Sheet:** `PetPooja Daily Reports`
- Reports sheet: Gets new data daily
- Logs sheet: Tracks all executions

---

## Troubleshooting

### "Permission denied" error?
- Make sure the service account has Editor role
- Go to **IAM & Admin** → **IAM**
- Check that the service account appears with "Editor" role

### "No data appearing"?
1. Check the "Logs" sheet for error messages
2. Try testing the function manually again
3. Verify PetPooja login works (try logging in manually)

### Function not triggering at 9 AM?
- Check **Cloud Scheduler** job is **ENABLED** (toggle should be ON)
- Verify the timezone is correct

### Still having issues?
- Check the Cloud Function logs:
  - Go to Cloud Functions
  - Click on your function
  - Click **Logs** tab
  - Look for error messages

---

## Cost

✅ **Completely FREE**
- Google Cloud free tier includes:
  - 2 million function invocations/month
  - This automation uses ~1-2 invocations/month (once daily)
  - Cloud Scheduler is also free for up to 3 jobs
  - No charges will occur

---

## That's It! 🎉

Your PetPooja reports now download automatically every day at 9 AM directly to your Google Sheet!

No PC needed. No manual work. Completely automated and running in the cloud!

**Questions?** Check the Logs sheet in your Google Sheet for detailed execution history.
