const express = require('express');
const router = express.Router();
const {
    getAvailableStrategies,
    runBacktest,
    quickAudit
} = require('../services/backtestEngine');

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
    try {
        const ticker = (req.params.ticker || '').trim();
        const audit = await quickAudit(ticker);
        res.json(audit);
    } catch (error) {
        res.status(500).json({ error: error.message || 'Gagal melakukan audit backtest' });
    }
});

module.exports = router;
