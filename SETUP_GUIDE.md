# PetPooja Daily Report Automation - Setup Guide

## Overview
This guide will help you set up automated daily downloads of PetPooja sales reports to Google Sheets.

**What this does:**
- Every day at 9:00 AM, downloads your restaurant sales report from PetPooja
- Automatically appends the data to a Google Sheet
- Adds a "Report Date" column to track which day's data it is
- Sends error alerts to your email if something fails

---

## Step 1: Create a Google Sheet

1. Go to [Google Sheets](https://sheets.google.com)
2. Click "Create new spreadsheet" → Name it **"PetPooja Daily Reports"**
3. Add the following columns in the first row (A1 onwards):
   - A1: `Report Date` (the date this report was generated)
   - B1: `Restaurants` (restaurant name)
   - C1: `Invoice Nos.` (invoice numbers)
   - D1: `Total` (total amount)
   - E1: `Min.` (minimum amount)
   - F1+: Any other columns from your report

4. **Copy the Sheet URL** - You'll need it later
   - Format: `https://docs.google.com/spreadsheets/d/SHEET_ID/edit#gid=0`
   - Copy just the **SHEET_ID** part (the long string between `/d/` and `/edit`)

---

## Step 2: Set Up Google Apps Script

### 2a. Open Apps Script Editor

1. Go back to your Google Sheet
2. Click **Extensions** → **Apps Script**
3. You should see a blank editor with `Code.gs` file

### 2b. Create the Script Files

Delete the existing `Code.gs` and create 5 new files:

1. Click the **+** next to "Files" on the left
2. Select **New file** → **Script** → Name it `config.gs`
3. Repeat 4 times for: `auth.gs`, `download.gs`, `sheets.gs`, `main.gs`

### 2c. Copy Code Into Each File

Copy the contents from this repository's files into your Apps Script editor:

- **config.gs** → Copy from `/home/user/Shubham/config.gs`
- **auth.gs** → Copy from `/home/user/Shubham/auth.gs`
- **download.gs** → Copy from `/home/user/Shubham/download.gs`
- **sheets.gs** → Copy from `/home/user/Shubham/sheets.gs`
- **main.gs** → Copy from `/home/user/Shubham/main.gs`

### 2d. Store Your Credentials

1. In Apps Script editor, click **Project Settings** (gear icon on left)
2. Scroll to **Script Properties**
3. Add these properties:
   - **Key**: `PETPOOJA_EMAIL` | **Value**: `jain.shubhamjain98@gmail.com`
   - **Key**: `PETPOOJA_PASSWORD` | **Value**: `Shubham@8384954929`
   - **Key**: `SHEET_ID` | **Value**: [Paste the SHEET_ID you copied earlier]
   - **Key**: `NOTIFICATION_EMAIL` | **Value**: `jain.shubhamjain98@gmail.com`

⚠️ **Security Note**: These credentials are encrypted at rest in Google's servers. They are NOT stored in your code or visible to others who view the script.

---

## Step 3: Test the Script

1. In Apps Script editor, select **runDailyReport** from the function dropdown (top)
2. Click the **Run** button (▶)
3. First time will ask for permissions - Click **Review Permissions** → **Allow**
4. Watch the Execution Log at the bottom

**Expected results:**
- Script runs successfully (green checkmark)
- One row appears in your Google Sheet with today's report data
- A "Logs" sheet is created automatically with execution details

---

## Step 4: Set Up Daily Trigger

1. In Apps Script editor, click **Triggers** (clock icon on left)
2. Click **Create new trigger** (bottom right)
3. Set the following:
   - **Function to execute**: `runDailyReport`
   - **Deployment**: `Head`
   - **Event source**: `Time-driven`
   - **Type of time interval**: `Day timer`
   - **Time of day**: `9:00 AM - 10:00 AM`
   - **Failure notification**: `Notify me hourly`

4. Click **Save**

✅ **Done!** Your automation is now active.

---

## Step 5: Verify It's Working

### First Check (immediate)
- Your Google Sheet should have 1-2 rows of data
- The "Logs" sheet should show your test run

### Daily Check (over next few days)
1. Every day at 9 AM, check your Google Sheet
2. New rows should appear automatically
3. "Report Date" column shows the correct date

### Troubleshooting

**No data appearing?**
- Check the "Logs" sheet for error messages
- Verify SHEET_ID is correct in Script Properties
- Verify credentials are correct

**Getting emails about failures?**
- Check the Logs sheet for the specific error
- Common issues:
  - PetPooja website changed (check if you can still login manually)
  - Wrong credentials stored
  - Network timeout (script retries automatically)

**Want to disable temporarily?**
- Go to Triggers → Click the three dots → Turn off

---

## Important Notes

### Credentials Security
✅ Credentials stored in Google Apps Script Properties (encrypted)
✅ NOT visible in the code
✅ Can't be accessed by others who view your script
❌ Do NOT commit passwords to GitHub

### What Gets Uploaded to GitHub
Only the code templates - NO credentials:
- `config.gs` (without your SHEET_ID)
- `auth.gs` (without passwords)
- `download.gs`
- `sheets.gs`
- `main.gs`
- `SETUP_GUIDE.md` (this file)

### File Storage
Everything runs in Google Cloud:
- Google Apps Script (free tier covers this use)
- Google Sheets (free tier covers this use)
- Your computer doesn't need to be on

### Costs
✅ Completely FREE
- Google Apps Script: Free tier
- Google Sheets: Free tier
- No servers to pay for

---

## Need Help?

Check the "Logs" sheet in your Google Sheet for detailed execution logs.

Each run logs:
- ✅ Success (date downloaded, rows added)
- ❌ Error (specific error message)

---

## Next Steps

1. ✅ Complete steps 1-5 above
2. ✅ Verify data appears after 24 hours
3. ✅ Monitor the Logs sheet daily for the first week
4. ✅ If everything works, you're done! It runs automatically forever

Congratulations! Your PetPooja reports now download automatically every day! 🎉
