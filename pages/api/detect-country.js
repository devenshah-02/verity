export default async function handler(req, res) {
  try {
    // Get IP from Vercel headers or fallback
    const ip =
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.headers['x-real-ip'] ||
      req.socket?.remoteAddress ||
      '';

    // Skip loopback IPs (local dev)
    if (!ip || ip === '::1' || ip === '127.0.0.1' || ip.startsWith('192.168.')) {
      return res.status(200).json({ country: 'India', countryCode: 'IN', detected: false });
    }

    const response = await fetch(`https://ipapi.co/${ip}/json/`, {
      headers: { 'User-Agent': 'verity-app/1.0' }
    });

    if (!response.ok) throw new Error('ipapi failed');

    const data = await response.json();

    if (data.error) throw new Error(data.reason || 'lookup failed');

    return res.status(200).json({
      country: data.country_name || 'India',
      countryCode: data.country_code || 'IN',
      detected: true,
    });
  } catch (err) {
    // Always fall back gracefully to India
    return res.status(200).json({ country: 'India', countryCode: 'IN', detected: false });
  }
}
