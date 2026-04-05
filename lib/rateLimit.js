/**
 * Rate Limiter — in-memory for MVP, Redis-ready for production
 *
 * To upgrade to Upstash Redis:
 * 1. npm install @upstash/redis
 * 2. Add UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN to .env.local
 * 3. Replace MemoryStore with UpstashStore (stub at bottom of file)
 */

const store = new Map();
const DAILY_LIMIT = parseInt(process.env.DAILY_SCAN_LIMIT || '10', 10);

function getRecord(ip) {
  const now = Date.now();
  const record = store.get(ip);
  if (!record || now > record.resetAt) {
    return { count: 0, resetAt: now + 24 * 60 * 60 * 1000 };
  }
  return record;
}

function setRecord(ip, record) {
  store.set(ip, record);
  // Prevent memory leak — clean expired entries every 1000 writes
  if (store.size > 1000) {
    const now = Date.now();
    for (const [key, val] of store.entries()) {
      if (now > val.resetAt) store.delete(key);
    }
  }
}

export function checkRateLimit(ip) {
  const record = getRecord(ip);
  if (record.count >= DAILY_LIMIT) {
    return { allowed: false, remaining: 0, resetAt: record.resetAt, total: DAILY_LIMIT };
  }
  record.count++;
  setRecord(ip, record);
  return { allowed: true, remaining: DAILY_LIMIT - record.count, resetAt: record.resetAt, total: DAILY_LIMIT };
}

export function getRateLimitStatus(ip) {
  const record = getRecord(ip);
  return { used: record.count, remaining: Math.max(0, DAILY_LIMIT - record.count), resetAt: record.resetAt, total: DAILY_LIMIT };
}

export function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}
