// Interactive Yahoo Finance candlestick chart for the stock analysis modal.
let stockPriceChart = null;
let stockChartResizeObserver = null;
let stockChartRequestId = 0;
let lastRequestedChartTicker = null;

async function renderStockPriceChart(ticker) {
    const container = document.getElementById('modal-stock-chart');
    const status = document.getElementById('modal-chart-status');
    if (!container || !status) return;
    if (lastRequestedChartTicker === ticker) return;
    lastRequestedChartTicker = ticker;
    const requestId = ++stockChartRequestId;
    disposeStockPriceChart();
    container.replaceChildren();
    status.textContent = 'Memuat grafik Yahoo Finance…';
    try {
        const response = await fetch(`/api/chart/${encodeURIComponent(ticker)}?period=1y`);
        const payload = await response.json();
        if (!response.ok || !Array.isArray(payload.candles) || payload.candles.length < 5) throw new Error('Data realtime/historis emiten ini tidak tersedia di bursa saat ini.');
        if (requestId !== stockChartRequestId || currentActiveTicker !== ticker || !window.LightweightCharts) throw new Error('Grafik tidak tersedia.');
        const library = window.LightweightCharts;
        const chart = library.createChart(container, {
            width: container.clientWidth, height: container.clientHeight,
            layout: { background: { type: 'solid', color: '#090e1a' }, textColor: '#94a3b8', attributionLogo: true },
            grid: { vertLines: { color: '#172033' }, horzLines: { color: '#172033' } },
            rightPriceScale: { borderColor: '#253149' }, timeScale: { borderColor: '#253149' }
        });
        stockPriceChart = chart;
        const candleSeries = chart.addSeries(library.CandlestickSeries, { upColor: '#10b981', downColor: '#f43f5e', borderUpColor: '#10b981', borderDownColor: '#f43f5e', wickUpColor: '#10b981', wickDownColor: '#f43f5e' });
        const candles = payload.candles.filter(row => row?.date && [row.open, row.high, row.low, row.close].every(Number.isFinite)).map(row => ({ time: row.date, open: row.open, high: row.high, low: row.low, close: row.close }));
        candleSeries.setData(candles);
        const volumeSeries = chart.addSeries(library.HistogramSeries, { priceFormat: { type: 'volume' }, priceScaleId: 'volume', lastValueVisible: false, priceLineVisible: false });
        volumeSeries.setData(payload.candles.filter(row => row?.date && Number.isFinite(Number(row.volume))).map(row => ({ time: row.date, value: Number(row.volume), color: row.close >= row.open ? '#10b98155' : '#f43f5e55' })));
        chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
        const sma5 = [], ema20 = [], ema200 = [];
        let e20 = null, e200 = null;
        payload.candles.forEach((row, index) => {
            const close = Number(row.close);
            if (index >= 4) sma5.push({ time: row.date, value: payload.candles.slice(index - 4, index + 1).reduce((sum, item) => sum + Number(item.close), 0) / 5 });
            e20 = e20 === null ? close : close * (2 / 21) + e20 * (19 / 21);
            e200 = e200 === null ? close : close * (2 / 201) + e200 * (199 / 201);
            if (index >= 19) ema20.push({ time: row.date, value: e20 });
            if (index >= 199) ema200.push({ time: row.date, value: e200 });
        });
        chart.addSeries(library.LineSeries, { color: '#f59e0b', lineWidth: 2, title: 'MA 5', lastValueVisible: false }).setData(sma5);
        chart.addSeries(library.LineSeries, { color: '#22d3ee', lineWidth: 2, title: 'EMA 20', lastValueVisible: false }).setData(ema20);
        chart.addSeries(library.LineSeries, { color: '#a78bfa', lineWidth: 2, title: 'EMA 200', lastValueVisible: false }).setData(ema200);
        const recent = payload.candles.slice(-60);
        const resistance = Math.max(...recent.map(row => Number(row.high)).filter(Number.isFinite));
        const support = Math.min(...recent.map(row => Number(row.low)).filter(Number.isFinite));
        if (Number.isFinite(resistance) && Number.isFinite(support)) {
            candleSeries.createPriceLine({ price: resistance, color: '#fb7185', lineWidth: 1, lineStyle: library.LineStyle.Dashed, axisLabelVisible: true, title: 'Resistance 60D' });
            candleSeries.createPriceLine({ price: support, color: '#34d399', lineWidth: 1, lineStyle: library.LineStyle.Dashed, axisLabelVisible: true, title: 'Support 60D' });
        }
        chart.timeScale().fitContent();
        stockChartResizeObserver = new ResizeObserver(entries => { const width = entries[0]?.contentRect.width; if (width && stockPriceChart) stockPriceChart.applyOptions({ width }); });
        stockChartResizeObserver.observe(container);
        status.textContent = 'Yahoo Finance · candle harian · MA5 / EMA20 / EMA200 · Support/Resistance 60 sesi';
    } catch {
        if (requestId === stockChartRequestId) status.textContent = 'Data realtime/historis emiten ini tidak tersedia di bursa saat ini.';
    }
}

function disposeStockPriceChart() {
    if (stockChartResizeObserver) stockChartResizeObserver.disconnect();
    stockChartResizeObserver = null;
    if (stockPriceChart) stockPriceChart.remove();
    stockPriceChart = null;
}

const stockModalObserver = new MutationObserver(() => {
    if (modalAnalysis?.classList.contains('hidden')) {
        stockChartRequestId += 1;
        disposeStockPriceChart();
        lastRequestedChartTicker = null;
    } else {
        const ticker = String(document.getElementById('modal-stock-ticker')?.textContent || '').trim().toUpperCase();
        if (ticker) renderStockPriceChart(ticker);
    }
});
if (modalAnalysis) stockModalObserver.observe(modalAnalysis, { attributes: true, attributeFilter: ['class'] });
const tickerBadgeObserver = new MutationObserver(() => {
    if (!modalAnalysis?.classList.contains('hidden')) {
        const ticker = String(document.getElementById('modal-stock-ticker')?.textContent || '').trim().toUpperCase();
        if (ticker) renderStockPriceChart(ticker);
    }
});
const tickerBadge = document.getElementById('modal-stock-ticker');
if (tickerBadge) tickerBadgeObserver.observe(tickerBadge, { childList: true, characterData: true, subtree: true });
