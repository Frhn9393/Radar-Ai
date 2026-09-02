const express = require('express');
const cors = require('cors');
const path = require('path');
const { analyzeStock, runScreener, fetch_market_news } = require('./services/stockService');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// API: Analyze specific stock
app.get('/api/analyze/:ticker', async (req, res) => {
    try {
        const data = await analyzeStock(req.params.ticker);
        res.json(data);
    } catch (error) {
        res.status(404).json({ error: error.message });
    }
});

// API: Run Screener
app.get('/api/screener', async (req, res) => {
    try {
        const data = await runScreener();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API: Market News (Realtime Indonesian Market News)
app.get('/api/market-news', async (req, res) => {
    try {
        const data = await fetch_market_news();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message, news: [] });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
