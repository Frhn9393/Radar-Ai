const USERS_KEY = 'stockradar:telegram:users:v1';

function getRedisConfig() {
    const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
    return url && token ? { url: url.replace(/\/+$/, ''), token } : null;
}

async function redisCommand(command) {
    const config = getRedisConfig();
    if (!config) throw new Error('Telegram user storage is not configured');

    const response = await fetch(config.url, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${config.token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(command)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.error) {
        throw new Error(payload.error || `KV request failed (${response.status})`);
    }
    return payload.result;
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

    // Keep the interaction log useful while never logging message text or bot tokens.
    console.info('[telegram-user] interaction', JSON.stringify(user));
    if (!getRedisConfig()) return { recorded: true, persisted: false };

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
}

async function listTelegramUsers() {
    if (!getRedisConfig()) return { available: false, users: [] };
    const result = await redisCommand(['HGETALL', USERS_KEY]);
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

module.exports = { getRedisConfig, listTelegramUsers, normalizeTelegramUser, recordTelegramUser };
