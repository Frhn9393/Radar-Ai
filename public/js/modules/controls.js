// ============================================================
//  MODULE: controls.js
//  Global app controls: stream polling, sound toggle, refresh, and data export
// ============================================================

// ============================================================
//  8. CONTROLS: STREAM, SOUND, EXPORT, REFRESH
// ============================================================
let streamRefreshInFlight = false;
btnToggleStream?.addEventListener('click', () => {
    autoStreamActive = !autoStreamActive;
    if (autoStreamActive) {
        if (textStreamStatus) textStreamStatus.textContent = 'Jeda Auto-Stream';
        iconStreamStatus?.classList.remove('text-slate-500');
        iconStreamStatus?.classList.add('text-amber-400');
        startAutoStream();
    } else {
        if (textStreamStatus) textStreamStatus.textContent = 'Lanjutkan Auto-Stream';
        iconStreamStatus?.classList.remove('text-amber-400');
        iconStreamStatus?.classList.add('text-slate-500');
        stopAutoStream();
    }
});

function startAutoStream() {
    stopAutoStream();
    if (!autoStreamActive || document.hidden) return;
    streamInterval = setInterval(() => {
        if (document.hidden || streamRefreshInFlight || !autoStreamActive) return;
        streamRefreshInFlight = true;
        const tasks = [];
        if (typeof loadMarketNews === 'function') tasks.push(loadMarketNews());
        if (typeof loadDeals === 'function') tasks.push(loadDeals());
        if (typeof loadMarketIndices === 'function') tasks.push(loadMarketIndices());
        if (typeof allForeignData !== 'undefined' && allForeignData && typeof loadForeignFlowData === 'function') {
            tasks.push(loadForeignFlowData());
        }
        Promise.allSettled(tasks).finally(() => { streamRefreshInFlight = false; });
    }, NEWS_AUTO_REFRESH_MS);
}

function stopAutoStream() {
    if (streamInterval) {
        clearInterval(streamInterval);
        streamInterval = null;
    }
}

document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopAutoStream();
    else if (autoStreamActive) startAutoStream();
});

btnToggleSound?.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    if (soundEnabled) {
        iconSound?.classList.remove('text-slate-500');
        iconSound?.classList.add('text-emerald-400');
        if (btnToggleSound) btnToggleSound.title = 'Notifikasi Suara: Aktif';
        playSoundChime();
    } else {
        iconSound?.classList.remove('text-emerald-400');
        iconSound?.classList.add('text-slate-500');
        if (btnToggleSound) btnToggleSound.title = 'Notifikasi Suara: Nonaktif';
    }
});

btnRefreshAll?.addEventListener('click', () => {
    const icon = document.getElementById('icon-refresh');
    icon?.classList.add('animate-spin');
    const tasks = [];
    if (typeof loadDeals === 'function') tasks.push(loadDeals());
    if (typeof loadMarketNews === 'function') tasks.push(loadMarketNews());
    if (typeof loadMarketIndices === 'function') tasks.push(loadMarketIndices());
    if (typeof loadForeignFlowData === 'function') tasks.push(loadForeignFlowData(true));

    Promise.all(tasks).finally(() => {
        setTimeout(() => icon?.classList.remove('animate-spin'), 600);
    });
});

