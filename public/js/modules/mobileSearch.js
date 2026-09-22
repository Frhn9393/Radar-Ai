// ============================================================
//  MODULE: mobileSearch.js
//  Mobile search modal controller and quick chip navigation
// ============================================================

// ============================================================
//  MOBILE SEARCH MODAL ENGINE
// ============================================================
const modalMobileSearch = document.getElementById('modal-mobile-search');
const btnMobileSearchPill = document.getElementById('btn-mobile-search-pill');
const btnCloseMobileSearch = document.getElementById('btn-close-mobile-search');
const inputMobileSearch = document.getElementById('input-mobile-search');
const btnClearMobileSearch = document.getElementById('btn-clear-mobile-search');
const mobileSearchResults = document.getElementById('mobile-search-results');
const mobileSearchQuickPicks = document.getElementById('mobile-search-quick-picks');
let mobileSearchDebounce = null;

function openMobileSearch() {
    if (!modalMobileSearch) return;
    modalMobileSearch.classList.remove('hidden');
    modalMobileSearch.classList.add('flex');
    document.body.style.overflow = 'hidden';
    setTimeout(() => inputMobileSearch?.focus(), 50);
}

function closeMobileSearch() {
    if (!modalMobileSearch) return;
    modalMobileSearch.classList.add('hidden');
    modalMobileSearch.classList.remove('flex');
    document.body.style.overflow = '';
    if (inputMobileSearch) inputMobileSearch.value = '';
    if (mobileSearchResults) mobileSearchResults.innerHTML = '';
    if (mobileSearchQuickPicks) mobileSearchQuickPicks.classList.remove('hidden');
    if (btnClearMobileSearch) btnClearMobileSearch.classList.add('hidden');
}

btnMobileSearchPill?.addEventListener('click', openMobileSearch);
btnCloseMobileSearch?.addEventListener('click', closeMobileSearch);

btnClearMobileSearch?.addEventListener('click', () => {
    if (inputMobileSearch) {
        inputMobileSearch.value = '';
        inputMobileSearch.focus();
    }
    if (mobileSearchResults) mobileSearchResults.innerHTML = '';
    if (mobileSearchQuickPicks) mobileSearchQuickPicks.classList.remove('hidden');
    btnClearMobileSearch.classList.add('hidden');
});

// Quick chip clicks in mobile search
document.querySelectorAll('.mobile-quick-chip').forEach(chip => {
    chip.addEventListener('click', () => {
        const ticker = chip.getAttribute('data-ticker');
        if (ticker) {
            closeMobileSearch();
            executeStockAnalysis(ticker);
        }
    });
});

inputMobileSearch?.addEventListener('input', (e) => {
    const q = (e.target.value || '').trim().replace(/^[$#]/, '');
    if (q) {
        btnClearMobileSearch?.classList.remove('hidden');
        mobileSearchQuickPicks?.classList.add('hidden');
    } else {
        btnClearMobileSearch?.classList.add('hidden');
        mobileSearchQuickPicks?.classList.remove('hidden');
        if (mobileSearchResults) mobileSearchResults.innerHTML = '';
        return;
    }

    clearTimeout(mobileSearchDebounce);
    mobileSearchDebounce = setTimeout(async () => {
        try {
            const res = await fetch(`/api/search-suggest?q=${encodeURIComponent(q)}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            const matches = data.suggestions || [];

            if (!mobileSearchResults) return;
            if (matches.length === 0) {
                mobileSearchResults.innerHTML = `
                    <div class="bg-[#0d1424] p-4 rounded-xl text-center space-y-2 cursor-pointer shadow-lg" id="mobile-fallback-action">
                        <p class="text-sm font-bold text-white">Analisis langsung emiten <span class="text-amber-400 font-mono font-black">$${q.toUpperCase()}</span></p>
                        <p class="text-xs text-slate-400">Tekan di sini untuk memuat data kuantitatif</p>
                    </div>
                `;
                document.getElementById('mobile-fallback-action')?.addEventListener('click', () => {
                    closeMobileSearch();
                    executeStockAnalysis(q.toUpperCase());
                });
                return;
            }

            mobileSearchResults.innerHTML = matches.map(item => `
                <div class="mobile-search-item bg-[#0d1424] hover:bg-[#131e33] p-3.5 rounded-xl flex items-center justify-between cursor-pointer transition shadow-md" data-ticker="${item.ticker}">
                    <div class="flex items-center gap-3 min-w-0">
                        <div class="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-300 font-mono font-black text-sm shrink-0">
                            $${item.ticker.slice(0, 3)}
                        </div>
                        <div class="min-w-0">
                            <div class="flex items-center gap-2">
                                <span class="font-mono font-black text-white text-sm">$${item.ticker}</span>
                                <span class="text-[10px] px-1.5 py-0.5 rounded bg-[#162035] text-slate-300 font-medium truncate">${item.sector || 'IDX'}</span>
                            </div>
                            <p class="text-xs text-slate-400 truncate mt-0.5">${item.name}</p>
                        </div>
                    </div>
                    <span class="text-xs font-bold text-emerald-400 font-mono bg-emerald-950/60 px-2.5 py-1 rounded-lg shrink-0 ml-2">
                        Buka ➔
                    </span>
                </div>
            `).join('');

            mobileSearchResults.querySelectorAll('.mobile-search-item').forEach(el => {
                el.addEventListener('click', () => {
                    const ticker = el.getAttribute('data-ticker');
                    if (ticker) {
                        closeMobileSearch();
                        executeStockAnalysis(ticker);
                    }
                });
            });
        } catch (err) {
            console.error('Mobile search error:', err);
        }
    }, 50);
});

inputMobileSearch?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        const val = inputMobileSearch.value.trim().toUpperCase().replace(/^[$#]/, '');
        if (val) {
            closeMobileSearch();
            executeStockAnalysis(val);
        }
    } else if (e.key === 'Escape') {
        closeMobileSearch();
    }
});