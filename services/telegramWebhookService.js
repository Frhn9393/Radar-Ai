const { runScreener } = require('./screenerService');
const { fetch_market_news, fetch_ma_deals } = require('./newsService');
const { sendTelegramMessage, setTelegramCommands } = require('./telegramService');
const { getNewsAlertKey, isStrategicCorporateAction } = require('./newsAlertService');
const { formatJakartaDate, formatJakartaDateTime } = require('./dateTime');
const { listTelegramUsers, recordTelegramUser } = require('./telegramUserStore');

const seenUpdateIds = new Map();
const MAX_SEEN_UPDATES = 2000;
const STRICT_EMPTY_ALERT = 'Stockradar Alert: Saat ini tidak ada emiten yang memenuhi kriteria filter ketat. Disarankan Wait & See.';
const RADAR_BUSY_MESSAGE = '⚠️ Server sedang sibuk mengambil data pasar, silakan coba beberapa saat lagi.';
const RADAR_TIMEOUT_MS = 4500;
const REDIS_OPERATION_TIMEOUT_MS = 2500;
const NEWS_PROVIDER_TIMEOUT_MS = 4000;

function withTimeout(task, timeoutMs, label) {
    let timeout;
    const timedOut = new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
    });
    return Promise.race([Promise.resolve().then(task), timedOut]).finally(() => clearTimeout(timeout));
}

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

