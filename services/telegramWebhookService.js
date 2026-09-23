const { runScreener } = require('./screenerService');

const seenUpdateIds = new Map();
const MAX_SEEN_UPDATES = 2000;

function isDuplicateTelegramUpdate(updateId) {
    if (updateId === undefined || updateId === null) return false;
    const key = String(updateId);
    if (seenUpdateIds.has(key)) return true;
    seenUpdateIds.set(key, Date.now());
    if (seenUpdateIds.size > MAX_SEEN_UPDATES) {
        const oldestKey = seenUpdateIds.keys().next().value;
        seenUpdateIds.delete(oldestKey);
    }
    return false;
}

async function sendTelegramMessage(chatId, text) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token || !chatId) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    try {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
            signal: controller.signal
        });
    } finally { clearTimeout(timeout); }
}

async function processTelegramUpdate(update) {
    const message = update?.message || update?.edited_message;
    const chatId = message?.chat?.id;
    const text = String(message?.text || '').trim();
    if (!chatId || !text) return;

    const configuredAdminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
    if (configuredAdminChatId && chatId.toString() !== configuredAdminChatId.toString()) {
        console.warn('[telegram-webhook] ignored command from non-admin chat', chatId.toString());
        return;
    }

    if (/^\/screener(?:@\w+)?$/i.test(text)) {
        const result = await runScreener();
        const picks = (result.swing || []).slice(0, 3).map(item => `$${item.ticker} | Rp ${Number(item.price).toLocaleString('id-ID')} | R:R ${item.riskReward}`).join('\n');
        await sendTelegramMessage(chatId, `STOCKRADAR AI · Screener Swing\n${picks || 'Belum ada rekomendasi yang lolos filter.'}`);
        return;
    }
    if (/^\/(start|help)(?:@\w+)?$/i.test(text)) {
        await sendTelegramMessage(chatId, 'Perintah tersedia: /screener untuk ringkasan rekomendasi swing terbaru.');
    }
}

module.exports = { isDuplicateTelegramUpdate, processTelegramUpdate };
