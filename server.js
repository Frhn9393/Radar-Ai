const express = require('express');
const cors = require('cors');
const path = require('path');
const {
    analyzeStock,
    runScreener,
    fetch_market_news,
    fetch_corporate_news,
    fetch_ma_deals,
    search_stocks,
    get_market_indices,
    getForeignFlowData,
    getTickerForeignFlow,
    getRightsIssueData,
    calculateTebus
} = require('./services/stockService');

const {
    getAvailableStrategies,
    runBacktest,
    quickAudit
} = require('./services/backtestEngine');

const app = express();
const PORT = process.env.PORT || 3000;

// Security & performance headers
app.use(cors());
app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: '1h',
    etag: true
}));
app.use(express.json());

// API: Healthcheck for monitoring
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        uptime: Math.floor(process.uptime()),
        timestamp: new Date().toISOString()
    });
});

// API: Search / Autocomplete suggestions
app.get('/api/search-suggest', (req, res) => {
    try {
        const query = req.query.q || '';
        const suggestions = search_stocks(query);
        res.json({ query, suggestions });
    } catch (error) {
        res.status(500).json({ error: error.message || 'Gagal mencari emiten', suggestions: [] });
    }
});

// API: Analyze specific stock
app.get('/api/analyze/:ticker', async (req, res) => {
    try {
        const ticker = (req.params.ticker || '').trim();
        const data = await analyzeStock(ticker);
        res.json(data);
    } catch (error) {
        res.status(404).json({ error: error.message || 'Data saham tidak ditemukan' });
    }
});

// API: Corporate News per Ticker
app.get('/api/corporate-news/:ticker', async (req, res) => {
    try {
        const ticker = (req.params.ticker || '').trim();
        const news = await fetch_corporate_news(ticker);
        res.json({ ticker, news, count: news.length });
    } catch (error) {
        res.status(500).json({ error: error.message || 'Gagal memuat berita korporasi', news: [], count: 0 });
    }
});

// API: Run Screener (Superfast Multi-factor Engine)
app.get('/api/screener', async (req, res) => {
    try {
        const data = await runScreener();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message || 'Gagal menjalankan screener' });
    }
});

// API: Market News (Realtime Indonesian Market News)
app.get('/api/market-news', async (req, res) => {
    try {
        const data = await fetch_market_news();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message || 'Gagal memuat berita pasar', news: [] });
    }
});

// API: Radar Saham Akuisisi & M&A Deals
app.get('/api/deals', async (req, res) => {
    try {
        const data = await fetch_ma_deals();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message || 'Gagal memuat deals', deals: [] });
    }
});

// API: Live Market Indices (IHSG, USD/IDR, etc.)
app.get('/api/market-indices', async (req, res) => {
    try {
        const data = await get_market_indices();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message || 'Gagal memuat indeks pasar' });
    }
});

// API: Pelacakan Top Foreign Buy & Sell (Harian, Mingguan, Bulanan, Streak)
app.get('/api/foreign-flow', async (req, res) => {
    try {
        const forceRefresh = req.query.force === 'true';

        // Support ?ticker= query param for single ticker lookup
        if (req.query.ticker) {
            const cleanTicker = req.query.ticker.trim().toUpperCase().replace(/\.JK$/i, '');
            const singleData = await getTickerForeignFlow(cleanTicker);
            if (!singleData) {
                return res.status(404).json({ error: `Data foreign flow untuk ${cleanTicker} tidak ditemukan` });
            }
            return res.json({ ticker: cleanTicker, ...singleData });
        }

        const timeframe = (req.query.timeframe || 'all').toLowerCase();
        const data = await getForeignFlowData(forceRefresh);

        if (timeframe === 'daily') {
            return res.json({ macro: data.macro, daily: data.daily, ...data.daily, backtestMetadata: data.backtestMetadata });
        } else if (timeframe === 'weekly') {
            return res.json({ macro: data.macro, weekly: data.weekly, ...data.weekly, backtestMetadata: data.backtestMetadata });
        } else if (timeframe === 'monthly') {
            return res.json({ macro: data.macro, monthly: data.monthly, ...data.monthly, backtestMetadata: data.backtestMetadata });
        } else if (timeframe === 'streak') {
            return res.json({ macro: data.macro, streak: data.streak, ...data.streak, backtestMetadata: data.backtestMetadata });
        }

        res.json(data);
    } catch (error) {
        console.error('Error fetching foreign flow:', error);
        res.status(500).json({ error: error.message || 'Gagal memuat data foreign flow', daily: { topBuy: [], topSell: [] } });
    }
});

