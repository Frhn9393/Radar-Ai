// ============================================================
//  MODULE: backtest.js
//  Automated quantitative backtest engine UI, equity canvas, and trade log
// ============================================================

// ============================================================
//  AUTOMATED QUANTITATIVE BACKTEST FRONTEND ENGINE
// ============================================================
let lastBacktestData = null;
let activeTradeFilter = 'all';

const STRATEGY_CONFIGS = {
    'COMPOSITE_QUANT': {
        desc: 'Sinergi konfluensi Supertrend Bullish, posisi di atas EMA20, RSI Sweet Zone (45-68), dan lonjakan volume RVol > 1.15x.',
        tp: 8.0, sl: 3.5, trailing: 3.0
    },
    'SUPERTREND_SWING': {
        desc: 'Membeli saat harga menembus ke atas EMA20 dan Supertrend berbalik arah menjadi Bullish. Exit saat Supertrend berbalik Bearish atau target tercapai.',
        tp: 7.0, sl: 3.5, trailing: 2.5
    },
    'RSI_DIP_BUYER': {
        desc: 'Membeli saat RSI(14) jatuh di bawah level oversold (< 35) yang disertai candle pembalikan arah bullish (close > open).',
        tp: 5.0, sl: 3.0, trailing: 2.0
    },
    'VOLUME_BREAKOUT': {
        desc: 'Menangkap ledakan harga dengan lonjakan Relative Volume (RVol >= 1.5x) yang menembus harga tertinggi 5 hari terakhir.',
        tp: 4.0, sl: 2.0, trailing: 1.5
    },
    'FOREIGN_FLOW_STREAK': {
        desc: 'Mengikuti akumulasi dana besar yang melakukan net-buy berturut-turut dengan harga bertahan di atas moving average support.',
        tp: 6.5, sl: 3.0, trailing: 2.5
    }
};

async function runAutomatedBacktest() {
    const strategySelect = document.getElementById('backtest-strategy-select');
    const tickerInput = document.getElementById('backtest-ticker-input');
    const periodSelect = document.getElementById('backtest-period-select');
    const capitalInput = document.getElementById('backtest-capital-input');
    const tpSlider = document.getElementById('backtest-tp-slider');
    const slSlider = document.getElementById('backtest-sl-slider');
    const trailingSlider = document.getElementById('backtest-trailing-slider');
    const btnRun = document.getElementById('btn-run-backtest');
    const spinner = document.getElementById('backtest-spinner');
    const btnText = document.getElementById('btn-run-backtest-text');

    const ticker = (tickerInput?.value || 'BBCA').trim().toUpperCase().replace(/\.JK$/i, '').replace(/^\$/, '');
    const strategy = strategySelect?.value || 'COMPOSITE_QUANT';
    const period = periodSelect?.value || '1y';
    const capital = capitalInput?.value ? parseFloat(capitalInput.value) : 100000000;
    const tp = tpSlider?.value ? parseFloat(tpSlider.value) : 8.0;
    const sl = slSlider?.value ? parseFloat(slSlider.value) : 3.5;
    const trailing = trailingSlider?.value ? parseFloat(trailingSlider.value) : 3.0;

    if (!ticker) {
        alert('Silakan masukkan kode saham untuk backtest.');
        return;
    }

    if (btnRun) btnRun.disabled = true;
    if (spinner) spinner.classList.remove('hidden');
    if (btnText) btnText.textContent = `Menghitung Kuantitatif ${ticker}...`;

    try {
        const response = await fetch('/api/backtest/run', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ticker,
                strategyKey: strategy,
                period,
                initialCapital: capital,
                customTp: tp,
                customSl: sl,
                customTrailing: trailing
            })
        });

        if (!response.ok) {
            const errJson = await response.json().catch(() => ({}));
            throw new Error(errJson.error || `HTTP ${response.status}`);
        }

        const data = await response.json();
        lastBacktestData = data;
        renderBacktestResults(data);
    } catch (err) {
        console.error('Backtest error:', err);
        alert(`Gagal menjalankan backtest otomatis: ${err.message}`);
    } finally {
        if (btnRun) btnRun.disabled = false;
        if (spinner) spinner.classList.add('hidden');
        if (btnText) btnText.textContent = '⚡ Jalankan Backtest Otomatis';
    }
}

