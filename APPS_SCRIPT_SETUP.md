# Google Apps Script Setup - Computer Guide

**Time needed:** ~15 minutes
**Best on:** Computer (laptop/desktop)
**Your Sheet ID:** `11_U8uBU2A6nbfCeBLsZaxi_AbLWA1TXkWVTMVWLzbnI`

---

## Step 1: Open Your Google Sheet on Computer

1. Go to: https://docs.google.com/spreadsheets/d/11_U8uBU2A6nbfCeBLsZaxi_AbLWA1TXkWVTMVWLzbnI/edit
2. Make sure you see your "PetPooja Daily Reports" sheet

---

## Step 2: Open Google Apps Script Editor

1. Click **Extensions** (top menu)
2. Click **Apps Script**
3. A new tab will open with Google Apps Script editor

---

## Step 3: Create Script Files

You should see a `Code.gs` file. Delete it first:

1. Right-click `Code.gs` on the left panel
2. Click **Delete**
3. Click the **+ (plus icon)** next to "Files"
4. Click **Script**
5. Name it `config.gs` → Click **Create**

Repeat 4 more times to create:
- `auth.gs`
- `download.gs`
- `sheets.gs`
- `main.gs`

Now you should have 5 files in your editor.

---

## Step 4: Copy Code Into Files

For each file below, follow this process:

**A) Get the code from GitHub:**
1. Open this link in a new tab: https://github.com/shubham838495/Shubham/tree/claude/in-it-agtoyp
2. Click on each `.gs` file
3. Click the **Copy** button (top right of code)

**B) Paste into Apps Script:**
1. Switch to your Apps Script tab
2. Click the filename in left panel (e.g., `config.gs`)
3. Delete all existing code (Ctrl+A, then Delete)
4. Paste the code you copied

**Repeat for all 5 files:**

### File 1: config.gs
- GitHub: https://github.com/shubham838495/Shubham/blob/claude/in-it-agtoyp/config.gs
- Copy the code → Paste into `config.gs` in Apps Script

### File 2: auth.gs
- GitHub: https://github.com/shubham838495/Shubham/blob/claude/in-it-agtoyp/auth.gs
- Copy the code → Paste into `auth.gs` in Apps Script

### File 3: download.gs
- GitHub: https://github.com/shubham838495/Shubham/blob/claude/in-it-agtoyp/download.gs
- Copy the code → Paste into `download.gs` in Apps Script

### File 4: sheets.gs
- GitHub: https://github.com/shubham838495/Shubham/blob/claude/in-it-agtoyp/sheets.gs
- Copy the code → Paste into `sheets.gs` in Apps Script

### File 5: main.gs
- GitHub: https://github.com/shubham838495/Shubham/blob/claude/in-it-agtoyp/main.gs
- Copy the code → Paste into `main.gs` in Apps Script

---

## Step 5: Store Your Credentials

This is important for security! Your email/password will be encrypted.

1. In Apps Script editor, click **Project Settings** (gear icon on left)
2. Scroll down to **Script Properties**
3. Click **Add script property**
4. Add these 4 properties:

### Property 1:
- **Key:** `PETPOOJA_EMAIL`
- **Value:** `jain.shubhamjain98@gmail.com`
- Click **Add property**

### Property 2:
- **Key:** `PETPOOJA_PASSWORD`
- **Value:** `Shubham@8384954929`
- Click **Add property**

### Property 3:
- **Key:** `SHEET_ID`
- **Value:** `11_U8uBU2A6nbfCeBLsZaxi_AbLWA1TXkWVTMVWLzbnI`
- Click **Add property**

### Property 4:
- **Key:** `NOTIFICATION_EMAIL`
- **Value:** `jain.shubhamjain98@gmail.com`
- Click **Add property**

✅ Your credentials are now securely stored and encrypted!

---

## Step 6: Test the Script

1. In Apps Script editor, find the function dropdown (top center, currently says "Select function")
2. Click it and select **runDailyReport**
3. Click the **Run** (▶) button
4. First time: Click **Review Permissions** → **Allow**
5. Watch the Execution Log at the bottom

**Expected result:**
- Green checkmark ✅ in Execution Log
- No errors
- Go back to your Google Sheet - you should see 1-2 rows of data added!
- A "Logs" sheet should appear automatically

If you see errors, check:
- ❌ Wrong Sheet ID? (copy from Step 5 Property 3)
- ❌ Wrong password? (verify in Script Properties)
- ❌ PetPooja website changed? (try logging in manually first)

---

## Step 7: Set Up Daily Trigger

This makes it run automatically every day at 9 AM!

1. In Apps Script editor, click **Triggers** (clock icon on left)
2. Click **Create new trigger** (bottom right)
3. In the popup, set these options:

| Setting | Value |
|---------|-------|
| **Choose which function to run** | `runDailyReport` |
| **Choose which deployment should run** | `Head` |
| **Select event source** | `Time-driven` |
| **Select type of time based trigger** | `Day timer` |
| **Select time of day** | `9:00 AM - 10:00 AM` |
| **Failure notification settings** | `Notify me hourly` |

4. Click **Save**

✅ **Done!** Your automation is now active!

---

## Step 8: Verify It's Working

### Check 1 (Right now):
- Go back to your Google Sheet
- You should see data in the "Reports" sheet
- Check the "Logs" sheet for execution details

### Check 2 (Tomorrow):
- At 9 AM, new data should appear automatically
- Check "Logs" sheet to confirm it ran

### Check 3 (If something fails):
- Email will be sent to `jain.shubhamjain98@gmail.com`
- Check "Logs" sheet for error details

---

## Troubleshooting

### "Authorization required" error?
- Click **Review Permissions** → **Allow**
- Re-run the script

### No data appearing?
1. Check Script Properties - make sure all 4 properties are set correctly
2. Check Logs sheet for error message
3. Try running `testReportDownload()` function to test

### "SHEET_ID is undefined" error?
- You forgot to add SHEET_ID to Script Properties
- Go back to Step 5 and add all 4 properties

### "Authentication failed" error?
- Double-check email and password in Script Properties
- Try logging into PetPooja manually to verify credentials work

---

## What Happens Now

✅ Every day at 9:00 AM:
1. Script automatically logs into PetPooja
2. Downloads yesterday's sales report
3. Adds it to your Google Sheet with the date
4. Logs the result to "Logs" sheet
5. Emails you if anything fails

✅ Your computer doesn't need to be on - it runs in Google Cloud!

✅ Check your Google Sheet daily to see new data appearing automatically!

---

## That's It! 🎉

You now have fully automated PetPooja reports! 

**Questions?** Check the Logs sheet in your Google Sheet for detailed execution history.
