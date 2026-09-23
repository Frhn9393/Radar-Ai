const express = require('express');
const router = express.Router();
const { fetchBroksum } = require('../services/broksumService');
const { formatJakartaDate, daysAgoJakarta, tradingDateBounds } = require('../services/dateTime');
const { waitUntil } = require('@vercel/functions');
const { isDuplicateTelegramUpdate, processTelegramUpdate } = require('../services/telegramWebhookService');
const {
    analyzeStock,
    fetch_corporate_news,
    search_stocks,
    get_stock_price,
    get_sector_for_ticker
} = require('../services/stockService');

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
    res.json(await fetchBroksum(ticker, dateBounds));
});

router.post('/telegram-webhook', (req, res) => {
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

    const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    const suppliedSecret = req.get('x-telegram-bot-api-secret-token');
    const authorized = !expectedSecret || suppliedSecret === expectedSecret;
    if (!authorized) {
        console.warn('[telegram-webhook] rejected request: secret token mismatch');
        return;
    }
    if (isDuplicateTelegramUpdate(updateId)) {
        console.log('[telegram-webhook] duplicate update ignored', updateId);
        return;
    }
    if (!process.env.TELEGRAM_BOT_TOKEN) {
        console.error('[telegram-webhook] cannot process update: TELEGRAM_BOT_TOKEN is not configured');
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

// API: Analyze specific stock
router.get('/analyze/:ticker', async (req, res) => {
    try {
        const ticker = (req.params.ticker || '').trim();
        const data = await analyzeStock(ticker);
        res.json(data);
    } catch (error) {
        res.status(404).json({ error: error.message || 'Data saham tidak ditemukan' });
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
