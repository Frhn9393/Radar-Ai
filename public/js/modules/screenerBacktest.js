const portfolioBacktestButton = document.getElementById('btn-run-screener-backtest');
document.getElementById('btn-test-telegram-alert')?.addEventListener('click', async event => {
    const button = event.currentTarget;
    const original = button.innerHTML;
    button.disabled = true;
    button.textContent = 'Mengirim tes…';
    try {
        const response = await fetch('/api/telegram/test-alert', { method: 'POST' });
        const result = await response.json();
        if (!response.ok || !result.ok) throw new Error(result.error || 'Tes Telegram gagal.');
        button.textContent = '✓ Terkirim';
    } catch (error) {
        button.textContent = 'Gagal mengirim';
        window.alert(error.message || 'Tidak dapat mengirim notifikasi tes.');
    } finally {
        window.setTimeout(() => { button.innerHTML = original; button.disabled = false; }, 2200);
    }
});

portfolioBacktestButton?.addEventListener('click', async () => {
    const status = document.getElementById('screener-backtest-status');
    const tickers = String(document.getElementById('screener-backtest-tickers')?.value || '').split(',').map(value => value.trim()).filter(Boolean);
    const period = document.getElementById('screener-backtest-period')?.value || '3m';
    portfolioBacktestButton.disabled = true;
    portfolioBacktestButton.textContent = 'Menghitung…';
    if (status) status.textContent = 'Mengambil candle historis Yahoo Finance…';
    try {
        const response = await fetch('/api/backtest', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ tickers, period }) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Backtest gagal.');
        const metrics = result.metrics;
        document.getElementById('portfolio-bt-winrate').textContent = `${metrics.winRate}% (${metrics.totalTrades} transaksi)`;
        document.getElementById('portfolio-bt-return').textContent = `${metrics.totalReturnPct >= 0 ? '+' : ''}${metrics.totalReturnPct}%`;
        document.getElementById('portfolio-bt-gain').textContent = `+${metrics.avgGainPct}%`;
        document.getElementById('portfolio-bt-loss').textContent = `${metrics.avgLossPct}%`;
        document.getElementById('portfolio-bt-drawdown').textContent = `-${metrics.maxDrawdownPct}%`;
        drawPortfolioBacktestEquity(result.equityCurve);
        if (status) status.textContent = `${result.dataSource} · ${result.tickers.join(', ')} · ${result.strategies.join(', ')}${result.errors.length ? ` · Data gagal: ${result.errors.map(item => item.ticker).join(', ')}` : ''}`;
    } catch (error) {
        if (status) status.textContent = error.message || 'Backtest gagal dimuat.';
    } finally {
        portfolioBacktestButton.disabled = false;
        portfolioBacktestButton.textContent = 'Jalankan Backtest';
    }
});

function drawPortfolioBacktestEquity(points) {
    const canvas = document.getElementById('portfolio-bt-equity');
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, rect.width * ratio);
    canvas.height = Math.max(1, rect.height * ratio);
    const context = canvas.getContext('2d');
    context.scale(ratio, ratio);
    context.clearRect(0, 0, rect.width, rect.height);
    if (!Array.isArray(points) || points.length < 2) {
        context.fillStyle = '#64748b'; context.font = '12px sans-serif'; context.fillText('Belum ada transaksi pada periode ini.', 12, 24); return;
    }
    const values = points.map(point => Number(point.portfolioValue)).filter(Number.isFinite);
    const min = Math.min(...values), max = Math.max(...values), range = max - min || 1;
    const padding = { left: 8, right: 8, top: 12, bottom: 10 };
    const x = index => padding.left + index / (values.length - 1) * (rect.width - padding.left - padding.right);
    const y = value => padding.top + (max - value) / range * (rect.height - padding.top - padding.bottom);
    context.strokeStyle = '#22d3ee'; context.lineWidth = 2; context.beginPath();
    values.forEach((value, index) => index ? context.lineTo(x(index), y(value)) : context.moveTo(x(index), y(value)));
    context.stroke();
    context.lineTo(x(values.length - 1), rect.height - padding.bottom); context.lineTo(x(0), rect.height - padding.bottom); context.closePath();
    context.fillStyle = 'rgba(34, 211, 238, .10)'; context.fill();
}
