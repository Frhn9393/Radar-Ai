const express = require('express');
const router = express.Router();
const { fetchBroksum } = require('../services/broksumService');
const { StockbitFeedError } = require('../services/customMarketFeed');
const { formatJakartaDate, daysAgoJakarta, tradingDateBounds } = require('../services/dateTime');
const { waitUntil } = require('@vercel/functions');
const { sendTelegramAlert, setTelegramWebhook, getTelegramWebhookInfo } = require('../services/telegramService');
const { isSameOriginRequest, allowRateLimitedRequest } = require('../services/requestGuard');
const { fetchHistoricalData } = require('../services/backtestEngine');
const { isDuplicateTelegramUpdate, processTelegramUpdate } = require('../services/telegramWebhookService');
const { fetch_market_news, fetch_ma_deals } = require('../services/newsService');
const { enqueueNewsAlerts, isStrategicCorporateAction } = require('../services/newsAlertService');
const {
    analyzeStock,
    hasUsableRealtimeData,
    fetch_corporate_news,
    search_stocks,
    get_stock_price,
    get_sector_for_ticker
} = require('../services/stockService');
const { runScreener } = require('../services/screenerService');

// Vercel Cron hits this endpoint at Indonesian session open times (weekdays).
router.get('/cron/telegram-session-alerts', async (req, res) => {
    const secret = String(process.env.CRON_SECRET || '').trim();
    const authorization = String(req.get('authorization') || '').trim();
    if (!secret || authorization !== `Bearer ${secret}`) {
        return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }
    if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_ADMIN_CHAT_ID) {
        return res.status(503).json({ ok: false, error: 'Telegram alert configuration unavailable' });
    }

    try {
        const [screener, marketNews, maNews] = await Promise.all([
            runScreener(), fetch_market_news().catch(() => null), fetch_ma_deals().catch(() => null)
        ]);
        const newsItems = [
            ...(Array.isArray(marketNews?.news) ? marketNews.news : []),
            ...(Array.isArray(maNews?.deals) ? maNews.deals : [])
        ].filter(isStrategicCorporateAction);
        enqueueNewsAlerts(newsItems);
        return res.json({ ok: true, screenerUpdated: Boolean(screener), newsItems: newsItems.length });
    } catch (error) {
        console.error('[cron:telegram-session-alerts] failed', error.message || error);
        return res.status(500).json({ ok: false, error: 'Scheduled alert run failed' });
    }
});

router.post('/telegram/configure-webhook', async (req, res) => {
    const secret = String(process.env.CRON_SECRET || '').trim();
    if (!secret || String(req.get('authorization') || '').trim() !== `Bearer ${secret}`) {
        return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }
    const webhookSecret = String(process.env.TELEGRAM_WEBHOOK_SECRET || '').trim();
    const webhookUrl = String(process.env.TELEGRAM_WEBHOOK_URL || 'https://radar-ai-beta.vercel.app/api/telegram-webhook').trim();
    if (!process.env.TELEGRAM_BOT_TOKEN || !webhookSecret) {
        return res.status(503).json({ ok: false, error: 'Telegram webhook configuration unavailable' });
    }
    try {
        await setTelegramWebhook(webhookUrl, webhookSecret);
        const info = await getTelegramWebhookInfo();
        if (info.url !== webhookUrl) throw new Error('Telegram webhook URL did not match after setup');
        return res.json({
            ok: true,
            webhookUrl: info.url,
            pendingUpdates: Number(info.pending_update_count) || 0,
            lastErrorDate: info.last_error_date || null,
            lastErrorMessage: info.last_error_message || null
        });
    } catch (error) {
        console.error('[telegram-webhook-setup] failed', error.message || error);
        return res.status(502).json({ ok: false, error: 'Telegram webhook could not be configured.' });
    }
});

// API: Search / Autocomplete suggestions
router.get('/search-suggest', (req, res) => {
    try {
        const query = req.query.q || '';
        const suggestions = search_stocks(query);
        res.json({ query, suggestions });
    } catch (error) {
        res.status(500).json({ error: error.message || 'Gagal mencari emiten', suggestions: [] });
    }
});

// Batch realtime quotes for the Smart Portfolio panel.
router.get('/portfolio/quotes', async (req, res) => {
    const tickers = String(req.query.tickers || '').split(',')
        .map(t => t.trim().toUpperCase().replace(/\.JK$/i, ''))
        .filter(Boolean)
        .filter((ticker, index, list) => list.indexOf(ticker) === index)
        .slice(0, 30);
    if (!tickers.length) return res.json({ quotes: [], timestamp: new Date().toISOString() });

    const results = await Promise.allSettled(tickers.map(async ticker => ({
        ticker,
        sector: get_sector_for_ticker(ticker),
        quote: await get_stock_price(ticker)
    })));
    res.json({
        quotes: results.filter(result => result.status === 'fulfilled').map(result => result.value),
        errors: results.filter(result => result.status === 'rejected').length,
        timestamp: new Date().toISOString()
    });
});

