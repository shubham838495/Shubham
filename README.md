# PetPooja reports → one consolidated Google Sheet + dashboard

Goal: **one** master Google Sheet that PetPooja report data flows into
automatically, keeps **all detail** (so any report can be derived later), plus
**one dashboard** — free, cloud-only, set up with a single paste-and-run script.

## Why not automate the PetPooja login

Automating the PetPooja **login** was tried and **abandoned on purpose**. The
login has server-side tamper detection; a scripted attempt returns
*"Form tampering detected. Admin may disable your account."* — i.e. it risks
**suspending the account**. So we never touch the login.

## How it actually works

PetPooja **already auto-emails** daily report files to the user's Gmail (set up
via PetPooja's *Notification tab*). Currently three arrive every day:

- **Item Wise Report With Bill No.** (`.xlsx`) — from support@petpooja.com
- **Payment Wise Summary** (`.xls`) — from support@petpooja.com
- **Stock / Daily Summary** (`.xls`) — from noreply@petpooja.com

[`petpooja_consolidator.gs`](petpooja_consolidator.gs) reads those emails inside
the user's Google account, so no PetPooja login and no credentials are ever
needed.

## What the script builds (in the master sheet)

Master sheet: **"NBC Vijay Nagar - Daily POS Reports (Item & Payment Wise)"**
(`1gB2E6sdkeHzzOHvcat-PTZyK3RerS1BnyHwlfP4YDRw`).

- `Raw_ItemWise`, `Raw_PaymentWise`, `Raw_StockSummary` — every original column
  preserved, plus `Report Date`, `Outlet`, `Source File`. Full fidelity.
- `Consolidated` — one tidy row per day: total sales, orders, and a column per
  payment mode. The single source for any report.
- `Dashboard` — in-sheet KPIs + charts (daily sales trend, payment split).
- `Logs` — run history.

It also de-dupes (safe to re-run), dates each report from the email body, and
installs its own daily trigger.

## Setup (once, ~3 minutes)

1. Open the master sheet → **Extensions → Apps Script**. Paste
   `petpooja_consolidator.gs`. **Save**.
2. Left panel → **Services** (＋) → add **Drive API**.
3. Reload the sheet → a **PetPooja** menu appears.
4. **PetPooja → Run now (backfill / update)**, approve permissions. Re-run until
   the toast says *0 emails remaining* (history is large; it works in batches).
5. **PetPooja → Install daily auto-update.**

## Dashboard

The in-sheet `Dashboard` tab works immediately. For a richer view, connect
**Looker Studio** (free) to the `Consolidated` tab — see the setup notes shared
in chat.

No PetPooja credentials are stored anywhere in this project.
