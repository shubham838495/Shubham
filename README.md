# PetPooja daily report → Google Sheets

Goal: get the PetPooja **All Restaurant Sales Report** into a Google Sheet
every day, dated and appended, without keeping a PC on.

## What we learned (important)

Automating the PetPooja **login** was tried and **abandoned on purpose**. The
login is protected by server-side form-tamper detection. An automated login
attempt returns:

> **"Form tampering detected. Admin may disable your account."**

So automating the login risks getting the PetPooja account **suspended**. We do
not do it. (For the record: the password is sent as plain text — the page's
client-side encryption is commented out — but the tamper protection blocks
scripted logins regardless, and a headless browser would face the same wall
plus possible OTP.)

## The approach that is safe and works

Do **not** touch the login. Instead, get the report **file** into Gmail, and
let a Google Apps Script file it into the sheet automatically.

The report reaches Gmail one of two ways:

1. **Best — PetPooja emails it automatically.** Ask PetPooja support to enable
   a scheduled daily email of the report (or API access). If they do, the whole
   thing is hands-off.
2. **Fallback — you forward it.** Once a day you open the report and tap
   **Excel**, then share that file to your own Gmail.

Either way, [`gmail_to_sheet.gs`](gmail_to_sheet.gs) runs on a timer, finds the
new report email, reads the Excel/CSV attachment, and appends the rows to the
sheet with the report date.

## Setup

The step-by-step is in the header comment of
[`gmail_to_sheet.gs`](gmail_to_sheet.gs). In short:

1. Google Sheet → **Extensions → Apps Script**, paste in `gmail_to_sheet.gs`.
2. In Gmail, make a label **PetpoojaReport** and a filter that applies it to the
   report emails.
3. In Apps Script, enable the **Drive** advanced service (needed to read `.xlsx`).
4. Run `ingestReports` once to authorize, then add a daily time trigger.

Sheet: `11_U8uBU2A6nbfCeBLsZaxi_AbLWA1TXkWVTMVWLzbnI`

No PetPooja credentials are stored anywhere in this project.
