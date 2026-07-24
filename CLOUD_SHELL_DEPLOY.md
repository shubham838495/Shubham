# Automated Cloud Shell Deployment - 5 Minutes on Phone

**This is the EASIEST way to deploy everything!**

No coding needed. Just copy-paste and click a button. Works on phone. ✅

---

## What You're Doing

You'll open Google Cloud Shell (browser terminal) and run a script that:
1. Creates a service account ✓
2. Deploys the Cloud Function ✓
3. Sets up daily 9 AM scheduler ✓
4. Configures all permissions ✓

**Time:** ~5 minutes
**Requirements:** Just your phone + Google account

---

## Step-by-Step

### Step 1: Open Google Cloud Shell

1. On your phone, open this link:
   ```
   https://cloud.google.com/console/cloudshell
   ```

2. Sign in with: `jain.shubhamjain98@gmail.com`

3. You should see a terminal with a prompt like:
   ```
   user@cloudshell:~ $
   ```

### Step 2: Download the Code

Copy and paste this command in the Cloud Shell terminal:

```bash
cd /tmp && git clone https://github.com/shubham838495/Shubham.git && cd Shubham && git checkout claude/in-it-agtoyp
```

Press **Enter** and wait for it to complete (~30 seconds)

### Step 3: Run the Deployment Script

Copy and paste this command:

```bash
bash deploy_cloud_function.sh
```

Press **Enter** and watch it deploy! 🚀

The script will show progress:
- [1/6] Setting Google Cloud project...
- [2/6] Creating Pub/Sub topic...
- [3/6] Creating service account...
- [4/6] Granting permissions...
- [5/6] Deploying Cloud Function...
- [6/6] Setting up daily scheduler...

### Step 4: Wait for Completion

The script takes ~2-3 minutes. You'll see:
```
✓ DEPLOYMENT COMPLETE!
```

When you see this message, **EVERYTHING IS DONE!** ✅

---

## Step 5: Verify It Works

1. Go to your Google Sheet:
   ```
   https://docs.google.com/spreadsheets/d/11_U8uBU2A6nbfCeBLsZaxi_AbLWA1TXkWVTMVWLzbnI/edit
   ```

2. Wait 1-2 minutes

3. You should see data appearing in the "Reports" sheet! 

4. Check the "Logs" sheet to see execution details

---

## That's It! 🎉

Your automation is now running in Google Cloud!

✅ Cloud Function deployed
✅ Scheduler configured (9 AM daily)
✅ Google Sheet connected
✅ Logs tracking enabled

---

## What Happens Now

**Every day at 9:00 AM IST:**
1. Cloud Function runs automatically
2. Logs into PetPooja
3. Downloads yesterday's report
4. Adds data to your Google Sheet
5. Logs the execution

**Your phone doesn't need to be on.** Everything runs in the cloud!

---

## Troubleshooting

### Got an error during deployment?
- If it says "Permission denied" - wait 1 minute and run the script again
- If it says "Already exists" - that's OK, it means it's already deployed
- Check the error message and let me know

### No data appearing after 24 hours?
1. Check the "Logs" sheet for error messages
2. Verify your PetPooja credentials are correct
3. Try manually testing: Go to Cloud Console → Cloud Functions → Click the function → Click "Testing" tab → Click "Trigger"

### Want to check logs?
Go to: https://console.cloud.google.com/functions/details/us-central1/petpooja-daily-report?project=530982326426

---

## Cost: $0

Everything is FREE:
- Google Cloud Functions: 2M invocations free/month
- Cloud Scheduler: First 3 jobs free
- You'll use only 1-2 invocations/month (one per day)

**No charges will occur.**

---

**Ready?** Open Cloud Shell and follow the 5 steps above!

Questions? Let me know! 🚀
