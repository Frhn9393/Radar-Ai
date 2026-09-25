const { waitUntil } = require('@vercel/functions');
const { sendTelegramAlert } = require('./telegramService');
const { claimAlert, releaseAlert } = require('./alertDedupeStore');

const notifiedNews = new Map();
const DEDUPE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_DEDUPE_ITEMS = 3000;
let missingConfigLogged = false;

function getNewsAlertKey(item) {
    const title = String(item?.title || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 100);
    if (title) return title;
    const link = String(item?.link || '').trim().toLowerCase();
    if (link) return link;
    return '';
}

function isStrategicCorporateAction(item) {
    const content = `${item?.title || ''} ${item?.summary || ''}`;
    return /\b(?:akuisisi|acquisitions?|mergers?|pengambilalihan|tender\s+offers?|buybacks?|divestasi|rights?\s+issues?)\b/i.test(content);
}

function isAutomaticNewsAlert(item) {
    const content = `${item?.title || ''} ${item?.summary || ''}`;
    return /\b(?:akuisisi|mengakuisisi|diakuisisi|acquisitions?|acquire[sd]?|mergers?|pengambilalihan|penggabungan\s+usaha|takeovers?)\b|\b(?:rights?\s+issues?|hmetd|pmhmetd|hak\s+memesan\s+efek\s+terlebih\s+dahulu)\b/i.test(content);
}

function filterAutomaticNewsWindow(items, now = Date.now(), windowMs = 36 * 60 * 60 * 1000) {
    return (Array.isArray(items) ? items : []).filter(item => {
        if (!isAutomaticNewsAlert(item)) return false;
        const publishedAt = new Date(item?.pubDate).getTime();
        return Number.isFinite(publishedAt) && publishedAt <= now && now - publishedAt <= windowMs;
    }).sort((first, second) => new Date(second.pubDate).getTime() - new Date(first.pubDate).getTime());
}

function findNewNewsItems(items = [], previousItems = []) {
    if (!previousItems.length) return [];
    const previousKeys = new Set(previousItems.map(getNewsAlertKey));
    return items.filter(item => !previousKeys.has(getNewsAlertKey(item)));
}

function classifyNewsSentiment(item) {
    const content = `${item?.title || ''} ${item?.summary || ''}`.toLowerCase();
    const bearish = /\b(rugi|merugi|turun|anjlok|tertekan|gagal|default|pailit|sanksi|pidana|digugat|PHK|pemutusan hubungan kerja|utang membengkak|penurunan laba)\b/i.test(content);
    const bullish = /\b(laba naik|laba meningkat|laba tumbuh|untung|rekor laba|dividen|kontrak baru|menang tender|ekspansi|pendapatan naik|pendapatan tumbuh|buyback|target harga naik)\b/i.test(content);
    if (bearish && !bullish) return { label: 'Bearish', icon: '🔴' };
    if (bullish && !bearish) return { label: 'Bullish', icon: '🟢' };
    return { label: 'Netral / perlu verifikasi', icon: '🟡' };
}

