# Ops Mechanic — go-live runbook

Everything runs on Cloudflare's free tier. Total cost: the domain only (~₹1,000/year).

Do the steps in order. Steps 1–3 put the site online. Steps 4–5 give you a working
`shubham@opsmechanic.com`. Step 6 is the contact-form API and can wait.

## Layout

```
opsmechanic/
├── public/        ← this is what gets published to the web
└── worker/        ← the contact-form API, deployed separately, NOT published
```

Keep that separation. If `worker/` ever ends up inside `public/`, your API source
code becomes downloadable at `opsmechanic.com/worker/index.js`.

| In `public/` | What it is |
|---|---|
| `index.html` | The whole site — one page, no build step |
| `manifest.json` | Makes it installable on phones (PWA) |
| `sw.js` | Service worker — offline support |
| `_headers` | Security headers + caching rules (Cloudflare Pages reads this) |
| `robots.txt`, `sitemap.xml` | Search engines |
| `icon-*.png`, `favicon.*`, `apple-touch-icon.png` | App and tab icons |
| `og-image.png` | Link preview card for WhatsApp / LinkedIn |

---

## Step 1 — Publish the site from GitHub

Connect Pages to the repo rather than uploading files by hand. Then every change
that gets pushed goes live by itself, and you never have to move files around.

Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** →
**Connect to Git**

| Field | Value |
|---|---|
| Repository | `shubham838495/Shubham` |
| Project name | `opsmechanic` |
| Production branch | the branch this work is on |
| Framework preset | **None** |
| Build command | *leave empty* |
| Build output directory | `opsmechanic/public` |

**Save and Deploy.** First deploy takes about a minute. You get a
`opsmechanic.pages.dev` URL — open it and check the site renders before going further.

> The build output directory is the one field people get wrong. It must be
> `opsmechanic/public`, not `public` and not `/`.

## Step 2 — Point the domain at it

Still in the Pages project → **Custom domains** → **Set up a domain**

Add both, one at a time:
- `opsmechanic.com`
- `www.opsmechanic.com`

Cloudflare writes the DNS records itself because the domain is registered in the
same account. HTTPS certificates are issued automatically — usually 2–5 minutes,
occasionally up to 15. Until then you may see a certificate warning; that is
expected, not a mistake.

## Step 3 — Turn on DNSSEC

**opsmechanic.com** → **DNS** → **Settings** → **Enable DNSSEC**

Because the domain is registered at Cloudflare, it completes the registry side
itself. Nothing to copy anywhere. It stops anyone from forging DNS answers for
your domain — a 10-second job worth doing.

---

## Step 4 — Receiving mail at shubham@opsmechanic.com

Cloudflare Email Routing is free and unlimited, but **receive-only**. It forwards
to an inbox you already own. Sending is Step 5.

**opsmechanic.com** → **Email** → **Email Routing** → **Get started**

1. **Destination address** — add your Gmail. Cloudflare emails it a verification
   link. Click it, or nothing will route.
2. **DNS records** — Cloudflare offers to add the MX and SPF records for you.
   Let it. Do not hand-type MX records.
3. **Custom addresses** — create:
   | Address | Action |
   |---|---|
   | `shubham@opsmechanic.com` | Send to your Gmail |
   | `hello@opsmechanic.com` | Send to your Gmail |
   | Catch-all | Send to your Gmail |

   The catch-all means a client who guesses `info@` or `contact@` still reaches
   you instead of bouncing. `hello@` is there because it was the address on the
   site before — keep it alive so old links don't break.

Test it: email `shubham@opsmechanic.com` from your phone. It should land in Gmail
within seconds.

## Step 5 — Sending as shubham@opsmechanic.com from Gmail

Receiving alone isn't enough. If a client emails `shubham@opsmechanic.com` and you
reply from a `@gmail.com` address, the professional domain has worked against you.

Gmail can send through an external SMTP relay. Resend's free tier covers this
(3,000 emails/month, 100/day, 3 domains) and you need a Resend account anyway for
Step 6, so one account does both jobs.

### 5a — Verify the domain in Resend

1. Sign up at **resend.com**
2. **Domains** → **Add Domain** → enter `opsmechanic.com`

   Add the **root domain**, not a subdomain. Resend's rule is that you may only
   send from an address at whatever you verified — verify `send.opsmechanic.com`
   and you can never send as `shubham@opsmechanic.com`.
