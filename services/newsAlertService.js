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
    for (const item of items) {
        if (!isStrategicCorporateAction(item)) continue;
        const key = getNewsAlertKey(item);
        if (!key || notifiedNews.has(key)) continue;
        rememberKey(key);

        const dedupeKey = `news:${key}`;
        const task = claimAlert(dedupeKey).then(claimed => claimed ? sendTelegramAlert(formatNewsAlert(item)) : true).then(async sent => {
            if (!sent) {
                notifiedNews.delete(key);
                await releaseAlert(dedupeKey);
                if (!missingConfigLogged) {
                    console.warn('[news-alert] TELEGRAM_BOT_TOKEN or TELEGRAM_ADMIN_CHAT_ID is not configured');
                    missingConfigLogged = true;
                }
            }
        }).catch(async error => {
            notifiedNews.delete(key);
            await releaseAlert(dedupeKey).catch(() => {});
            console.error('[news-alert] Telegram delivery failed:', error.message || error);
        });

        try {
            waitUntil(task);
        } catch {
            task.catch(() => {});
        }
    }
}

module.exports = { classifyNewsSentiment, enqueueNewsAlerts, findNewNewsItems, formatNewsAlert, getNewsAlertKey, isStrategicCorporateAction };
