const express = require('express');
const cors = require('cors');
const path = require('path');

const stockRoutes = require('./routes/stockRoutes');
const marketRoutes = require('./routes/marketRoutes');
const foreignFlowRoutes = require('./routes/foreignFlowRoutes');
const rightsIssueRoutes = require('./routes/rightsIssueRoutes');
const backtestRoutes = require('./routes/backtestRoutes');

const app = express();

// Security & performance headers
app.use(cors());

// Disable static caching so modifications are immediately visible without hard refresh
app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
});

app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: 0,
    etag: false
}));
app.use(express.json());

// API: Healthcheck for monitoring (supports both /api/health and /health)
app.get(['/api/health', '/health'], (req, res) => {
    res.json({
        status: 'OK',
        uptime: Math.floor(process.uptime()),
        timestamp: new Date().toISOString()
    });
});

// Mount Modular API Routes (with /api prefix for standard server)
app.use('/api', stockRoutes);
app.use('/api', marketRoutes);
app.use('/api/foreign-flow', foreignFlowRoutes);
app.use('/api/rights-issue', rightsIssueRoutes);
app.use('/api/backtest', backtestRoutes);

// Also mount direct routes in case Vercel serverless function receives stripped paths
app.use(stockRoutes);
app.use(marketRoutes);
app.use('/foreign-flow', foreignFlowRoutes);
app.use('/rights-issue', rightsIssueRoutes);
app.use('/backtest', backtestRoutes);

// Global error handler
app.use((err, req, res, next) => {
    console.error('Unhandled server error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan internal pada server' });
});

module.exports = app;
