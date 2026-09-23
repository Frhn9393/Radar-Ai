const { runScreener } = require('./screenerService');
const { fetch_market_news, fetch_ma_deals } = require('./newsService');
const { sendTelegramMessage } = require('./telegramService');
const { getNewsAlertKey, isStrategicCorporateAction } = require('./newsAlertService');
const { formatJakartaDate, formatJakartaDateTime } = require('./dateTime');
const { listTelegramUsers, recordTelegramUser } = require('./telegramUserStore');

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
    const sendMessage = dependencies.sendTelegramMessage || sendTelegramMessage;
    if (!chatId) return;

    try {
        await (dependencies.recordTelegramUser || recordTelegramUser)(message);
    } catch (error) {
        console.error('[telegram-user] persistence failed', error.message || error);
    }
    if (!text) return;

    const configuredAdminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
    const isAdmin = Boolean(configuredAdminChatId) && chatId.toString() === configuredAdminChatId.toString();
    if (/^\/users(?:@\w+)?$/i.test(text)) {
        if (!isAdmin) {
            await sendMessage(chatId, 'Maaf, perintah ini hanya tersedia untuk admin bot.');
            return;
        }
        try {
            const directory = await (dependencies.listTelegramUsers || listTelegramUsers)();
            if (!directory?.available) {
                await sendMessage(chatId, 'Penyimpanan pengguna belum dikonfigurasi. Tambahkan KV_REST_API_URL dan KV_REST_API_TOKEN (atau UPSTASH_REDIS_REST_URL dan UPSTASH_REDIS_REST_TOKEN) di Environment Variables Vercel. Interaksi tetap tercatat di log sampai penyimpanan persisten diaktifkan.');
                return;
            }
            const users = Array.isArray(directory.users) ? directory.users : [];
            if (!users.length) {
                await sendMessage(chatId, 'Total pengguna unik: 0\nBelum ada pengguna yang tercatat.');
                return;
            }
            const lines = users.map((user, index) => {
                const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Nama tidak tersedia';
                const username = user.username ? `@${user.username}` : name;
                const lastSeen = user.lastInteractionAt ? formatJakartaDateTime(user.lastInteractionAt) : '-';
                return `${index + 1}. ${username} · ${name} · ID ${user.userId} · ${lastSeen} WIB`;
            });
            const chunks = [];
            let current = `Total pengguna unik: ${users.length}\n\n`;
            for (const line of lines) {
                if (current.length + line.length + 1 > 3500) {
                    chunks.push(current);
                    current = '';
                }
                current += `${line}\n`;
            }
            if (current) chunks.push(current);
            for (const chunk of chunks) await sendMessage(chatId, chunk.trim());
        } catch (error) {
            console.error('[telegram-users] unable to list users', error.message || error);
            await sendMessage(chatId, 'Daftar pengguna belum dapat dimuat. Coba lagi nanti.');
        }
        return;
    }
    const getScreener = dependencies.runScreener || runScreener;

    if (/^\/screener(?:@\w+)?$/i.test(text)) {
        const result = safeScreenerResult(await getScreener());
        await sendMessage(chatId, formatScreenerRows('STOCKRADAR AI · Screener Swing', result.swing));
        return;
    }
    if (/^\/daytrade(?:@\w+)?$/i.test(text)) {
        const result = safeScreenerResult(await getScreener());
        const daytrade = formatScreenerRows('STOCKRADAR AI · Day Trade', result.daytrade);
        const scalpingSesi1 = formatScreenerRows('Scalping Sesi 1', Array.isArray(result.scalpingSesi1) ? result.scalpingSesi1 : result.scalping);
        const scalpingSesi2 = formatScreenerRows('Scalping Sesi 2', result.scalpingSesi2);
        const sections = [daytrade, scalpingSesi1, scalpingSesi2].filter(message => message !== STRICT_EMPTY_ALERT);
        await sendMessage(chatId, sections.length ? sections.join('\n\n') : STRICT_EMPTY_ALERT);
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
        await sendMessage(chatId, formatScreenerRows(title, rows));
        return;
    }
    if (/^\/news(?:@\w+)?$/i.test(text)) {
        const [marketResult, dealResult] = await Promise.allSettled([
            (dependencies.fetchMarketNews || fetch_market_news)(),
            (dependencies.fetchMaDeals || fetch_ma_deals)()
        ]);
        const marketValue = marketResult.status === 'fulfilled' ? marketResult.value : null;
        const dealValue = dealResult.status === 'fulfilled' ? dealResult.value : null;
        const market = safeScreenerResult(marketValue);
        const deals = safeScreenerResult(dealValue);
        const combinedNews = [
            ...(Array.isArray(market.news) ? market.news : []).filter(item => item && typeof item === 'object').map(item => ({ ...item, tickers: [item.ticker || 'IHSG'] })),
            ...(Array.isArray(deals.deals) ? deals.deals : []).filter(item => item && typeof item === 'object')
        ].sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
        const seenNews = new Set();
        const today = formatJakartaDate();
        const strategicToday = combinedNews.filter(item => isStrategicCorporateAction(item) && item.pubDate && formatJakartaDate(item.pubDate) === today);
        const latestNews = strategicToday.filter(item => {
            const key = getNewsAlertKey(item);
            if (!key || seenNews.has(key)) return false;
            seenNews.add(key);
            return true;
        }).slice(0, 5);
        const lines = latestNews.map((item, index) => {
            const ticker = item.tickers?.[0] || item.ticker || 'IHSG';
            return `${index + 1}. $${ticker} · ${String(item.title || '').slice(0, 300)}\n${String(item.link || '').slice(0, 400)}`;
        });
        await sendMessage(chatId, lines.length
            ? `STOCKRADAR AI · Berita Akuisisi / Merger Hari Ini\n\n${lines.join('\n\n')}`
            : 'Saat ini belum ada berita atau sentimen akuisisi/merger terbaru di pasar modal.');
        return;
    }
    if (/^\/(start|help)(?:@\w+)?$/i.test(text)) {
        await sendMessage(chatId, [
            'STOCKRADAR AI · Perintah Bot',
            '/users — daftar pengguna unik (admin saja)',
            '/news — hingga 5 berita akuisisi/merger terbaru hari ini',
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