function renderBacktestResults(data) {
    if (!data || !data.metrics) return;
    const m = data.metrics;

    // Metric Cards
    const winEl = document.getElementById('metric-win-rate');
    if (winEl) {
        winEl.textContent = m.winRate;
        winEl.className = `text-2xl sm:text-3xl font-black font-mono ${m.winRateRaw >= 60 ? 'text-emerald-400' : m.winRateRaw >= 45 ? 'text-cyan-300' : 'text-amber-400'}`;
    }

    const winCountEl = document.getElementById('metric-win-count');
    if (winCountEl) winCountEl.textContent = `${m.winningTrades} Menang / ${m.losingTrades} Kalah`;

    const pfEl = document.getElementById('metric-profit-factor');
    if (pfEl) {
        pfEl.textContent = m.profitFactor;
        pfEl.className = `text-2xl sm:text-3xl font-black font-mono ${m.profitFactorRaw >= 2.0 ? 'text-emerald-400' : m.profitFactorRaw >= 1.3 ? 'text-cyan-300' : 'text-rose-400'}`;
    }

    const netRetEl = document.getElementById('metric-net-return');
    if (netRetEl) {
        netRetEl.textContent = m.netReturnPct;
        netRetEl.className = `text-2xl sm:text-3xl font-black font-mono ${m.netReturnRaw >= 0 ? 'text-emerald-400' : 'text-rose-400'}`;
    }

    const netPnlEl = document.getElementById('metric-net-pnl');
    if (netPnlEl) {
        const pnlStr = fmtRp.format(data.netPnl || 0);
        netPnlEl.textContent = `${data.netPnl >= 0 ? '+' : ''}${pnlStr}`;
        netPnlEl.className = `text-[10px] font-mono ${data.netPnl >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}`;
    }

    const benchEl = document.getElementById('metric-benchmark');
    if (benchEl) benchEl.textContent = `B&H: ${m.benchmarkReturnPct} (Alpha: ${m.alpha})`;

    const mddEl = document.getElementById('metric-mdd');
    if (mddEl) mddEl.textContent = m.maxDrawdown;

    const rrEl = document.getElementById('metric-risk-reward');
    if (rrEl) rrEl.textContent = m.riskRewardRatio;

    const avgGainLossEl = document.getElementById('metric-avg-win-loss');
    if (avgGainLossEl) avgGainLossEl.textContent = `${m.avgWinPct} / ${m.avgLossPct}`;

    const totalTradesEl = document.getElementById('metric-total-trades');
    if (totalTradesEl) totalTradesEl.textContent = m.totalTrades;

    const holdTimeEl = document.getElementById('metric-hold-time');
    if (holdTimeEl) holdTimeEl.textContent = `Avg Hold: ${m.avgHoldDays}`;

    const chartBadge = document.getElementById('chart-ticker-badge');
    if (chartBadge) chartBadge.textContent = `$${data.ticker} • ${data.strategy?.name || 'Quant Model'}`;

    // Render Equity Curve Canvas Chart
    drawEquityCurve(data.equityCurve, data.ticker);

    // Render Trade Log Table
    renderTradeLog(data.tradeLog);
}

