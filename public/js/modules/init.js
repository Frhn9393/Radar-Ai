// ============================================================
//  MODULE: init.js
//  Application bootstrap and DOM ready initialization
// ============================================================

            const res = await fetch(`/api/search-suggest?q=${encodeURIComponent(q)}`);
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
