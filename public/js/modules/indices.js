// ============================================================
//  MODULE: indices.js
//  Live market indices ribbon updater
// ============================================================

// ============================================================
//  7. LIVE MARKET INDICES
// ============================================================
async function loadMarketIndices() {
    const track = document.getElementById('index-ticker-track');
    if (!track) return;
    try {
        const res = await fetch('/api/market-indices');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const indices = data.indices || [];
        if (!indices.length) return;
        track.dataset.marketDataStatus = data.status || (data.is_live === false ? 'degraded' : 'live');
        track.title = data.is_live === false
            ? `Indeks menggunakan data fallback; terakhir diperbarui ${data.last_updated || 'tidak diketahui'}`
            : `Data indeks ${data.status || 'live'}; diperbarui ${data.last_updated || 'baru saja'}`;

        const flagMap = { 'ID': '🇮🇩', 'US': '🇺🇸', 'JP': '🇯🇵' };

        const htmlSet = indices.map(idx => {
            const rawChg = parseFloat(String(idx.changePct || '0').replace('+', ''));
            const isUp = rawChg >= 0;
            const sign = isUp ? '+' : '';
            const colorClass = isUp ? 'text-emerald-400' : 'text-rose-400';
            const flag = flagMap[idx.flag] || idx.flag || '🌐';
            const formattedPrice = escapeHtml(idx.priceFormatted || idx.price || '—');
            const chgText = Number.isFinite(rawChg) ? `${sign}${rawChg.toFixed(2)}%` : `${escapeHtml(idx.changePct)}%`;

            return `<span class="inline-flex items-center gap-1.5 text-xs whitespace-nowrap"><span class="text-slate-400">${escapeHtml(flag)}</span> <b class="text-white">${escapeHtml(idx.name)}:</b> <span class="text-slate-200 font-mono font-medium">${formattedPrice}</span> <span class="${colorClass} font-bold font-mono">${chgText}</span></span>`;
        }).join('');

        // Duplicate set for seamless infinite marquee scroll
        track.innerHTML = `
            <div class="marquee-group flex items-center gap-8 shrink-0">${htmlSet}</div>
            <div class="marquee-group flex items-center gap-8 shrink-0" aria-hidden="true">${htmlSet}</div>
        `;
    } catch (err) {
        console.warn('Market indices update skipped:', err);
    }
}
