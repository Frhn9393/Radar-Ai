// ============================================================
//  MODULE: watchlist.js
//  Watchlist drawer, quick removal, and badge sync
// ============================================================

// ============================================================
//  6. WATCHLIST DRAWER
// ============================================================
btnOpenWatchlist.addEventListener('click', () => {
    renderWatchlistDrawer();
    drawerWatchlist.classList.remove('hidden');
    drawerWatchlist.classList.add('flex');
});

btnCloseWatchlist.addEventListener('click', () => {
    drawerWatchlist.classList.add('hidden');
    drawerWatchlist.classList.remove('flex');
});

drawerWatchlist.addEventListener('click', (e) => {
    if (e.target === drawerWatchlist) {
        btnCloseWatchlist.click();
    }
});

function renderWatchlistDrawer() {
    watchlistItemsContainer.innerHTML = '';
    if (!savedWatchlist || savedWatchlist.length === 0) {
        watchlistItemsContainer.innerHTML = `
            <div class="text-center py-10 px-4 text-slate-500 text-xs">
                <span class="text-3xl block mb-3">⭐</span>
                <p class="font-bold text-slate-400 mb-1">Watchlist Masih Kosong</p>
                <p>Klik tombol <strong class="text-purple-400">+ Watchlist</strong> di pop-up modal analisa saham untuk menyimpan emiten favorit Anda.</p>
            </div>
        `;
        return;
    }
    savedWatchlist.forEach(ticker => {
        const item = document.createElement('div');
        item.className = 'bg-[#0e1626] shadow-sm  p-3 rounded-xl flex items-center justify-between transition';
        item.innerHTML = `
            <div class="flex items-center gap-3 cursor-pointer flex-1" data-action="analyze">
                <span class="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-400 font-mono font-bold text-xs flex items-center justify-center shadow-sm">$</span>
                <div>
                    <h5 class="font-bold text-white font-mono text-sm">${escapeHtml(ticker)}</h5>
                    <p class="text-[11px] text-slate-400">Emiten Terpantau Radar</p>
                </div>
            </div>
            <div class="flex items-center gap-2">
                <button class="text-amber-400 hover:text-amber-300 font-bold text-xs flex items-center gap-1 cursor-pointer" data-action="analyze">
                    Analisa ↗
                </button>
                <button class="w-7 h-7 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs flex items-center justify-center transition cursor-pointer shadow-sm" title="Hapus dari Watchlist" data-action="remove">
                    ✕
                </button>
            </div>
        `;
        item.querySelectorAll('[data-action="analyze"]').forEach(btn => {
            btn.addEventListener('click', () => {
                btnCloseWatchlist.click();
                executeStockAnalysis(ticker);
            });
        });
        item.querySelector('[data-action="remove"]')?.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = savedWatchlist.indexOf(ticker);
            if (idx >= 0) savedWatchlist.splice(idx, 1);
            saveWatchlistToStorage();
            updateWatchlistBadge();
            renderWatchlistDrawer();
        });
        watchlistItemsContainer.appendChild(item);
    });
}
