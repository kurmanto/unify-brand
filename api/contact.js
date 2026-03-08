export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, email, message } = req.body || {};

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'All fields required' });
  }

  // Basic email format check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email' });
  }

  // Rate limit: simple in-memory (resets on cold start, sufficient for low volume)
  const now = Date.now();
  if (!globalThis._contactTimes) globalThis._contactTimes = [];
  globalThis._contactTimes = globalThis._contactTimes.filter(t => now - t < 60000);
  if (globalThis._contactTimes.length >= 5) {
    return res.status(429).json({ error: 'Too many requests' });
  }
  globalThis._contactTimes.push(now);

  try {
    // Send via Resend if API key is configured
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Unify Labs Site <noreply@unify-labs.dev>',
          to: 'hello@unify-labs.dev',
          reply_to: email,
          subject: `Contact: ${name}`,
          text: `Name: ${name}\nEmail: ${email}\n\n${message}`,
        }),
      });
    } else {
      // Log to Vercel function logs as fallback
      console.log('CONTACT FORM:', JSON.stringify({ name, email, message, timestamp: new Date().toISOString() }));
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Contact form error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