function formatRadarSummary(result) {
    const scalpingRows = [
        ...(Array.isArray(result.scalpingSesi1) ? result.scalpingSesi1 : Array.isArray(result.scalping) ? result.scalping : []),
        ...(Array.isArray(result.scalpingSesi2) ? result.scalpingSesi2 : [])
    ];
    const strategies = [
        ['⚡ Scalping / Intraday', scalpingRows],
        ['🚀 Daytrade · Momentum Bullish', result.daytrade],
        ['🌆 BSJP · Beli Sore Jual Pagi', result.bsjp],
        ['🌅 BPJP · Beli Pagi Jual Sore', result.bpjs || result.bpjp],
        ['📈 Swing Trade', result.swing]
    ];
    const sections = strategies.map(([title, rows]) => {
        const formatted = formatScreenerRows(title, rows);
        return formatted === STRICT_EMPTY_ALERT ? `${title}\n• Belum ada sinyal yang memenuhi kriteria.` : formatted;
    });
    const aiRows = Array.isArray(result.candlestickAi) ? result.candlestickAi : [];
    const aiValidation = aiRows[0]?.item?.candlestickAi?.validation;
    const oosLine = Number.isFinite(aiValidation?.observedStrongBuyWinRatePct) && aiValidation.predictedStrongBuySamples > 0
        ? `🧪 Holdout Strong Buy win rate: ${aiValidation.observedStrongBuyWinRatePct}% (n=${aiValidation.predictedStrongBuySamples})`
        : '🧪 Holdout Strong Buy win rate: belum ada sinyal terukur';
    const aiSection = aiRows.length
        ? `🧠 AI Candlestick · probabilitas model (${aiRows.length})\n${oosLine}\n${aiRows.slice(0, 5).map(({ item }) => {
            const ai = item?.candlestickAi || {};
            const confidence = ai.confidencePct !== null && ai.confidencePct !== undefined && Number.isFinite(Number(ai.confidencePct)) ? `${ai.confidencePct}%` : 'belum tervalidasi';
            const target = Number.isFinite(Number(ai.targetPrice)) ? Number(ai.targetPrice).toLocaleString('id-ID') : '—';
            const stop = Number.isFinite(Number(ai.stopLoss)) ? Number(ai.stopLoss).toLocaleString('id-ID') : '—';
            return `• $${item.ticker} · ${ai.decision || 'NEUTRAL'} (${confidence}) · TP ${target} · SL ${stop} · ${(ai.patterns || []).join(', ') || item.candlestick || 'Pola belum terdeteksi'}`;
        }).join('\n')}`
        : `🧠 AI Candlestick · probabilitas model\n${oosLine}\n• Belum ada pola candlestick terdeteksi.`;
    return `🛰️ STOCKRADAR AI · MASTER RADAR\n\n${sections.join('\n\n━━━━━━━━━━━━━━\n\n')}\n\n━━━━━━━━━━━━━━\n\n${aiSection}`;
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

    const isRadarCommand = /^\/radar(?:@\w+)?$/i.test(text);
    const recordUser = dependencies.recordTelegramUser || recordTelegramUser;
    if (isRadarCommand) {
        // User-directory persistence must not consume the screener's serverless response budget.
        withTimeout(() => recordUser(message), REDIS_OPERATION_TIMEOUT_MS, 'Telegram Redis user record').catch(error => {
            console.error('[telegram-user] persistence failed', error.message || error);
        });
    } else {
        try {
            await withTimeout(() => recordUser(message), REDIS_OPERATION_TIMEOUT_MS, 'Telegram Redis user record');
        } catch (error) {
            console.error('[telegram-user] persistence failed', error.message || error);
        }
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
            const directory = await withTimeout(
                () => (dependencies.listTelegramUsers || listTelegramUsers)(),
                REDIS_OPERATION_TIMEOUT_MS,
                'Telegram Redis user list'
            );
            if (!directory?.available) {
                await sendMessage(chatId, 'Daftar pengguna belum tersedia. Penyimpanan pengguna belum terhubung.');
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

    if (/^\/radar(?:@\w+)?$/i.test(text)) {
        const timeoutMs = Number.isFinite(Number(dependencies.radarTimeoutMs)) && Number(dependencies.radarTimeoutMs) > 0
            ? Number(dependencies.radarTimeoutMs) : RADAR_TIMEOUT_MS;
        try {
            const result = safeScreenerResult(await withTimeout(
                () => getScreener({ sendAlerts: false }), timeoutMs, 'Telegram /radar screener'
            ));
            await sendMessage(chatId, formatRadarSummary(result), { timeoutMs: 3000 });
        } catch (error) {
            console.error('[telegram-radar] screener failed', error.message || error);
            try {
                await sendMessage(chatId, RADAR_BUSY_MESSAGE, { timeoutMs: 3000 });
            } catch (sendError) {
                console.error('[telegram-radar] unable to send fallback reply', sendError.message || sendError);
            }
        }
        return;
    }

    if (/^\/news(?:@\w+)?$/i.test(text)) {
        const [marketResult, dealResult] = await Promise.allSettled([
            withTimeout(dependencies.fetchMarketNews || fetch_market_news, NEWS_PROVIDER_TIMEOUT_MS, 'Telegram market news'),
            withTimeout(dependencies.fetchMaDeals || fetch_ma_deals, NEWS_PROVIDER_TIMEOUT_MS, 'Telegram M&A news')
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
            : 'Saat ini belum ada berita atau sentimen akuisisi/merger terbaru di pasar modal.', { timeoutMs: 3000 });
        return;
    }
    if (/^\/(start|help)(?:@\w+)?$/i.test(text)) {
        try {
            await (dependencies.setTelegramCommands || setTelegramCommands)();
        } catch (error) {
            console.warn('[telegram-commands] unable to update bot command menu', error.message || error);
        }
        await sendMessage(chatId, [
            'STOCKRADAR AI · Perintah Bot',
            '/radar — ringkasan seluruh rekomendasi screener (Master Radar)',
            '/news — hingga 5 berita akuisisi/merger terbaru hari ini',
            '/users — daftar pengguna unik (admin saja)',
            '/help — daftar perintah'
        ].join('\n'));
    }
}

module.exports = { isDuplicateTelegramUpdate, processTelegramUpdate, formatRadarSummary, formatScreenerRows, STRICT_EMPTY_ALERT, RADAR_BUSY_MESSAGE };
