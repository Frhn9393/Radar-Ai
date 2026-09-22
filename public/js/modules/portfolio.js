// ============================================================
//  MODULE: portfolio.js
//  Persistent Smart Portfolio, realtime P/L, exposure and risk
// ============================================================
const PORTFOLIO_STORAGE_KEY = 'stockradar_portfolio_v1';
let portfolioPositions = loadPortfolioPositions();
let portfolioRefreshTimer = null;

function loadPortfolioPositions() {
    try {
        const value = JSON.parse(localStorage.getItem(PORTFOLIO_STORAGE_KEY) || '[]');
        return Array.isArray(value) ? value.filter(isValidPortfolioPosition) : [];
    } catch { return []; }
}

function isValidPortfolioPosition(item) {
    return item && /^[A-Z]{2,5}$/.test(String(item.ticker || '').toUpperCase()) &&
        Number(item.quantity) > 0 && Number(item.avgPrice) > 0;
}

function savePortfolioPositions() {
    localStorage.setItem(PORTFOLIO_STORAGE_KEY, JSON.stringify(portfolioPositions));
}

function portfolioMoney(value) {
    return fmtRp.format(Number(value) || 0);
}

function portfolioPct(value) {
    const number = Number(value) || 0;
    return `${number >= 0 ? '+' : ''}${number.toFixed(2)}%`;
}

function calculatePortfolioRisk(rows, totalValue) {
    const sectorTotals = {};
    rows.forEach(row => { sectorTotals[row.sector] = (sectorTotals[row.sector] || 0) + row.marketValue; });
    const sectors = Object.entries(sectorTotals).sort((a, b) => b[1] - a[1]);
    const largestExposure = totalValue ? (sectors[0]?.[1] || 0) / totalValue : 0;
    const diversification = rows.length < 2 ? 'Konsentrasi tinggi' : largestExposure > 0.6 ? 'Konsentrasi tinggi' : largestExposure > 0.4 ? 'Cukup terdiversifikasi' : 'Terdiversifikasi';
    // Conservative parametric proxy: 1.65σ daily move, using each quote's day range.
    const varianceProxy = rows.reduce((sum, row) => sum + Math.pow((row.quote.high - row.quote.low) / Math.max(row.quote.lastPrice, 1), 2) * row.marketValue, 0);
    const volatility = totalValue ? Math.sqrt(varianceProxy / totalValue) : 0;
    const var95 = totalValue * volatility * 1.65;
    return { sectors, largestExposure, diversification, var95 };
}

function renderPortfolioSummary(rows) {
    const totalCost = rows.reduce((sum, row) => sum + row.cost, 0);
    const totalValue = rows.reduce((sum, row) => sum + row.marketValue, 0);
    const pnl = totalValue - totalCost;
    const risk = calculatePortfolioRisk(rows, totalValue);
    const totalEl = document.getElementById('portfolio-total-value');
    const pnlEl = document.getElementById('portfolio-total-pnl');
    const varEl = document.getElementById('portfolio-var');
    const divEl = document.getElementById('portfolio-diversification');
    const sectorEl = document.getElementById('portfolio-sector-exposure');
    if (totalEl) totalEl.textContent = portfolioMoney(totalValue);
    if (pnlEl) { pnlEl.textContent = `${portfolioMoney(pnl)} (${portfolioPct(totalCost ? pnl / totalCost * 100 : 0)})`; pnlEl.className = `font-mono font-bold ${pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`; }
    if (varEl) varEl.textContent = `${portfolioMoney(risk.var95)} / hari`;
    if (divEl) divEl.textContent = risk.diversification;
    if (sectorEl) sectorEl.textContent = risk.sectors[0] ? `${risk.sectors[0][0]} (${(risk.largestExposure * 100).toFixed(1)}%)` : '-';
}

