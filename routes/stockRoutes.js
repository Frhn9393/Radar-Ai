const express = require('express');
const router = express.Router();
const { fetchBroksum } = require('../services/broksumService');
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
    const endDate = String(req.query.endDate || new Date().toISOString().slice(0, 10));
    const startDate = String(req.query.startDate || new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate) || startDate > endDate) {
        return res.status(400).json({ error: 'Rentang tanggal tidak valid.' });
    }
    res.json(await fetchBroksum(ticker, startDate, endDate));
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
