const express = require('express');
const router = express.Router();
const {
    getForeignFlowData,
    getTickerForeignFlow
} = require('../services/stockService');

// API: Pelacakan Top Foreign Buy & Sell (Harian, Mingguan, Bulanan, Streak)
router.get('/', async (req, res) => {
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
router.get('/:ticker', async (req, res) => {
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

module.exports = router;
