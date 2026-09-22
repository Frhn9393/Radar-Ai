const express = require('express');
const router = express.Router();
const {
    getRightsIssueData,
    calculateTebus
} = require('../services/stockService');

// API: Rights Issue (HMETD) analytics per ticker
router.get('/:ticker', async (req, res) => {
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
router.post('/calculate-tebus', (req, res) => {
    try {
        const { ownedLots, ratioOld, ratioNew, exercisePrice, cumPrice } = req.body || {};
        const result = calculateTebus({ ownedLots, ratioOld, ratioNew, exercisePrice, cumPrice });
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message || 'Gagal menghitung simulasi tebus HMETD' });
    }
});

module.exports = router;