router.get('/broksum/:ticker', async (req, res) => {
    const ticker = String(req.params.ticker || '').trim().toUpperCase().replace(/\.JK$/i, '');
    if (!/^[A-Z]{2,5}$/.test(ticker)) return res.status(400).json({ error: 'Kode saham tidak valid.' });
    const endDate = String(req.query.endDate || formatJakartaDate());
    const startDate = String(req.query.startDate || daysAgoJakarta(6));
    const dateBounds = tradingDateBounds(startDate, endDate);
    if (!dateBounds) {
        return res.status(400).json({ error: 'Rentang tanggal tidak valid.' });
    }
    try {
        res.json(await fetchBroksum(ticker, dateBounds));
    } catch (error) {
        const failureType = error instanceof StockbitFeedError ? error.code : 'BROKSUM_INTERNAL_ERROR';
        console.warn('[broksum] Stockbit provider request failed', { ticker, failureType, statusCode: error?.statusCode || null });
        res.status(502).json({ error: 'Data broksum Stockbit sementara tidak tersedia.' });
    }
});

router.post('/telegram-webhook', (req, res) => {
    const expectedSecret = String(process.env.TELEGRAM_WEBHOOK_SECRET || '').trim();
    const suppliedSecret = String(req.get('x-telegram-bot-api-secret-token') || '').trim();
    if (!expectedSecret || suppliedSecret !== expectedSecret) {
        console.warn('[telegram-webhook] rejected request: missing or invalid secret token');
        return res.status(401).send('Unauthorized');
    }

    const update = req.body || {};
    const message = update.message || update.edited_message;
    const chatId = message?.chat?.id;
    const updateId = update.update_id;
    console.log('[telegram-webhook] inbound request', JSON.stringify({
        updateId: updateId ?? null,
        updateType: update.message ? 'message' : update.edited_message ? 'edited_message' : 'other',
        chatId: chatId === undefined || chatId === null ? null : chatId.toString()
    }));

    // Telegram retries requests that take too long; acknowledge before all processing.
    res.status(200).send('OK');

    if (isDuplicateTelegramUpdate(updateId)) {
        console.log('[telegram-webhook] duplicate update ignored', updateId);
        return;
    }
    const backgroundTask = Promise.resolve().then(() => processTelegramUpdate(update)).catch(error => {
        console.error('Telegram webhook background task failed:', error.message || error);
    });
    try {
        waitUntil(backgroundTask);
    } catch (error) {
        // Local Express execution has no Vercel request context; keep the task detached.
        backgroundTask.catch(() => {});
    }
});

router.post('/telegram/test-alert', async (req, res) => {
    if (!isSameOriginRequest(req)) return res.status(403).json({ ok: false, error: 'Origin tidak diizinkan.' });
    try {
        if (!await allowRateLimitedRequest(req, 'telegram-test-alert', { limit: 1, windowSeconds: 60 })) {
            return res.status(429).json({ ok: false, error: 'Tunggu satu menit sebelum mengirim tes berikutnya.' });
        }
    } catch {
        return res.status(503).json({ ok: false, error: 'Layanan pembatasan permintaan sementara tidak tersedia.' });
    }
    if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_ADMIN_CHAT_ID) {
        return res.status(503).json({ ok: false, error: 'Konfigurasi Telegram belum tersedia.' });
    }
    try {
        const ok = await sendTelegramAlert('✅ STOCKRADAR AI: Tes notifikasi berhasil. Alert Telegram aktif.');
        return res.status(ok ? 200 : 502).json({ ok, message: ok ? 'Tes notifikasi berhasil dikirim.' : 'Telegram menolak pengiriman.' });
    } catch (error) {
        console.error('[telegram-test] delivery failed:', error.message || error);
        return res.status(502).json({ ok: false, error: 'Gagal mengirim tes notifikasi ke Telegram.' });
    }
});

// API: Analyze specific stock
router.get('/analyze/:ticker', async (req, res) => {
    try {
        const ticker = (req.params.ticker || '').trim();
        const data = await analyzeStock(ticker);
        if (!data || !hasUsableRealtimeData(data.realtime, { allowZeroVolume: data.ticker === 'IHSG' })) {
            return res.status(404).json({ error: 'Data realtime/historis emiten ini tidak tersedia di bursa saat ini.' });
        }
        res.json(data);
    } catch {
        res.status(404).json({ error: 'Data realtime/historis emiten ini tidak tersedia di bursa saat ini.' });
    }
});

router.get('/chart/:ticker', async (req, res) => {
    const ticker = String(req.params.ticker || '').trim().toUpperCase().replace(/\.JK$/i, '');
    if (!/^[A-Z0-9]{2,5}$/.test(ticker)) return res.status(400).json({ error: 'Kode emiten tidak valid.', candles: [] });
    const period = ['1m', '2m', '3m', '6m', '1y'].includes(req.query.period) ? req.query.period : '6m';
    try {
        const candles = await fetchHistoricalData(ticker, period);
        if (!Array.isArray(candles) || candles.length === 0) {
            return res.status(502).json({ error: 'Data realtime/historis emiten ini tidak tersedia di bursa saat ini.', candles: [] });
        }
        return res.json({ ticker, period, candles, dataSource: 'Yahoo Finance' });
    } catch {
        return res.status(502).json({ error: 'Data realtime/historis emiten ini tidak tersedia di bursa saat ini.', candles: [] });
    }
});

// API: Corporate News per Ticker
router.get('/corporate-news/:ticker', async (req, res) => {
    try {
        const ticker = (req.params.ticker || '').trim();
        const news = await fetch_corporate_news(ticker);
        res.json({ ticker, news, count: news.length });
    } catch (error) {
        res.status(500).json({ error: error.message || 'Gagal memuat berita korporasi', news: [], count: 0 });
    }
});

module.exports = router;
