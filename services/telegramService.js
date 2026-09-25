async function sendTelegramMessage(chatId, message, options = {}) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token || !chatId) return false;

    const controller = new AbortController();
    const timeoutMs = Number.isFinite(Number(options.timeoutMs)) && Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : 7000;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
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

const TELEGRAM_COMMANDS = [
    { command: 'radar', description: 'Ringkasan seluruh rekomendasi screener (Master Radar)' },
    { command: 'news', description: 'Berita akuisisi & merger terbaru hari ini' },
    { command: 'users', description: 'Daftar pengguna unik (Khusus Admin)' },
    { command: 'help', description: 'Tampilkan menu bantuan ini' }
];

async function setTelegramCommands() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return false;
    const response = await fetch(`https://api.telegram.org/bot${token}/setMyCommands`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ commands: TELEGRAM_COMMANDS })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.ok === false) throw new Error(result.description || `Telegram API HTTP ${response.status}`);
    return true;
}

module.exports = { sendTelegramAlert, sendTelegramMessage, setTelegramCommands, TELEGRAM_COMMANDS };