3. Resend shows a **Records** tab listing DKIM and SPF records to add in
   Cloudflare DNS.

   > **The one thing that can break your email:** Resend normally puts its MX
   > record on a `send.opsmechanic.com` subdomain, which sits alongside Email
   > Routing without touching it. Read the Records tab carefully. If it ever
   > asks you to put an MX record on the bare `opsmechanic.com`, stop — that
   > would overwrite the Email Routing MX records and kill your incoming mail.
   > Never delete or replace the apex MX records from Step 4.

   For any record shown as a **CNAME**, leave the Cloudflare proxy **off** (grey
   cloud, not orange). Resend says so explicitly and proxying breaks verification.
4. Verification is usually under 15 minutes.

### 5b — Add a DMARC record

Cloudflare DNS → **Add record**

| Type | Name | Content |
|---|---|---|
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:shubham@opsmechanic.com` |

`p=none` means "monitor, don't block" — the safe starting setting. It tells
receiving servers you're paying attention, which helps you stay out of spam
folders, and sends you reports on who is sending mail as your domain.

### 5c — Wire it into Gmail

Resend → **API Keys** → create one with **Sending access**. Copy it; it's shown once.

Gmail → **Settings** → **See all settings** → **Accounts and Import** →
*Send mail as* → **Add another email address**

| Field | Value |
|---|---|
| Name | Shubham Jain |
| Email address | `shubham@opsmechanic.com` |
| Treat as an alias | leave ticked |
| SMTP Server | `smtp.resend.com` |
| Port | `587` |
| Username | `resend` |
| Password | your Resend API key |
| Secured connection | **TLS** |

Gmail sends a confirmation code to `shubham@opsmechanic.com`. Thanks to Step 4
that arrives in the same Gmail inbox — click the link in it.

Then set it as default: *Send mail as* → **make default**, and set
*"Reply from the same address the message was sent to"*.

You now send and receive as `shubham@opsmechanic.com` from the Gmail you already use.

> `resend` is the literal username — not your email, not your account name.

---

## Step 6 — Contact form API (can wait)

The site's form posts to `/api/enquiry`. Until this is deployed the form falls
back to showing a copyable message block, so the site is not broken without it.

```bash
cd opsmechanic/worker
npx wrangler login

# create the database, then paste the printed id into wrangler.toml
npx wrangler d1 create opsmechanic
npx wrangler d1 execute opsmechanic --remote --file=./schema.sql

npx wrangler secret put RESEND_API_KEY     # same key as Step 5c
npx wrangler deploy
```

Once the domain is verified in Resend, set `FROM_EMAIL = "shubham@opsmechanic.com"`
in `wrangler.toml` and redeploy. Until then it stays `onboarding@resend.dev`,
which works but looks like a test.

Read the enquiries:

```bash
npx wrangler d1 execute opsmechanic --remote \
  --command="SELECT created_at, name, business, email, phone, need FROM enquiries ORDER BY created_at DESC LIMIT 20"
```

Every enquiry is stored in D1 *and* emailed. The email is attempted even if the
database write fails, so an enquiry is never silently lost.

> MailChannels used to be the free option for Workers and no longer is — that's
> why this uses Resend.

---

## Checks after deploying

- [ ] `https://opsmechanic.com` loads with a padlock
- [ ] `https://www.opsmechanic.com` redirects or loads too
- [ ] Looks right on a phone
- [ ] Dark mode works (switch your phone theme)
- [ ] Email to `shubham@opsmechanic.com` arrives in Gmail
- [ ] Reply from Gmail shows `shubham@opsmechanic.com` as the sender, with no
      "via" or "on behalf of" in the header
- [ ] Submit the form → confirm the row appears in D1
- [ ] Android Chrome offers "Install app"; iOS Safari → Share → Add to Home Screen
- [ ] Paste the link in WhatsApp → preview card shows

## Still to add

Three things were left out rather than shipped as placeholders, because an empty
bracket on a live page looks worse than an absent row:

| Missing | Where |
|---|---|
| Phone / WhatsApp | Contact section — row removed |
| Outlets overseen, region, years in F&B | Credentials panel — rows removed |

**Privacy policy:** it lists the business as *Shubham Jain, Jaipur, Rajasthan,
India* — deliberately the city, not a residential address. Have a CA or lawyer
read the policy before accepting real client data. It is written for Indian law
and references the DPDP Act 2023, but it is a template, and the client
confidentiality clause matters most.

## Costs

| Item | Cost |
|---|---|
| Domain | ~₹1,000/year |
| Pages, Workers, D1, Email Routing, SSL, DNSSEC | ₹0 |
| Resend (under 3,000 emails/month) | ₹0 |

Free tier ceilings: 100,000 Worker requests/day, 500 Pages builds/month,
5 GB D1 storage, 100 Resend emails/day. Static page views are unlimited and
don't count against anything.

**Using a different domain later?** Find and replace `opsmechanic.com` across
`public/index.html`, `public/robots.txt`, `public/sitemap.xml` and
`worker/wrangler.toml`.
