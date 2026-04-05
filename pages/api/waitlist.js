/**
 * Waitlist email capture
 * MVP: logs to Vercel function logs (visible in dashboard)
 * Upgrade: swap storage block for Resend, Mailchimp, or Supabase
 */

const waitlist = [];

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email } = req.body;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  const entry = {
    email: email.toLowerCase().trim(),
    timestamp: new Date().toISOString(),
    ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown',
  };

  if (!waitlist.find(e => e.email === entry.email)) {
    waitlist.push(entry);
  }

  // Vercel logs every signup — check at vercel.com/logs
  console.log(`[WAITLIST] ${entry.email} at ${entry.timestamp}`);

  // ── TO ADD RESEND (free 3000 emails/month at resend.com) ─────────────────
  // npm install resend → add RESEND_API_KEY to env
  // const { Resend } = require('resend');
  // await new Resend(process.env.RESEND_API_KEY).emails.send({
  //   from: 'Verity <hello@verity.so>',
  //   to: entry.email,
  //   subject: "You're on the Verity Pro waitlist",
  //   html: '<p>We\'ll notify you the moment Pro launches. — Team Verity</p>',
  // });
  // ─────────────────────────────────────────────────────────────────────────

  return res.status(200).json({ success: true });
}
