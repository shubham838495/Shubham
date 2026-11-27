/**
 * Ops Mechanic — contact form API
 * Route: opsmechanic.com/api/enquiry  (POST, JSON)
 *
 * Bindings (see wrangler.toml):
 *   DB              D1 database        — stores every enquiry
 *   RESEND_API_KEY  secret             — optional; without it, enquiries are stored only
 *   TO_EMAIL        var                — where notifications go
 *   FROM_EMAIL      var                — verified sender in Resend
 */

const MAX = { name: 120, business: 160, email: 160, phone: 40, outlets: 20, need: 60, message: 4000 };
const RATE_LIMIT = 5;              // submissions per IP...
const RATE_WINDOW_SECONDS = 3600;  // ...per hour

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });

const clean = (v, max) =>
  typeof v === 'string' ? v.replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, max) : '';

const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname !== '/api/enquiry') return json({ error: 'Not found' }, 404);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204 });
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid JSON' }, 400);
    }

    // Honeypot: real users never fill this field.
    if (clean(body.company2, 50)) return json({ ok: true });

    const data = {
      name: clean(body.name, MAX.name),
      business: clean(body.business, MAX.business),
      email: clean(body.email, MAX.email),
      phone: clean(body.phone, MAX.phone),
      outlets: clean(body.outlets, MAX.outlets),
      need: clean(body.need, MAX.need),
      message: clean(body.message, MAX.message)
    };

    if (!data.name) return json({ error: 'Name is required' }, 400);
    if (!validEmail(data.email)) return json({ error: 'A valid email is required' }, 400);

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const now = Math.floor(Date.now() / 1000);

    if (env.DB) {
      try {
        const { results } = await env.DB
          .prepare('SELECT COUNT(*) AS n FROM enquiries WHERE ip = ? AND created_at > ?')
          .bind(ip, now - RATE_WINDOW_SECONDS)
          .all();
        if (results?.[0]?.n >= RATE_LIMIT) {
          return json({ error: 'Too many enquiries. Please email us directly.' }, 429);
        }

        await env.DB.prepare(
          `INSERT INTO enquiries
             (name, business, email, phone, outlets, need, message, ip, country, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          data.name, data.business, data.email, data.phone,
          data.outlets, data.need, data.message,
          ip, request.cf?.country || '', now
        ).run();
      } catch (err) {
        // Storage failure must not lose the enquiry — fall through to email.
        console.error('D1 write failed:', err);
      }
    }

    if (env.RESEND_API_KEY && env.TO_EMAIL && env.FROM_EMAIL) {
      const text =
`New enquiry — Ops Mechanic

Name:      ${data.name}
Business:  ${data.business || '—'}
Email:     ${data.email}
Phone:     ${data.phone || '—'}
Outlets:   ${data.outlets}
Needs:     ${data.need}

Details:
${data.message || '—'}

---
IP ${ip} · ${request.cf?.country || '??'} · ${new Date(now * 1000).toISOString()}`;

      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: env.FROM_EMAIL,
            to: [env.TO_EMAIL],
            reply_to: data.email,
            subject: `Enquiry: ${data.name}${data.business ? ' — ' + data.business : ''}`,
            text
          })
        });
        if (!res.ok) console.error('Resend failed:', res.status, await res.text());
      } catch (err) {
        console.error('Resend error:', err);
      }
    }

    return json({ ok: true });
  }
};