function summarizeNews(item) {
    const snippet = String(item?.summary || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    if (snippet) {
        const sentences = snippet.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [snippet];
        return sentences.slice(0, 2).join(' ').replace(/\s+/g, ' ').trim().slice(0, 320);
    }
    return `Headline terkait ${item?.category || 'pasar saham'} baru terdeteksi di feed. Dampak harga belum dapat dipastikan dari judul saja; verifikasi isi berita dan keterbukaan informasi IDX.`;
}

function formatNewsAlert(item) {
    const ticker = String(item?.tickers?.[0] || item?.ticker || 'IHSG').replace(/[^A-Z0-9]/gi, '').slice(0, 5) || 'IHSG';
    const sentiment = classifyNewsSentiment(item);
    const title = String(item?.title || 'Berita pasar terbaru').replace(/\s+/g, ' ').trim().slice(0, 500);
    const summary = summarizeNews(item);
    const link = String(item?.link || 'Link sumber tidak tersedia').replace(/\s+/g, ' ').slice(0, 500);

    return [
        '📰 [LIVE NEWS / M&A ALERT]',
        `Emiten: $${ticker}`,
        `Judul: ${title}`,
        `Sentimen: ${sentiment.icon} ${sentiment.label}`,
        `Ringkasan: ${summary}`,
        `Link: ${link}`
    ].join('\n');
}

function formatNewsAlertBatch(items) {
    const eligibleItems = (Array.isArray(items) ? items : []).filter(isAutomaticNewsAlert).slice(0, 5);
    const rows = eligibleItems.map((item, index) => {
        const tickers = Array.isArray(item?.tickers) ? item.tickers : [item?.ticker || 'IHSG'];
        const ticker = String(tickers[0] || 'IHSG').replace(/[^A-Z0-9]/gi, '').slice(0, 5) || 'IHSG';
        const title = String(item?.title || 'Berita aksi korporasi').replace(/\s+/g, ' ').trim().slice(0, 260);
        const link = String(item?.link || '').trim().slice(0, 350);
        const source = String(item?.source || 'Sumber berita').replace(/[\r\n]+/g, ' ').slice(0, 80);
        return `${index + 1}. $${ticker} · ${title}\n${source}${link ? ` · ${link}` : ''}`;
    });
    return `📰 STOCKRADAR AI · AKUISISI & RIGHTS ISSUE (${rows.length})\n\n${rows.join('\n\n')}`.slice(0, 3900);
}

function rememberKey(key) {
    const now = Date.now();
    for (const [existingKey, timestamp] of notifiedNews) {
        if (now - timestamp > DEDUPE_TTL_MS) notifiedNews.delete(existingKey);
    }
    if (notifiedNews.size >= MAX_DEDUPE_ITEMS) {
        const oldestKey = notifiedNews.keys().next().value;
        notifiedNews.delete(oldestKey);
    }
    notifiedNews.set(key, now);
}

function enqueueNewsAlerts(items = []) {
    const eligible = [];
    const keys = new Set();
    for (const item of Array.isArray(items) ? items : []) {
        if (!isAutomaticNewsAlert(item)) continue;
        const key = getNewsAlertKey(item);
        if (!key || keys.has(key) || notifiedNews.has(key)) continue;
        keys.add(key);
        eligible.push({ item, key, dedupeKey: `news:${key}` });
    }
    if (!eligible.length) return 0;

    const task = (async () => {
        const claimed = [];
        for (const candidate of eligible.slice(0, 5)) {
            if (await claimAlert(candidate.dedupeKey)) claimed.push(candidate);
        }
        if (!claimed.length) return;
        try {
            const sent = await sendTelegramAlert(formatNewsAlertBatch(claimed.map(row => row.item)));
            if (!sent) {
                for (const { key, dedupeKey } of claimed) await releaseAlert(dedupeKey);
                if (!missingConfigLogged) {
                    console.warn('[news-alert] TELEGRAM_BOT_TOKEN or TELEGRAM_ADMIN_CHAT_ID is not configured');
                    missingConfigLogged = true;
                }
                return;
            }
            claimed.forEach(({ key }) => rememberKey(key));
            console.info('[news-alert] automatic corporate-action batch delivered', { count: claimed.length });
        } catch (error) {
            for (const { dedupeKey } of claimed) await releaseAlert(dedupeKey).catch(() => {});
            console.error('[news-alert] Telegram delivery failed:', error.message || error);
        }
    })();

    try {
        waitUntil(task);
    } catch {
        task.catch(() => {});
    }
    return Math.min(eligible.length, 5);
}

module.exports = { classifyNewsSentiment, enqueueNewsAlerts, filterAutomaticNewsWindow, findNewNewsItems, formatNewsAlert, formatNewsAlertBatch, getNewsAlertKey, isAutomaticNewsAlert, isStrategicCorporateAction };
