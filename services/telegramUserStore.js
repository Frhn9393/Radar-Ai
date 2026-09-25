const USERS_KEY = 'stockradar:telegram:users:v1';
const REDIS_TIMEOUT_MS = 2500;

function getRedisConfig() {
    const url = String(process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '').trim();
    const token = String(process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '').trim();
    if (!url || !token) return null;
    try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'https:' || !parsed.hostname) return null;
        return { url: parsed.toString().replace(/\/+$/, ''), token };
    } catch {
        return null;
    }
}

async function redisCommand(command) {
    const config = getRedisConfig();
    if (!config) throw new Error('Telegram user storage is not configured');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REDIS_TIMEOUT_MS);
    try {
        const response = await fetch(config.url, {
            method: 'POST', signal: controller.signal,
            headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(command)
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload.error) throw new Error(payload.error || `KV request failed (${response.status})`);
        return payload.result;
    } catch (error) {
        throw new Error(`KV request failed: ${error?.message || 'unknown error'}`);
    } finally {
        clearTimeout(timer);
    }
}

function normalizeTelegramUser(message) {
    const user = message?.from;
    if (!user || user.id === undefined || user.id === null) return null;
    const receivedAt = Number(message.date);
    const interactionAt = Number.isFinite(receivedAt) && receivedAt > 0
        ? new Date(receivedAt * 1000).toISOString()
        : new Date().toISOString();
    return {
        userId: String(user.id),
        username: String(user.username || '').trim(),
        firstName: String(user.first_name || '').trim(),
        lastName: String(user.last_name || '').trim(),
        lastInteractionAt: interactionAt
    };
}

async function recordTelegramUser(message) {
    const user = normalizeTelegramUser(message);
    if (!user) return { recorded: false, persisted: false };

    if (!getRedisConfig()) return { recorded: true, persisted: false };

    return withRedisTimeout((async () => {
    const previous = await redisCommand(['HGET', USERS_KEY, user.userId]);
    let priorRecord = {};
    if (typeof previous === 'string') {
        try { priorRecord = JSON.parse(previous); } catch { priorRecord = {}; }
    }
    const record = {
        ...priorRecord,
        ...user,
        firstInteractionAt: priorRecord.firstInteractionAt || user.lastInteractionAt
    };
    await redisCommand(['HSET', USERS_KEY, user.userId, JSON.stringify(record)]);
    return { recorded: true, persisted: true, user: record };
    })());
}

async function listTelegramUsers() {
    if (!getRedisConfig()) return { available: false, users: [] };
    const result = await withRedisTimeout(redisCommand(['HGETALL', USERS_KEY]));
    if (!Array.isArray(result)) return { available: true, users: [] };

    const users = [];
    for (let i = 0; i + 1 < result.length; i += 2) {
        try {
            const user = JSON.parse(result[i + 1]);
            if (user && String(user.userId) === String(result[i])) users.push(user);
        } catch { /* Ignore malformed records rather than failing the admin command. */ }
    }
    users.sort((a, b) => String(b.lastInteractionAt).localeCompare(String(a.lastInteractionAt)));
    return { available: true, users };
}

function withRedisTimeout(promise) {
    let timer;
    return Promise.race([
        promise,
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`Redis operation timed out after ${REDIS_TIMEOUT_MS}ms`)), REDIS_TIMEOUT_MS); })
    ]).finally(() => clearTimeout(timer));
}

module.exports = { getRedisConfig, listTelegramUsers, normalizeTelegramUser, recordTelegramUser };
