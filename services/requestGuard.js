const { createHash } = require('crypto');
const { getRedisConfig } = require('./telegramUserStore');

const localWindows = new Map();
const RATE_LIMIT_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
if count > tonumber(ARGV[2]) then return 0 end
return 1
`;

function isSameOriginRequest(req) {
    const origin = String(req?.get?.('origin') || '').trim();
    const host = String(req?.get?.('host') || '').trim().toLowerCase();
    if (!origin || !host) return false;
    try {
        const parsed = new URL(origin);
        return (parsed.protocol === 'https:' || parsed.protocol === 'http:') && parsed.host.toLowerCase() === host;
    } catch {
        return false;
    }
}

function getClientIdentity(req) {
    const forwarded = String(req?.get?.('x-forwarded-for') || '').split(',')[0].trim();
    const address = forwarded || req?.ip || req?.socket?.remoteAddress || 'unknown';
    return createHash('sha256').update(String(address)).digest('hex').slice(0, 32);
}

async function allowRateLimitedRequest(req, action, { limit = 5, windowSeconds = 60 } = {}) {
    const window = Math.max(1, Math.floor(Number(windowSeconds) || 60));
    const max = Math.max(1, Math.floor(Number(limit) || 1));
    const bucket = Math.floor(Date.now() / (window * 1000));
    const identity = getClientIdentity(req);
    const redis = getRedisConfig();

    if (redis) {
        const response = await fetch(redis.url, {
            method: 'POST',
            headers: { Authorization: `Bearer ${redis.token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(['EVAL', RATE_LIMIT_SCRIPT, 1, `stockradar:ratelimit:${action}:${identity}:${bucket}`, window, max]),
            signal: AbortSignal.timeout(2500)
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload.error) throw new Error('Rate-limit storage unavailable');
        return Number(payload.result) === 1;
    }

    if (process.env.VERCEL || process.env.NODE_ENV === 'production') throw new Error('Rate-limit storage is not configured');
    const key = `${action}:${identity}:${bucket}`;
    const current = localWindows.get(key) || 0;
    localWindows.set(key, current + 1);
    if (localWindows.size > 1000) {
        for (const storedKey of localWindows.keys()) if (!storedKey.endsWith(`:${bucket}`)) localWindows.delete(storedKey);
    }
    return current < max;
}

module.exports = { isSameOriginRequest, allowRateLimitedRequest };
