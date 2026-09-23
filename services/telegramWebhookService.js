const { runScreener } = require('./screenerService');
const { fetch_market_news, fetch_ma_deals } = require('./newsService');
const { sendTelegramMessage } = require('./telegramService');
const { getNewsAlertKey } = require('./newsAlertService');

const seenUpdateIds = new Map();
const MAX_SEEN_UPDATES = 2000;
const STRICT_EMPTY_ALERT = 'Stockradar Alert: Saat ini tidak ada emiten yang memenuhi kriteria filter ketat. Disarankan Wait & See.';

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
    const safeRows = Array.isArray(rows) ? rows : [];
    const formatPrice = value => Number.isFinite(Number(value)) ? Number(value).toLocaleString('id-ID') : '—';
    const picks = safeRows.slice(0, 3).filter(item => item && typeof item === 'object' && item.ticker).map(item => {
        const target = item.targetProfit ?? item.targetPrice1 ?? item.target;
        const stop = item.stopLoss ?? item.cutLoss;
        const riskReward = item.riskReward ? ` | R:R ${item.riskReward}` : '';
        return `$${item.ticker} | Rp ${formatPrice(item.price)} | TP ${formatPrice(target)} | SL ${formatPrice(stop)}${riskReward}`;
    });
    return picks.length ? `${title}\n${picks.join('\n')}` : STRICT_EMPTY_ALERT;
}

function safeScreenerResult(result) {
    return result && typeof result === 'object' && !Array.isArray(result) ? result : {};
}

async function processTelegramUpdate(update, dependencies = {}) {
    const message = update?.message || update?.edited_message;
    const chatId = message?.chat?.id;
    const text = String(message?.text || '').trim();
    if (!chatId || !text) return;

    const configuredAdminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
    if (configuredAdminChatId && chatId.toString() !== configuredAdminChatId.toString()) {
        console.warn('[telegram-webhook] ignored command from non-admin chat', chatId.toString());
        return;
    }
    const getScreener = dependencies.runScreener || runScreener;

    if (/^\/screener(?:@\w+)?$/i.test(text)) {
        const result = safeScreenerResult(await getScreener());
        await sendTelegramMessage(chatId, formatScreenerRows('STOCKRADAR AI · Screener Swing', result.swing));
        return;
    }
    if (/^\/daytrade(?:@\w+)?$/i.test(text)) {
        const result = safeScreenerResult(await getScreener());
        const daytrade = formatScreenerRows('STOCKRADAR AI · Day Trade', result.daytrade);
        const scalpingSesi1 = formatScreenerRows('Scalping Sesi 1', Array.isArray(result.scalpingSesi1) ? result.scalpingSesi1 : result.scalping);
        const scalpingSesi2 = formatScreenerRows('Scalping Sesi 2', result.scalpingSesi2);
        const sections = [daytrade, scalpingSesi1, scalpingSesi2].filter(message => message !== STRICT_EMPTY_ALERT);
        await sendTelegramMessage(chatId, sections.length ? sections.join('\n\n') : STRICT_EMPTY_ALERT);
        return;
    }
    if (/^\/(bsjp|bpjp|bpjs|scalping|intraday)(?:@\w+)?$/i.test(text)) {
        const command = text.split('@')[0].toLowerCase();
        const result = safeScreenerResult(await getScreener());
        const rows = command === '/bsjp' ? result.bsjp
            : command === '/bpjs' ? (result.bpjs || result.bpjp)
                : command === '/bpjp' ? result.bpjp
                    : command === '/scalping' ? [...(Array.isArray(result.scalpingSesi1) ? result.scalpingSesi1 : []), ...(Array.isArray(result.scalpingSesi2) ? result.scalpingSesi2 : [])]
                        : result.daytrade;
        const title = command === '/bsjp' ? 'STOCKRADAR AI · BSJP'
            : command === '/bpjs' || command === '/bpjp' ? 'STOCKRADAR AI · BPJS/BPJP'
                : command === '/scalping' ? 'STOCKRADAR AI · Scalping'
                    : 'STOCKRADAR AI · Intraday';
        await sendTelegramMessage(chatId, formatScreenerRows(title, rows));
        return;
    }
    if (/^\/news(?:@\w+)?$/i.test(text)) {
        const [marketValue, dealValue] = await Promise.all([fetch_market_news(), fetch_ma_deals()]);
        const market = safeScreenerResult(marketValue);
        const deals = safeScreenerResult(dealValue);
        const combinedNews = [
            ...(Array.isArray(market.news) ? market.news : []).filter(item => item && typeof item === 'object').map(item => ({ ...item, tickers: [item.ticker || 'IHSG'] })),
            ...(Array.isArray(deals.deals) ? deals.deals : []).filter(item => item && typeof item === 'object')
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
            '/screener — rekomendasi Swing Trade',
            '/bsjp — screener Beli Sore Jual Pagi',
            '/bpjs atau /bpjp — screener Beli Pagi Jual Sore',
            '/scalping — screener scalping',
            '/intraday atau /daytrade — screener intraday',
            '/help — daftar perintah'
        ].join('\n'));
    }
}

module.exports = { isDuplicateTelegramUpdate, processTelegramUpdate, formatScreenerRows, STRICT_EMPTY_ALERT };
