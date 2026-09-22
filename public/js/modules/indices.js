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
        const data = await res.json();
        const indices = data.indices || [];
        if (!indices.length) return;

        const htmlSet = indices.map(idx => {
            const isUp = (idx.changePct || 0) >= 0;
            const sign = isUp ? '+' : '';
            const colorClass = isUp ? 'text-emerald-400' : 'text-rose-400';
            const flag = idx.flag || '🌐';
            return `<span class="inline-flex items-center gap-1.5"><span class="text-slate-400">${flag}</span> <b class="text-white">${idx.name}:</b> <span class="text-slate-200">${idx.priceFormatted || idx.price}</span> <span class="${colorClass} font-bold">${sign}${idx.changePct}%</span></span>`;
        }).join('');

        // Duplicate set for seamless infinite marquee scroll
        track.innerHTML = `
            <div class="flex items-center gap-8">${htmlSet}</div>
            <div class="flex items-center gap-8">${htmlSet}</div>
        `;
    } catch (err) {
        console.warn('Market indices update skipped:', err);
    }
}