btnExportData?.addEventListener('click', () => {
    const todayStr = new Date().toISOString().slice(0, 10);

    if (currentActiveMainTab === 'foreign') {
        // Tab 3: Export Foreign Flow Data to CSV
        if (!allForeignData || (!allForeignData.daily?.topBuy?.length && !allForeignData.daily?.topSell?.length)) {
            alert('Data Foreign Flow belum siap untuk diekspor.');
            return;
        }

        let csv = 'Kategori,Ticker,Nama Emiten,Sektor,Harga Terakhir,Change (%),Net Foreign 1D (Miliar Rp),Net Foreign 5D (Miliar Rp),Foreign VWAP (Rp),FFPI (Pressure),Streak (Hari),Streak Nilai (Miliar Rp),Status / Fase\n';

        // Daily Top Buy
        (allForeignData.daily?.topBuy || []).forEach(item => {
            csv += `"Top Foreign Buy 1D","${item.ticker}","${item.name || ''}","${item.sector || ''}","${item.lastPrice || 0}","${item.changePct || 0}","${((item.netForeignVal || 0) / 1e9).toFixed(2)}","${((item.weeklyNetVal || 0) / 1e9).toFixed(2)}","${item.vwap || item.foreignVWAP || 0}","${item.ffpi || 0}","${item.streakDays || 0}","${((item.streakTotalVal || 0) / 1e9).toFixed(2)}","${(item.status || 'AKUMULASI ASING').replace(/"/g, '""')}"\n`;
        });

        // Daily Top Sell
        (allForeignData.daily?.topSell || []).forEach(item => {
            csv += `"Top Foreign Sell 1D","${item.ticker}","${item.name || ''}","${item.sector || ''}","${item.lastPrice || 0}","${item.changePct || 0}","${((item.netForeignVal || 0) / 1e9).toFixed(2)}","${((item.weeklyNetVal || 0) / 1e9).toFixed(2)}","${item.vwap || item.foreignVWAP || 0}","${item.ffpi || 0}","${item.streakDays || 0}","${((item.streakTotalVal || 0) / 1e9).toFixed(2)}","${(item.status || 'DISTRIBUSI ASING').replace(/"/g, '""')}"\n`;
        });

        // Weekly Accumulation
        (allForeignData.weekly?.topAccumulation || []).forEach(item => {
            csv += `"Weekly Accumulation 5D","${item.ticker}","${item.name || ''}","${item.sector || ''}","${item.lastPrice || 0}","${item.changePct || 0}","${((item.netForeignVal || 0) / 1e9).toFixed(2)}","${((item.weeklyNetVal || 0) / 1e9).toFixed(2)}","${item.vwap || 0}","${item.ffpi || 0}","${item.streakDays || 0}","${((item.streakTotalVal || 0) / 1e9).toFixed(2)}","${(item.phase || 'Akumulasi').replace(/"/g, '""')}"\n`;
        });

        // Inflow Streaks
        (allForeignData.streak?.streaks || []).forEach(item => {
            csv += `"Streak Akumulasi Asing","${item.ticker}","${item.name || ''}","${item.sector || ''}","${item.lastPrice || 0}","${item.changePct || 0}","${((item.netForeignVal || 0) / 1e9).toFixed(2)}","${((item.weeklyNetVal || 0) / 1e9).toFixed(2)}","${item.foreignVWAP || 0}","${item.ffpi || 0}","${item.streakDays || 0}","${((item.streakTotalVal || 0) / 1e9).toFixed(2)}","Streak ${item.streakDays} Hari"\n`;
        });

        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `STOCKRADAR_FOREIGN_FLOW_${todayStr}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
    }

    if (currentActiveMainTab === 'screener') {
        // Tab 2: Export Screener Recommendations
        if (!lastScreenerData) {
            alert('Data rekomendasi screener belum siap untuk diekspor.');
            return;
        }

        let csv = 'Kategori,Rank,Ticker,Harga Terakhir,Change (%),Sinyal Entri,Supertrend,RSI (14),EMA 200,Support,Target Konservatif,Target Agresif,Cut Loss,Horizon,Win Rate Backtest,Profit Factor\n';
        const cats = [
            { key: 'scalping', label: 'Scalping Sesi 1' },
            { key: 'daytrade', label: 'Day Trading' },
            { key: 'swing', label: 'Swing Trade' },
            { key: 'bsjp', label: 'Beli Sore Jual Pagi (BSJP)' },
            { key: 'bpjp', label: 'Beli Pagi Jual Pagi (BPJP)' },
            { key: 'longterm', label: 'Investasi Jangka Menengah / Panjang' }
        ];

        cats.forEach(c => {
            const list = lastScreenerData[c.key] || [];
            list.forEach((item, idx) => {
                csv += `"${c.label}","#${idx + 1}","${item.ticker}","${item.price}","${item.changePct}%","${item.sinyalEntri || '-'}","${item.supertrendBadge || '-'}","${item.rsi || '-'}","${item.ema200 || '-'}","${item.support || '-'}","${item.targetKonservatif || '-'}","${item.targetAgresif || '-'}","${item.cutLoss || '-'}","${item.horizon || '-'}","${item.backtest?.winRate || '-'}","${item.backtest?.profitFactor || '-'}"\n`;
            });
        });

        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `STOCKRADAR_SCREENER_${todayStr}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
    }

    // Default / Tab 1: Export M&A Deals to CSV
    if (!allDeals || !allDeals.length) {
        alert('Data deal belum siap untuk diekspor.');
        return;
    }

    let csv = 'ID,Status,Akurasi,Emiten,Sumber,Estimasi Nilai Deal,Dampak,Link Berita,Judul\n';
    allDeals.forEach(d => {
        csv += `"${d.id}","${d.typeLabel}","${d.accuracy}%","${d.tickers.join(' ')}","${d.source}","${d.dealValue}","${d.impact}","${d.link || ''}","${d.title.replace(/"/g, '""')}"\n`;
    });

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `STOCKRADAR_M&A_DEALS_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});