function renderPortfolioRows(rows) {
    const body = document.getElementById('portfolio-rows');
    if (!body) return;
    body.innerHTML = rows.length ? rows.map(row => {
        const pnl = row.marketValue - row.cost;
        const stop = Math.max(row.quote.lastPrice * 0.95, row.avgPrice * 0.9);
        return `<tr class="border-b border-slate-800/60"><td class="p-3 font-mono font-bold text-cyan-300">$${escapeHtml(row.ticker)}</td><td class="p-3 text-slate-300">${row.quantity.toLocaleString('id-ID')}</td><td class="p-3 font-mono">${portfolioMoney(row.avgPrice)}</td><td class="p-3 font-mono">${portfolioMoney(row.quote.lastPrice)}</td><td class="p-3 font-mono">${portfolioMoney(row.marketValue)}</td><td class="p-3 font-mono ${pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}">${portfolioMoney(pnl)} (${portfolioPct(row.cost ? pnl / row.cost * 100 : 0)})</td><td class="p-3 text-amber-300 font-mono">${portfolioMoney(stop)}</td><td class="p-3"><button class="portfolio-remove text-rose-400" data-ticker="${escapeHtml(row.ticker)}" aria-label="Hapus ${escapeHtml(row.ticker)}">Hapus</button></td></tr>`;
    }).join('') : '<tr><td colspan="8" class="p-6 text-center text-slate-500">Belum ada posisi. Tambahkan saham di atas.</td></tr>';
    body.querySelectorAll('.portfolio-remove').forEach(button => button.addEventListener('click', () => {
        portfolioPositions = portfolioPositions.filter(position => position.ticker !== button.dataset.ticker);
        savePortfolioPositions();
        refreshPortfolio();
    }));
}

async function refreshPortfolio() {
    const status = document.getElementById('portfolio-status');
    if (!portfolioPositions.length) { renderPortfolioRows([]); renderPortfolioSummary([]); return; }
    if (status) status.textContent = 'Memuat harga realtime...';
    try {
        const tickers = portfolioPositions.map(position => position.ticker).join(',');
        const response = await fetch(`/api/portfolio/quotes?tickers=${encodeURIComponent(tickers)}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        const byTicker = new Map(data.quotes.map(item => [item.ticker, item]));
        const rows = portfolioPositions.map(position => {
            const quote = byTicker.get(position.ticker);
            if (!quote) return null;
            const quantity = Number(position.quantity);
            const avgPrice = Number(position.avgPrice);
            return { ...position, quantity, avgPrice, quote: quote.quote, sector: quote.sector, cost: quantity * avgPrice * 100, marketValue: quantity * quote.quote.lastPrice * 100 };
        }).filter(Boolean);
        renderPortfolioRows(rows); renderPortfolioSummary(rows);
        if (status) status.textContent = `Update terakhir: ${new Date().toLocaleTimeString('id-ID')}`;
    } catch (error) { if (status) status.textContent = 'Gagal memuat harga realtime.'; console.error('Portfolio refresh failed:', error); }
}

document.getElementById('portfolio-form')?.addEventListener('submit', event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const ticker = String(form.get('ticker') || '').trim().toUpperCase().replace(/\.JK$/, '');
    const quantity = Number(form.get('quantity'));
    const avgPrice = Number(form.get('avgPrice'));
    if (!/^[A-Z]{2,5}$/.test(ticker) || quantity <= 0 || avgPrice <= 0) return;
    portfolioPositions = [...portfolioPositions.filter(position => position.ticker !== ticker), { ticker, quantity, avgPrice }];
    savePortfolioPositions(); event.currentTarget.reset(); refreshPortfolio();
});

document.getElementById('portfolio-refresh')?.addEventListener('click', refreshPortfolio);
document.addEventListener('visibilitychange', () => {
    if (document.hidden) { clearInterval(portfolioRefreshTimer); portfolioRefreshTimer = null; }
    else if (!portfolioRefreshTimer) { refreshPortfolio(); portfolioRefreshTimer = setInterval(refreshPortfolio, 60000); }
});
refreshPortfolio();
portfolioRefreshTimer = setInterval(refreshPortfolio, 60000);
