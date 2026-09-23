const { runScreener } = require('./screenerService');
const { fetch_market_news, fetch_ma_deals } = require('./newsService');
const { sendTelegramMessage } = require('./telegramService');
const { getNewsAlertKey } = require('./newsAlertService');

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

function formatScreenerRows(title, rows) {
    const formatPrice = value => Number.isFinite(Number(value)) ? Number(value).toLocaleString('id-ID') : '—';
    const picks = (rows || []).slice(0, 3).map(item => {
        const target = item.targetProfit ?? item.targetPrice1 ?? item.target;
        const stop = item.stopLoss ?? item.cutLoss;
        const riskReward = item.riskReward ? ` | R:R ${item.riskReward}` : '';
        return `$${item.ticker} | Rp ${formatPrice(item.price)} | TP ${formatPrice(target)} | SL ${formatPrice(stop)}${riskReward}`;
    });
    return `${title}\n${picks.join('\n') || 'Belum ada rekomendasi yang lolos filter.'}`;
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
        await sendTelegramMessage(chatId, formatScreenerRows('STOCKRADAR AI · Screener Swing', result.swing));
        return;
    }
    if (/^\/daytrade(?:@\w+)?$/i.test(text)) {
        const result = await runScreener();
        const daytrade = formatScreenerRows('STOCKRADAR AI · Day Trade', result.daytrade);
        const scalpingSesi1 = formatScreenerRows('Scalping Sesi 1', result.scalpingSesi1 || result.scalping);
        const scalpingSesi2 = formatScreenerRows('Scalping Sesi 2', result.scalpingSesi2);
        await sendTelegramMessage(chatId, `${daytrade}\n\n${scalpingSesi1}\n\n${scalpingSesi2}`);
        return;
    }
    if (/^\/news(?:@\w+)?$/i.test(text)) {
        const [market, deals] = await Promise.all([fetch_market_news(), fetch_ma_deals()]);
        const combinedNews = [
            ...(market.news || []).map(item => ({ ...item, tickers: [item.ticker || 'IHSG'] })),
            ...(deals.deals || [])
        ].sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
        const seenNews = new Set();
        const latestNews = combinedNews.filter(item => {
            const key = getNewsAlertKey(item);
            if (!key || seenNews.has(key)) return false;
            seenNews.add(key);
            return true;
        }).slice(0, 5);
        const lines = latestNews.map((item, index) => {
            const ticker = item.tickers?.[0] || item.ticker || 'IHSG';
            return `${index + 1}. $${ticker} · ${String(item.title || '').slice(0, 300)}\n${String(item.link || '').slice(0, 400)}`;
        });
        await sendTelegramMessage(chatId, `STOCKRADAR AI · 5 Berita / M&A Terbaru\n\n${lines.join('\n\n') || 'Belum ada berita terbaru.'}`);
        return;
    }
    if (/^\/(start|help)(?:@\w+)?$/i.test(text)) {
        await sendTelegramMessage(chatId, [
            'STOCKRADAR AI · Perintah Bot',
            '/news — 5 berita pasar dan M&A terbaru',
            '/daytrade — rekomendasi Day Trade dan Scalping',
            '/screener — rekomendasi Swing Trade',
            '/help — daftar perintah'
        ].join('\n'));
    }
}

module.exports = { isDuplicateTelegramUpdate, processTelegramUpdate };
