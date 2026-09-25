// ============================================================
//  MODULE: news.js
//  Market news feed, corporate ticker, and drawer expandable view
// ============================================================

// ============================================================
//  3. GENERAL MARKET NEWS & TICKER
// ============================================================
async function loadMarketNews() {
    try {
        const res = await fetch('/api/market-news');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (Array.isArray(data.news)) {
            allMarketNews = data.news;

            // Update stats
            if (statTotalNews) {
                const dealsLen = typeof allDeals !== 'undefined' && Array.isArray(allDeals) ? allDeals.length : 0;
                statTotalNews.textContent = `${allMarketNews.length + dealsLen} Total Berita Terkumpul`;
            }
            if (statLastUpdate) {
                statLastUpdate.textContent = data.lastUpdated || 'Belum diperbarui';
            }

            renderMarketNews();
            renderCorporateNewsTicker();
            if (allMarketNews.length && typeof playSoundChime === 'function') playSoundChime();
        }
    } catch (err) {
        console.error('Gagal memuat berita pasar:', err);
    }
}

function renderCorporateNewsTicker() {
    if (!corporateNewsTicker) return;
    corporateNewsTicker.innerHTML = '';
    if (!allMarketNews.length) return;

    // Render two identical groups so the CSS -50% loop is seamless.
    const sourceItems = allMarketNews.slice(0, 10);
    const items = [sourceItems, sourceItems];
    items.forEach(group => {
        const groupEl = document.createElement('div');
        groupEl.className = 'marquee-group flex items-center gap-6 shrink-0';
        group.forEach(news => {
        const item = document.createElement('div');
        item.className = 'inline-flex items-center gap-2 text-slate-300 whitespace-nowrap cursor-pointer hover:text-white transition';

        let tag = 'IDX';
        if (news.category) tag = String(news.category).toUpperCase().substring(0, 5);

        item.innerHTML = `
            <span class="bg-[#101929] text-cyan-400 text-[10px] font-bold px-1.5 py-0.5 rounded font-mono shadow-sm">[${escapeHtml(tag)}]</span>
            <span class="bg-emerald-950/70 text-emerald-400 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded shadow-sm">${escapeHtml(news.timeStr || news.timeAgo || '')}</span>
            <span class="font-medium text-xs">${escapeHtml(news.title)}</span>
            <span class="text-emerald-400 font-bold text-xs ml-1">↗</span>
            <span class="text-slate-700 ml-3">•</span>
        `;
        item.addEventListener('click', () => {
            const safeLink = safeExternalUrl(news.link);
            if (safeLink !== '#') window.open(safeLink, '_blank', 'noopener,noreferrer');
        });
        groupEl.appendChild(item);
        });
        corporateNewsTicker.appendChild(groupEl);
    });
}

function renderMarketNews() {
    if (!generalNewsGrid) return;
    const selectedCategory = newsCategorySelect?.value || 'all';
    let filtered = allMarketNews;
    if (selectedCategory !== 'all') {
        filtered = allMarketNews.filter(n => n.category === selectedCategory);
    }

    const limit = newsExpanded ? filtered.length : Math.min(6, filtered.length);
    const visible = filtered.slice(0, limit);

    generalNewsGrid.innerHTML = '';

    if (visible.length === 0) {
        generalNewsGrid.innerHTML = `
            <div class="col-span-full text-center py-10 text-slate-500 text-sm">
                Tidak ada berita untuk kategori "${selectedCategory}".
            </div>`;
        return;
    }

    visible.forEach(news => {
        const card = document.createElement('a');
        card.href = safeExternalUrl(news.link);
        card.target = '_blank';
        card.rel = 'noopener noreferrer';
        card.className = 'bg-[#0d1424] hover:bg-[#111a2e] rounded-xl p-3.5 sm:p-4 flex flex-col justify-between transition-all duration-200 group block shadow-md hover:shadow-xl overflow-hidden w-full';

        card.innerHTML = `
            <div>
                <div class="flex items-center justify-between gap-2 mb-2">
                    <span class="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-[#101a2c] text-cyan-400 shadow-sm shrink-0">
                        ${escapeHtml(news.category || 'Market')}
                    </span>
                    <span class="inline-flex items-center gap-1 text-[11px] text-emerald-400/90 font-mono font-semibold bg-[#071d22] shadow-sm px-2 py-0.5 rounded shrink-0">
                        <svg class="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke-width="2"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6l4 2"/></svg>
                        <span>${escapeHtml(news.timeAgo || timeAgo(news.pubDate))}</span>
                        <span class="text-slate-400 font-normal hidden sm:inline">(${escapeHtml(news.timeStr)})</span>
                    </span>
                </div>
                <h4 class="text-xs sm:text-sm font-semibold text-slate-200 group-hover:text-amber-300 leading-snug line-clamp-2 mb-3 break-words">
                    ${escapeHtml(news.title)}
                </h4>
            </div>
            <div class="flex items-center justify-between text-[11px] text-slate-400 pt-2 gap-2">
                <span class="truncate max-w-[120px] sm:max-w-[180px] font-medium">${escapeHtml(news.source)}</span>
                <span class="inline-flex items-center gap-1 text-[11px] font-bold text-sky-400 bg-sky-950/60 hover:bg-sky-900/80 shadow-sm px-2 py-0.5 rounded transition shrink-0">
                    <span>Baca Berita</span>
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                </span>
            </div>
        `;

        generalNewsGrid.appendChild(card);
    });

    // Update toggle button text
    if (btnToggleNewsMore && btnToggleNewsMore.parentElement) {
        if (filtered.length > 6) {
            btnToggleNewsMore.parentElement.classList.remove('hidden');
            const span = btnToggleNewsMore.querySelector('span');
            if (span) {
                span.textContent = newsExpanded
                    ? 'Tampilkan Lebih Sedikit'
                    : `Tampilkan Lebih Banyak (${filtered.length - 6} lainnya)`;
            }
        } else {
            btnToggleNewsMore.parentElement.classList.add('hidden');
        }
    }
}

newsCategorySelect?.addEventListener('change', () => {
    newsExpanded = false;
    renderMarketNews();
});

btnRefreshFeed?.addEventListener('click', () => {
    loadMarketNews();
});

btnToggleNewsMore?.addEventListener('click', () => {
    newsExpanded = !newsExpanded;
    renderMarketNews();
});