function drawEquityCurve(equityCurve, ticker) {
    const canvas = document.getElementById('backtest-equity-chart');
    const emptyState = document.getElementById('backtest-chart-empty');
    if (!canvas || !equityCurve || equityCurve.length === 0) return;

    if (emptyState) emptyState.classList.add('hidden');

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = rect.width || 600;
    const height = rect.height || 260;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    const padding = { top: 25, right: 25, bottom: 30, left: 75 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    if (chartW <= 0 || chartH <= 0) return;

    const allValues = [];
    equityCurve.forEach(p => {
        if (p.portfolioValue) allValues.push(p.portfolioValue);
        if (p.benchmarkValue) allValues.push(p.benchmarkValue);
    });

    const minVal = Math.min(...allValues) * 0.98;
    const maxVal = Math.max(...allValues) * 1.02;
    const valRange = (maxVal - minVal) || 1;

    const getX = (idx) => padding.left + (idx / Math.max(1, equityCurve.length - 1)) * chartW;
    const getY = (val) => padding.top + chartH - ((val - minVal) / valRange) * chartH;

    // 1. Gridlines & Y-axis labels
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#64748b';
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';

    const yTicks = 4;
    for (let i = 0; i <= yTicks; i++) {
        const val = minVal + (i / yTicks) * valRange;
        const y = getY(val);

        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(width - padding.right, y);
        ctx.stroke();

        const labelStr = `Rp ${(val / 1e6).toFixed(1)}M`;
        ctx.fillText(labelStr, padding.left - 8, y + 3);
    }

    // 2. X-axis date labels
    ctx.textAlign = 'center';
    ctx.fillStyle = '#64748b';
    const xStep = Math.max(1, Math.floor(equityCurve.length / 5));
    for (let i = 0; i < equityCurve.length; i += xStep) {
        const x = getX(i);
        const dateStr = equityCurve[i].date ? equityCurve[i].date.substring(5) : '';
        ctx.fillText(dateStr, x, height - 8);
    }

    // 3. Draw Benchmark Line (Dashed Slate)
    ctx.beginPath();
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    equityCurve.forEach((p, idx) => {
        const x = getX(idx);
        const y = getY(p.benchmarkValue || p.portfolioValue);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.setLineDash([]); // reset

    // 4. Draw Strategy Gradient Area Fill
    const areaGrad = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom);
    areaGrad.addColorStop(0, 'rgba(16, 185, 129, 0.25)');
    areaGrad.addColorStop(1, 'rgba(16, 185, 129, 0.00)');

    ctx.beginPath();
    equityCurve.forEach((p, idx) => {
        const x = getX(idx);
        const y = getY(p.portfolioValue);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.lineTo(getX(equityCurve.length - 1), padding.top + chartH);
    ctx.lineTo(getX(0), padding.top + chartH);
    ctx.closePath();
    ctx.fillStyle = areaGrad;
    ctx.fill();

    // 5. Draw Strategy Line (Solid Emerald)
    ctx.beginPath();
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2.5;
    equityCurve.forEach((p, idx) => {
        const x = getX(idx);
        const y = getY(p.portfolioValue);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // 6. Final marker dot
    if (equityCurve.length > 0) {
        const lastIdx = equityCurve.length - 1;
        const lastPoint = equityCurve[lastIdx];
        const lastX = getX(lastIdx);
        const lastY = getY(lastPoint.portfolioValue);

        ctx.beginPath();
        ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#10b981';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
    }
}

function renderTradeLog(trades = []) {
    const tbody = document.getElementById('tbody-backtest-trades');
    if (!tbody) return;

    let filtered = trades;
    if (activeTradeFilter === 'win') {
        filtered = trades.filter(t => t.status === 'WIN');
    } else if (activeTradeFilter === 'loss') {
        filtered = trades.filter(t => t.status === 'LOSS');
    }

    if (filtered.length === 0) {
        tbody.innerHTML = `
                <tr>
                    <td colspan="11" class="p-8 text-center text-slate-500 font-sans text-xs">
                        Tidak ada transaksi yang cocok dengan filter "${activeTradeFilter.toUpperCase()}".
                    </td>
                </tr>
            `;
        return;
    }

    tbody.innerHTML = filtered.map(t => {
        const isWin = t.status === 'WIN';
        const statusBadge = isWin
            ? '<span class="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-500/20 text-emerald-400 shadow-sm">WIN</span>'
            : '<span class="px-2 py-0.5 rounded text-[10px] font-black bg-rose-500/20 text-rose-400 shadow-sm">LOSS</span>';
        const pnlFormatted = `${t.netPnl >= 0 ? '+' : ''}${fmtRp.format(t.netPnl)}`;
        const pnlColor = isWin ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold';
        const returnFormatted = `${t.gainPct >= 0 ? '+' : ''}${t.gainPct.toFixed(2)}%`;

        return `
                <tr class="hover:bg-[#111a2e] transition group">
                    <td class="p-3 text-slate-500 font-sans">#${t.tradeNumber}</td>
                    <td class="p-3 text-slate-300 font-sans">${t.entryDate}</td>
                    <td class="p-3 text-white font-bold">${fmtRp.format(t.entryPrice)}</td>
                    <td class="p-3 text-cyan-300">${t.lots} lot <span class="text-[10px] text-slate-500">(${fmtNum.format(t.shares)})</span></td>
                    <td class="p-3 text-slate-300 font-sans">${t.exitDate}</td>
                    <td class="p-3 text-white font-bold">${fmtRp.format(t.exitPrice)}</td>
                    <td class="p-3 text-slate-400 font-sans">${t.holdDays} hari</td>
                    <td class="p-3 text-right ${pnlColor}">${pnlFormatted}</td>
                    <td class="p-3 text-right ${pnlColor}">${returnFormatted}</td>
                    <td class="p-3 text-center">${statusBadge}</td>
                    <td class="p-3 text-[11px] text-slate-400 font-sans group-hover:text-slate-200">${t.exitReason}</td>
                </tr>
            `;
    }).join('');
}

function initBacktestModule() {
    const strategySelect = document.getElementById('backtest-strategy-select');
    const descEl = document.getElementById('backtest-strategy-desc');
    const tpSlider = document.getElementById('backtest-tp-slider');
    const slSlider = document.getElementById('backtest-sl-slider');
    const trailingSlider = document.getElementById('backtest-trailing-slider');
    const tpLabel = document.getElementById('label-tp-val');
    const slLabel = document.getElementById('label-sl-val');
    const trailingLabel = document.getElementById('label-trailing-val');

    // Strategy Selector Change Handler
    strategySelect?.addEventListener('change', () => {
        const key = strategySelect.value;
        const cfg = STRATEGY_CONFIGS[key] || STRATEGY_CONFIGS.COMPOSITE_QUANT;
        if (descEl) {
            descEl.innerHTML = `<span class="text-violet-400">ℹ️</span> <span>${cfg.desc}</span>`;
        }
        if (tpSlider && tpLabel) {
            tpSlider.value = cfg.tp;
            tpLabel.textContent = `+${cfg.tp.toFixed(1)}%`;
        }
        if (slSlider && slLabel) {
            slSlider.value = cfg.sl;
            slLabel.textContent = `-${cfg.sl.toFixed(1)}%`;
        }
        if (trailingSlider && trailingLabel) {
            trailingSlider.value = cfg.trailing;
            trailingLabel.textContent = `${cfg.trailing.toFixed(1)}%`;
        }
    });

    // Sliders Dynamic Value Updates
    tpSlider?.addEventListener('input', () => {
        if (tpLabel) tpLabel.textContent = `+${parseFloat(tpSlider.value).toFixed(1)}%`;
    });
    slSlider?.addEventListener('input', () => {
        if (slLabel) slLabel.textContent = `-${parseFloat(slSlider.value).toFixed(1)}%`;
    });
    trailingSlider?.addEventListener('input', () => {
        if (trailingLabel) trailingLabel.textContent = `${parseFloat(trailingSlider.value).toFixed(1)}%`;
    });

    // Quick Pick Chip Buttons
    document.querySelectorAll('.quick-pick-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const ticker = chip.getAttribute('data-ticker');
            const tickerInput = document.getElementById('backtest-ticker-input');
            if (tickerInput && ticker) {
                tickerInput.value = ticker;
                runAutomatedBacktest();
            }
        });
    });

    // Trigger Run Button
    document.getElementById('btn-run-backtest')?.addEventListener('click', runAutomatedBacktest);

    // Trade Filter Buttons (All, Win, Loss)
    const btnFilterAll = document.getElementById('filter-trade-all');
    const btnFilterWin = document.getElementById('filter-trade-win');
    const btnFilterLoss = document.getElementById('filter-trade-loss');

    const updateFilterButtons = (active) => {
        activeTradeFilter = active;
        [
            { btn: btnFilterAll, name: 'all' },
            { btn: btnFilterWin, name: 'win' },
            { btn: btnFilterLoss, name: 'loss' }
        ].forEach(f => {
            if (f.btn) {
                if (f.name === active) {
                    f.btn.className = 'px-2.5 py-1 rounded-md font-semibold text-white bg-slate-800 transition cursor-pointer';
                } else {
                    f.btn.className = 'px-2.5 py-1 rounded-md font-medium text-slate-400 hover:text-white transition cursor-pointer';
                }
            }
        });
        if (lastBacktestData) {
            renderTradeLog(lastBacktestData.tradeLog);
        }
    };

    btnFilterAll?.addEventListener('click', () => updateFilterButtons('all'));
    btnFilterWin?.addEventListener('click', () => updateFilterButtons('win'));
    btnFilterLoss?.addEventListener('click', () => updateFilterButtons('loss'));

    // Export Backtest CSV Button
    document.getElementById('btn-export-backtest-csv')?.addEventListener('click', () => {
        if (!lastBacktestData || !lastBacktestData.tradeLog || lastBacktestData.tradeLog.length === 0) {
            alert('Belum ada data transaksi backtest untuk diekspor.');
            return;
        }

        const todayStr = new Date().toISOString().split('T')[0];
        let csv = 'Trade#,Ticker,Tanggal Beli,Harga Beli,Lot,Lembar Saham,Tanggal Jual,Harga Jual,Durasi (Hari),Net Profit/Loss (Rp),Return (%),Status,Alasan Exit\n';

        lastBacktestData.tradeLog.forEach(t => {
            csv += `"${t.tradeNumber}","${t.ticker}","${t.entryDate}","${t.entryPrice}","${t.lots}","${t.shares}","${t.exitDate}","${t.exitPrice}","${t.holdDays}","${t.netPnl}","${t.gainPct}%","${t.status}","${t.exitReason}"\n`;
        });

        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `RADAR_AI_BACKTEST_${lastBacktestData.ticker}_${todayStr}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    // Window resize re-renders canvas
    window.addEventListener('resize', () => {
        if (lastBacktestData && lastBacktestData.equityCurve) {
            drawEquityCurve(lastBacktestData.equityCurve, lastBacktestData.ticker);
        }
    });
}
