const express = require('express');
const router = express.Router();
const { allowRateLimitedRequest } = require('../services/requestGuard');
const {
    getAvailableStrategies,
    runBacktest,
    quickAudit,
    runScreenerPortfolioBacktest
} = require('../services/backtestEngine');

async function enforceBacktestRateLimit(req, res, action, limit) {
    try {
        const allowed = await allowRateLimitedRequest(req, action, { limit, windowSeconds: 60 });
        if (allowed) return true;
        res.status(429).json({ error: 'Terlalu banyak permintaan backtest. Coba lagi sebentar.' });
        return false;
    } catch {
        res.status(503).json({ error: 'Layanan pembatasan permintaan sementara tidak tersedia.' });
        return false;
    }
}

// API: List available backtest strategies
router.get('/strategies', (req, res) => {
    try {
        const strategies = getAvailableStrategies();
        res.json({ strategies, count: strategies.length });
    } catch (error) {
        res.status(500).json({ error: error.message || 'Gagal memuat strategi backtest', strategies: [] });
    }
});

// API: Run backtest (supports POST JSON body)
router.post('/run', async (req, res) => {
    if (!await enforceBacktestRateLimit(req, res, 'backtest-run', 8)) return;
    try {
        const result = await runBacktest(req.body || {});
        res.json(result);
    } catch (error) {
        console.error('Error running backtest:', error);
        res.status(400).json({ error: error.message || 'Gagal menjalankan backtest otomatis' });
    }
});

// API: Run backtest (supports GET query params for quick access/testing)
router.get('/run', async (req, res) => {
    if (!await enforceBacktestRateLimit(req, res, 'backtest-run', 8)) return;
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
router.get('/quick/:ticker', async (req, res) => {
    if (!/^[A-Z0-9]{2,5}$/.test(String(req.params.ticker || '').trim().toUpperCase().replace(/\.JK$/i, ''))) {
        return res.status(400).json({ error: 'Kode emiten tidak valid.' });
    }
    if (!await enforceBacktestRateLimit(req, res, 'backtest-quick', 30)) return;
    try {
        const ticker = (req.params.ticker || '').trim();
        const audit = await quickAudit(ticker);
        res.json(audit);
    } catch (error) {
        res.status(500).json({ error: error.message || 'Gagal melakukan audit backtest' });
    }
});

router.post('/', async (req, res) => {
    if (!await enforceBacktestRateLimit(req, res, 'backtest-portfolio', 5)) return;
    try {
        const result = await runScreenerPortfolioBacktest(req.body || {});
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message || 'Gagal menjalankan backtest screener.' });
    }
});

router.get('/', async (req, res) => {
    if (!await enforceBacktestRateLimit(req, res, 'backtest-portfolio', 5)) return;
    try {
        const tickers = String(req.query.tickers || req.query.ticker || '').split(',').map(value => value.trim()).filter(Boolean);
        const result = await runScreenerPortfolioBacktest({ tickers, period: req.query.period || '3m', initialCapital: req.query.initialCapital ? Number(req.query.initialCapital) : 100000000 });
        res.json(result);
    } catch (error) {
        res.status(400).json({ error: error.message || 'Gagal menjalankan backtest screener.' });
    }
});

module.exports = router;
