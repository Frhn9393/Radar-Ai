const express = require('express');
const router = express.Router();
const {
    runScreener,
    fetch_market_news,
    fetch_ma_deals,
    get_market_indices
} = require('../services/stockService');

// API: Run Screener (Superfast Multi-factor Engine)
router.get('/screener', async (req, res) => {
    try {
        const data = await runScreener({ sendAlerts: false });
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message || 'Gagal menjalankan screener' });
    }
});

// Trigger Telegram delivery using the same cached, deduplicated screener result as the UI.
router.post('/screener/telegram-alerts', async (req, res) => {
    try {
        const data = await runScreener({ sendAlerts: true });
        return res.json({ ok: true, screenerUpdated: Boolean(data) });
    } catch (error) {
        console.error('[screener:telegram-alerts] failed', error.message || error);
        return res.status(502).json({ ok: false, error: 'Screener selesai, tetapi notifikasi Telegram belum dapat dipicu.' });
    }
});

// API: Market News (Realtime Indonesian Market News)
router.get('/market-news', async (req, res) => {
    try {
        const data = await fetch_market_news();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message || 'Gagal memuat berita pasar', news: [] });
    }
});

// API: Radar Saham Akuisisi & M&A Deals
router.get('/deals', async (req, res) => {
    try {
        const data = await fetch_ma_deals();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message || 'Gagal memuat deals', deals: [] });
    }
});

// API: Live Market Indices (IHSG, USD/IDR, etc.)
router.get('/market-indices', async (req, res) => {
    try {
        const data = await get_market_indices();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message || 'Gagal memuat indeks pasar' });
    }
});

module.exports = router;
