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

const TELEGRAM_COMMANDS = [
    { command: 'start', description: 'Mulai bot dan lihat daftar perintah' },
    { command: 'radar', description: 'Ringkasan seluruh rekomendasi screener (Master Radar)' },
    { command: 'users', description: 'Daftar pengguna unik (admin saja)' },
    { command: 'news', description: 'Berita akuisisi/merger terbaru hari ini' },
    { command: 'screener', description: 'Rekomendasi Swing Trade' },
    { command: 'bsjp', description: 'Screener Beli Sore Jual Pagi' },
    { command: 'bpjp', description: 'Screener Beli Pagi Jual Sore' },
    { command: 'scalping', description: 'Screener scalping' },
    { command: 'daytrade', description: 'Screener intraday dan momentum' },
    { command: 'help', description: 'Tampilkan daftar perintah' }
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
