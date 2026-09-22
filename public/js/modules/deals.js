// ============================================================
//  MODULE: deals.js
//  M&A radar deals rendering, filtering, and card click bindings
// ============================================================

// ============================================================
//  2. RADAR SAHAM AKUISISI & M&A (32 DEALS)
// ============================================================
async function loadDeals() {
    try {
        const res = await fetch('/api/deals');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.deals && data.deals.length > 0) {
            allDeals = data.deals;
            if (badgeTotalDeals) badgeTotalDeals.textContent = `${allDeals.length} DEAL TERDETEKSI`;
            if (countFilterAll) countFilterAll.textContent = allDeals.length;
            if (data.lastUpdated && statLastUpdate) {
                statLastUpdate.textContent = data.lastUpdated;
            }
            renderDeals();
        }
    } catch (err) {
        console.error('Gagal memuat M&A Deals:', err);
    }
}

function renderDeals() {
    if (!dealsGrid) return;
    dealsGrid.innerHTML = '';

    let filtered = allDeals;
    if (activeDealFilter !== 'all') {
        filtered = allDeals.filter(d => d.type === activeDealFilter);
    }

    if (filtered.length === 0) {
        dealsEmpty?.classList.remove('hidden');
        return;
    }
    dealsEmpty?.classList.add('hidden');

    filtered.forEach(deal => {
        const card = document.createElement('div');
        card.className = 'card-radar rounded-xl p-3.5 sm:p-5 flex flex-col justify-between group overflow-hidden w-full';

        // Badge type color configuration
        let typeBadgeClass = 'bg-emerald-950/70 shadow-sm text-emerald-400';
        let typeIcon = '✓';
        if (deal.type === 'negosiasi') {
            typeBadgeClass = 'bg-blue-950/70 text-blue-400 shadow-sm';
            typeIcon = '🤝';
        } else if (deal.type === 'rumor') {
            typeBadgeClass = 'bg-purple-950/70 text-purple-400 shadow-sm';
            typeIcon = '🔮';
        } else if (deal.typeLabel === 'CONFIRMED') {
            typeBadgeClass = 'bg-amber-950/70 text-amber-400 shadow-sm';
            typeIcon = '✓';
        }

        // Emiten tags
        const tagsHtml = (deal.tickers || []).map(t => {
            return `<span class="ticker-pill bg-[#062430] hover:bg-cyan-500/20 shadow-sm text-cyan-300 text-xs font-mono font-bold px-2.5 py-0.5 rounded cursor-pointer transition" data-ticker="${t}">$${t}</span>`;
        }).join(' ');

        // Primary ticker to analyze on click
        const primaryTicker = (deal.tickers && deal.tickers[0]) || 'BBRI';
        // Direct news link (falls back to Google search if not available)
        const newsLink = deal.link || `https://news.google.com/search?q=${encodeURIComponent(deal.title)}&hl=id&gl=ID&ceid=ID:id`;

        card.innerHTML = `
            <div>
                <!-- Top Row: Badges -->
                <div class="flex items-center justify-between gap-2 mb-2.5">
                    <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-extrabold ${typeBadgeClass} uppercase tracking-wide truncate">
                        <span>${typeIcon}</span>
                        <span class="truncate">${deal.typeLabel}</span>
                    </span>
                    <span class="bg-amber-950/40 text-amber-400 text-[11px] font-bold px-2 py-0.5 rounded-md font-mono shadow-sm shrink-0">
                        ${deal.accuracy}% Akurasi
                    </span>
                </div>

                <!-- Second Row: Tickers & Source + Exact Realtime Time -->
                <div class="flex flex-wrap items-center justify-between gap-2 my-2">
                    <div class="flex flex-wrap items-center gap-1.5 min-w-0">
                        ${tagsHtml}
                    </div>
                    <div class="flex items-center gap-1.5 text-right shrink-0">
                        <span class="text-xs text-slate-400 font-medium truncate max-w-[100px]">${deal.source}</span>
                        <span class="text-slate-600 text-xs">•</span>
                        <span class="inline-flex items-center gap-1 text-[11px] text-emerald-400/90 font-mono font-bold bg-[#071d22] shadow-sm px-1.5 py-0.5 rounded" title="Waktu Tayang: ${deal.timeStr} (${deal.dateStr})">
                            <svg class="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke-width="2"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6l4 2"/></svg>
                            <span>${deal.timeAgo || 'Baru saja'}</span>
                            <span class="text-slate-400 font-normal hidden sm:inline">(${deal.timeStr})</span>
                        </span>
                    </div>
                </div>

                <!-- Headline -->
                <h3 class="text-sm font-bold text-white leading-snug my-2.5 group-hover:text-amber-300 transition-colors line-clamp-2 break-words">
                    ${deal.title}
                </h3>
            </div>

            <div>
                <!-- Deal Value Box -->
                <div class="bg-[#070b14] rounded-lg p-2.5 flex flex-col xs:flex-row xs:items-center justify-between gap-1 my-2.5 shadow-inner">
                    <span class="text-amber-400/90 text-xs font-semibold flex items-center gap-1 shrink-0">
                        <span class="text-amber-400 font-bold">$</span> Estimasi Nilai Deal:
                    </span>
                    <span class="text-amber-400 font-bold text-xs font-mono text-left xs:text-right break-words leading-tight">${deal.dealValue}</span>
                </div>

                <!-- Footer Row: Impact, Baca Berita & Lihat Analisis -->
                <div class="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <span class="text-[10px] sm:text-[11px] font-extrabold text-slate-300 tracking-wider uppercase truncate max-w-[130px] sm:max-w-none">
                        ${deal.impact}
                    </span>
                    <div class="flex items-center gap-2 shrink-0 ml-auto">
                        <!-- Direct news link button -->
                        <a href="${newsLink}" target="_blank" rel="noopener noreferrer"
                           class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-950/60 hover:bg-sky-900/80 shadow-sm text-sky-300 hover:text-sky-100 font-bold text-[11px] transition-all duration-200"
                           title="Buka artikel berita langsung di sumber aslinya">
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v12a2 2 0 01-2 2z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 2v4M8 2v4M3 10h18"/>
                            </svg>
                            <span>Baca Berita</span>
                        </a>
                        <!-- Analyze stock button -->
                        <button class="btn-inspect-deal text-amber-400 hover:text-amber-300 font-bold text-xs flex items-center gap-1 transition shrink-0" data-ticker="${primaryTicker}">
                            <span>Analisis</span>
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                        </button>
                    </div>
                </div>
            </div>
        `;

        dealsGrid.appendChild(card);
    });

    // Attach click listener on all inspect buttons and ticker pills
    attachDealCardListeners();
}

function attachDealCardListeners() {
    document.querySelectorAll('.btn-inspect-deal').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const ticker = btn.getAttribute('data-ticker');
            if (ticker) executeStockAnalysis(ticker);
        });
    });

    document.querySelectorAll('.ticker-pill').forEach(pill => {
        pill.addEventListener('click', (e) => {
            e.stopPropagation();
            const ticker = pill.getAttribute('data-ticker');
            if (ticker) executeStockAnalysis(ticker);
        });
    });
}

// Category filter buttons
filterBtns?.forEach(btn => {
    btn.addEventListener('click', () => {
        filterBtns.forEach(b => {
            b.classList.remove('active', 'bg-amber-500', 'text-black', 'shadow-md');
            b.classList.add('text-slate-300');
        });
        btn.classList.add('active', 'bg-amber-500', 'text-black', 'shadow-md');
        btn.classList.remove('text-slate-300');

        activeDealFilter = btn.getAttribute('data-filter') || 'all';
        renderDeals();
    });
});
