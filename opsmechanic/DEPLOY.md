# Ops Mechanic — deploy guide

Everything here runs on Cloudflare's free tier. Total cost: the domain only.

## Files

| File | What it is |
|---|---|
| `index.html` | The whole site — one page, no build step |
| `manifest.json` | Makes it installable on phones (PWA) |
| `sw.js` | Service worker — offline support |
| `_headers` | Security headers + caching rules (Cloudflare Pages reads this) |
| `robots.txt`, `sitemap.xml` | Search engines |
| `icon-*.png`, `favicon.*`, `apple-touch-icon.png` | App and tab icons |
| `og-image.png` | Link preview card for WhatsApp / LinkedIn |
| `worker/` | The contact-form API |

---

## Step 1 — Register the domain

Cloudflare dashboard → **Domain Registration** → **Register Domain** → `opsmechanic.com`
1 year, WHOIS privacy on, auto-renew on. ~$11.17.

**Using a different domain?** Find and replace `opsmechanic.com` across
`index.html`, `robots.txt`, `sitemap.xml` and `worker/wrangler.toml` before deploying.

## Step 2 — Put the site up

**Workers & Pages** → **Create** → **Pages** → **Upload assets**

Drag in everything **except the `worker/` folder**. Name the project `opsmechanic`.

Then **Custom domains** → add `opsmechanic.com` and `www.opsmechanic.com`.
HTTPS is issued automatically within a few minutes.

> Later, connect a GitHub repo instead of uploading, and every push deploys itself.

## Step 3 — Email address

**Email Routing** → enable → add `hello@opsmechanic.com` → forward to your Gmail.
Cloudflare adds the DNS records for you. Free, unlimited addresses.

## Step 4 — Contact form API

```bash
cd worker
npx wrangler login

# create the database, then paste the printed id into wrangler.toml
npx wrangler d1 create opsmechanic
npx wrangler d1 execute opsmechanic --remote --file=./schema.sql

npx wrangler deploy
```

The form now stores every enquiry in D1. To read them:

```bash
npx wrangler d1 execute opsmechanic --remote \
  --command="SELECT created_at, name, business, email, phone, need FROM enquiries ORDER BY created_at DESC LIMIT 20"
```

## Step 5 — Email notifications (optional)

Without this, enquiries are stored but you must check the database. To get emailed:

1. Sign up at **resend.com** (free: 3,000 emails/month)
2. Create an API key
3. ```bash
   npx wrangler secret put RESEND_API_KEY
   ```
4. Verify `opsmechanic.com` in Resend, then set `FROM_EMAIL = "hello@opsmechanic.com"`
   in `wrangler.toml` and redeploy. Until verified, leave it as `onboarding@resend.dev`.

> MailChannels used to be the free option for Workers and no longer is — that's why this uses Resend.

---

## Still to add

The site is complete and deployable. Three things were left out rather than
shipped as placeholders, because an empty bracket on a live page looks worse
than an absent row:

| Missing | Where |
|---|---|
| Phone / WhatsApp | Contact section — row removed |
| LinkedIn | Contact section — row removed |
| Outlets overseen, region, years in F&B | Credentials panel — rows removed |

Add them back once the real values are known.

**Privacy policy:** it lists the business as *Shubham Jain, Jaipur, Rajasthan,
India* — deliberately the city, not a residential address. Have a CA or lawyer
read the policy before accepting real client data. It is written for Indian law
and references the DPDP Act 2023, but it is a template, and the client
confidentiality clause matters most.

## Checks after deploying

- [ ] `https://opsmechanic.com` loads with a padlock
- [ ] Looks right on a phone
- [ ] Dark mode works (switch your phone theme)
- [ ] Submit the form → confirm the row appears in D1
- [ ] Email to `hello@` arrives in Gmail
- [ ] Android Chrome offers "Install app"; iOS Safari → Share → Add to Home Screen
- [ ] Paste the link in WhatsApp → preview card shows

## Costs

| Item | Cost |
|---|---|
| Domain | ~₹1,000/year |
| Pages, Workers, D1, Email Routing, SSL | ₹0 |
| Resend (under 3,000 emails/month) | ₹0 |

Free tier ceilings: 100,000 Worker requests/day, 500 Pages builds/month,
5 GB D1 storage. Static page views are unlimited and don't count.
