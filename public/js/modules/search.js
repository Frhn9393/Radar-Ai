// ============================================================
//  MODULE: search.js
//  Autocomplete search engine, keyboard selection, and suggestions popup
// ============================================================

// ============================================================
//  IDX ALL STOCKS DYNAMIC SEARCH & AUTOCOMPLETE ENGINE
// ============================================================
const searchSuggestDropdown = document.getElementById('search-suggest-dropdown');
let activeSuggestIndex = -1;
let searchDebounceTimer = null;

async function showSearchSuggestions(query) {
    if (!searchSuggestDropdown) return;
    const q = (query || '').trim().replace(/^[\$#]/, '');

    if (!q) {
        searchSuggestDropdown.classList.add('hidden');
        searchSuggestDropdown.innerHTML = '';
        activeSuggestIndex = -1;
        return;
    }

    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(async () => {
        try {
            const res = await fetch(`/api/search-suggest?q=${encodeURIComponent(q)}`);
            const data = await res.json();
            const matches = data.suggestions || [];

            if (matches.length === 0) {
                searchSuggestDropdown.innerHTML = `
                    <div class="p-3 text-center text-slate-300 hover:text-white hover:bg-[#131e33] text-xs cursor-pointer transition select-none" id="suggest-fallback-action">
                        🔍 Analisa langsung emiten "<strong class="text-amber-400 font-mono">${q.toUpperCase()}</strong>" (Klik atau Tekan Enter)
                    </div>
                `;
                searchSuggestDropdown.classList.remove('hidden');
                document.getElementById('suggest-fallback-action')?.addEventListener('click', () => {
                    headerSearchInput.value = q.toUpperCase();
                    searchSuggestDropdown.classList.add('hidden');
                    activeSuggestIndex = -1;
                    executeStockAnalysis(q.toUpperCase());
                });
                activeSuggestIndex = -1;
                return;
            }

            searchSuggestDropdown.innerHTML = matches.map((item, idx) => `
                <div class="suggest-item flex items-center justify-between p-2.5 hover:bg-[#131e33]   cursor-pointer transition select-none ${idx === activeSuggestIndex ? 'bg-[#142036]' : ''}" data-ticker="${item.ticker}">
                    <div class="flex items-center gap-2.5">
                        <span class="bg-cyan-500/20 text-cyan-400 shadow-sm text-xs font-mono font-bold px-2 py-0.5 rounded shadow-sm">$${item.ticker}</span>
                        <div class="flex flex-col text-left">
                            <span class="text-xs font-bold text-white leading-tight">${item.name}</span>
                            <span class="text-[10px] text-slate-400 leading-tight">${item.sector}</span>
                        </div>
                    </div>
                    <span class="text-[10px] text-emerald-400 font-mono font-semibold bg-emerald-950/40 px-1.5 py-0.5 rounded shadow-sm flex items-center gap-1">
                        ANALISIS ➔
                    </span>
                </div>
            `).join('');

            // Attach click event to all items
            searchSuggestDropdown.querySelectorAll('.suggest-item').forEach(el => {
                el.addEventListener('click', () => {
                    const ticker = el.getAttribute('data-ticker');
                    if (ticker) {
                        headerSearchInput.value = ticker;
                        searchSuggestDropdown.classList.add('hidden');
                        activeSuggestIndex = -1;
                        executeStockAnalysis(ticker);
                    }
                });
            });

            searchSuggestDropdown.classList.remove('hidden');
        } catch (err) {
            console.error('Search suggest error:', err);
        }
    }, 60);
}

function updateSuggestHighlight(items) {
    items.forEach((item, idx) => {
        if (idx === activeSuggestIndex) {
            item.classList.add('bg-[#142036]');
            item.scrollIntoView({ block: 'nearest' });
        } else {
            item.classList.remove('bg-[#142036]');
        }
    });
}

// Input events for search suggestions
headerSearchInput.addEventListener('input', (e) => {
    showSearchSuggestions(e.target.value);
});

headerSearchInput.addEventListener('focus', (e) => {
    if (e.target.value.trim()) {
        showSearchSuggestions(e.target.value);
    }
});

headerSearchInput.addEventListener('keydown', (e) => {
    const items = searchSuggestDropdown?.querySelectorAll('.suggest-item');
    if (e.key === 'ArrowDown') {
        if (searchSuggestDropdown && !searchSuggestDropdown.classList.contains('hidden') && items && items.length > 0) {
            e.preventDefault();
            activeSuggestIndex = (activeSuggestIndex + 1) % items.length;
            updateSuggestHighlight(items);
        }
    } else if (e.key === 'ArrowUp') {
        if (searchSuggestDropdown && !searchSuggestDropdown.classList.contains('hidden') && items && items.length > 0) {
            e.preventDefault();
            activeSuggestIndex = (activeSuggestIndex - 1 + items.length) % items.length;
            updateSuggestHighlight(items);
        }
    } else if (e.key === 'Enter') {
        e.preventDefault();
        if (activeSuggestIndex >= 0 && items && items[activeSuggestIndex]) {
            const ticker = items[activeSuggestIndex].getAttribute('data-ticker');
            headerSearchInput.value = ticker;
            searchSuggestDropdown.classList.add('hidden');
            activeSuggestIndex = -1;
            executeStockAnalysis(ticker);
        } else {
            const val = headerSearchInput.value.trim().toUpperCase();
            if (searchSuggestDropdown) searchSuggestDropdown.classList.add('hidden');
            activeSuggestIndex = -1;
            if (val) executeStockAnalysis(val);
        }
    } else if (e.key === 'Escape') {
        if (searchSuggestDropdown) searchSuggestDropdown.classList.add('hidden');
        activeSuggestIndex = -1;
    }
});

// Close dropdown on click outside
document.addEventListener('click', (e) => {
    if (searchSuggestDropdown && !headerSearchInput.contains(e.target) && !searchSuggestDropdown.contains(e.target)) {
        searchSuggestDropdown.classList.add('hidden');
        activeSuggestIndex = -1;
    }
});

btnClearSearch.addEventListener('click', () => {
    headerSearchInput.value = '';
    if (searchSuggestDropdown) searchSuggestDropdown.classList.add('hidden');
    activeSuggestIndex = -1;
    headerSearchInput.focus();
});
