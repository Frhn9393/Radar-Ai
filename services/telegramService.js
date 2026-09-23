async function sendTelegramMessage(chatId, message) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token || !chatId) return false;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    try {
        const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: String(message || '').slice(0, 4096),
                disable_web_page_preview: true
            }),
            signal: controller.signal
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || result.ok === false) {
            throw new Error(result.description || `Telegram API HTTP ${response.status}`);
        }
        return true;
    } finally {
        clearTimeout(timeout);
    }
}

async function sendTelegramAlert(message) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
    if (!token || !adminChatId) {
        return false;
    }
    return sendTelegramMessage(adminChatId.toString(), message);
}

module.exports = { sendTelegramAlert, sendTelegramMessage };