// API: Detail Foreign Flow Single Ticker
app.get('/api/foreign-flow/:ticker', async (req, res) => {
    try {
        const ticker = (req.params.ticker || '').trim().toUpperCase().replace(/\.JK$/i, '');
        const data = await getTickerForeignFlow(ticker);
        if (!data) {
            return res.status(404).json({ error: `Data foreign flow untuk ${ticker} tidak ditemukan` });
        }
        res.json({ ticker, ...data });
    } catch (error) {
        res.status(500).json({ error: error.message || 'Gagal memuat detail foreign flow ticker' });
    }
});

// API: Rights Issue (HMETD) analytics per ticker
app.get('/api/rights-issue/:ticker', async (req, res) => {
    try {
        const ticker = (req.params.ticker || '').trim().toUpperCase().replace(/\.JK$/i, '');
        const currentPrice = req.query.price ? parseFloat(req.query.price) : null;
        const data = getRightsIssueData(ticker, currentPrice);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message || 'Gagal memuat data Rights Issue' });
    }
});

// API: Rights Issue (HMETD) Tebus Calculator execution
app.post('/api/rights-issue/calculate-tebus', (req, res) => {
    try {
        const { ownedLots, ratioOld, ratioNew, exercisePrice, cumPrice } = req.body || {};
        const result = calculateTebus({ ownedLots, ratioOld, ratioNew, exercisePrice, cumPrice });
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message || 'Gagal menghitung simulasi tebus HMETD' });
    }
});

// ============================================================
//  API: AUTOMATED QUANTITATIVE BACKTEST ENGINE (IDX)
// ============================================================

// API: List available backtest strategies
app.get('/api/backtest/strategies', (req, res) => {
    try {
        const strategies = getAvailableStrategies();
        res.json({ strategies, count: strategies.length });
    } catch (error) {
        res.status(500).json({ error: error.message || 'Gagal memuat strategi backtest', strategies: [] });
    }
});

// API: Run backtest (supports POST JSON body)
app.post('/api/backtest/run', async (req, res) => {
    try {
        const result = await runBacktest(req.body || {});
        res.json(result);
    } catch (error) {
        console.error('Error running backtest:', error);
        res.status(400).json({ error: error.message || 'Gagal menjalankan backtest otomatis' });
    }
});

// API: Run backtest (supports GET query params for quick access/testing)
app.get('/api/backtest/run', async (req, res) => {
    try {
        const { ticker, strategy, period, initialCapital, tp, sl, trailing } = req.query;
        const result = await runBacktest({
            ticker: ticker || 'BBCA',
            strategyKey: strategy || 'COMPOSITE_QUANT',
            period: period || '1y',
            initialCapital: initialCapital ? parseFloat(initialCapital) : 100000000,
            customTp: tp ? parseFloat(tp) : null,
            customSl: sl ? parseFloat(sl) : null,
            customTrailing: trailing ? parseFloat(trailing) : null
        });
        res.json(result);
    } catch (error) {
        console.error('Error running backtest:', error);
        res.status(400).json({ error: error.message || 'Gagal menjalankan backtest otomatis' });
    }
});

// API: Quick Audit for a single ticker (used in Stock Analysis modal)
app.get('/api/backtest/quick/:ticker', async (req, res) => {
    try {
        const ticker = (req.params.ticker || '').trim();
        const audit = await quickAudit(ticker);
        res.json(audit);
    } catch (error) {
        res.status(500).json({ error: error.message || 'Gagal melakukan audit backtest' });
    }
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Unhandled server error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan internal pada server' });
});

// Start Server with EADDRINUSE protection
const server = app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

server.setMaxListeners(50);

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`[ERROR] Port ${PORT} sedang digunakan oleh proses lain. Coba hentikan proses sebelumnya atau gunakan PORT berbeda.`);
    } else {
        console.error('[ERROR] Server failure:', err.message);
    }
});

// Process-level safety guards to prevent unhandled crashes
process.on('uncaughtException', (err) => {
    console.error('[CRITICAL] Uncaught Exception:', err.message || err);
});

process.on('unhandledRejection', (reason) => {
    console.error('[WARNING] Unhandled Rejection:', reason?.message || reason);
});
