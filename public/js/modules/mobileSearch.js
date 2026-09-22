// ============================================================
//  MODULE: mobileSearch.js
//  Mobile search modal controller and quick chip navigation
// ============================================================

// ============================================================
//  INITIALIZATION
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    updateWatchlistBadge();
    loadDeals();
    loadMarketNews();
    loadMarketIndices();
    loadForeignFlowData(); // Pre-load Foreign Flow so data is immediately cached
    initBacktestModule(); // Initialize Automated Backtest module
    startAutoStream();
});


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