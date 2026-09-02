// ============================================================
//  IDX AI Financial Analyst — Frontend Engine
//  All data sourced from /api endpoints (zero dummy data)
// ============================================================

// --- UI Elements ---
const tabAnalyze = document.getElementById('tab-analyze');
const tabScreener = document.getElementById('tab-screener');
const secAnalyze = document.getElementById('section-analyze');
const secScreener = document.getElementById('section-screener');

// Analyze Elements
const btnAnalyze = document.getElementById('btn-analyze');
const tickerInput = document.getElementById('ticker-input');
const errorBanner = document.getElementById('error-banner');
const errorMessage = document.getElementById('error-message');
const dashContent = document.getElementById('dashboard-content');
const loadingIcon = document.getElementById('loading-icon');

// Market News Elements
const newsSkeleton = document.getElementById('news-skeleton');
const newsError = document.getElementById('news-error');
const newsGrid = document.getElementById('market-news-grid');
const newsFilter = document.getElementById('news-filter');
const btnRefreshNews = document.getElementById('btn-refresh-news');
const newsRefreshIcon = document.getElementById('news-refresh-icon');
const newsLastUpdated = document.getElementById('news-last-updated');
const newsTickerWrapper = document.getElementById('news-ticker-wrapper');
const newsTickerTrack = document.getElementById('news-ticker-track');
const newsToggleWrapper = document.getElementById('news-toggle-wrapper');
const btnShowMoreNews = document.getElementById('btn-show-more-news');
const newsToggleChevron = document.getElementById('news-toggle-chevron');
const btnRetryNews = document.getElementById('btn-retry-news');

// Formatters
const fmtRp = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
const fmtNum = new Intl.NumberFormat('id-ID');

// State
let allMarketNews = [];
let newsExpanded = false;
const NEWS_INITIAL_COUNT = 6;
const NEWS_AUTO_REFRESH_MS = 5 * 60 * 1000; // 5 minutes

// ============================================================
//  UTILITY: Relative Time Formatter
// ============================================================
function timeAgo(dateStr) {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffMin < 1) return 'Baru saja';
    if (diffMin < 60) return `${diffMin} menit lalu`;
    if (diffHour < 24) return `${diffHour} jam lalu`;
    if (diffDay === 1) return 'Kemarin';
    if (diffDay < 7) return `${diffDay} hari lalu`;
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getCategoryBadgeClass(category) {
    const map = {
        'IHSG': 'badge-ihsg',
        'Dividen': 'badge-dividen',
        'IPO': 'badge-ipo',
        'Aksi Korporasi': 'badge-aksi',
        'Obligasi': 'badge-obligasi',
        'Valas': 'badge-valas',
        'Makro': 'badge-makro',
        'Market': 'badge-market'
    };
    return map[category] || 'badge-market';
}

// ============================================================
//  MARKET NEWS: Fetch, Render, Filter, Ticker
// ============================================================
async function loadMarketNews() {
    // Show skeleton, hide others
    newsSkeleton.classList.remove('hidden');
    newsGrid.classList.add('hidden');
    newsError.classList.add('hidden');
    newsToggleWrapper.classList.add('hidden');

    // Spin refresh icon
    newsRefreshIcon.classList.add('animate-spin');

    try {
        const response = await fetch('/api/market-news');
        const data = await response.json();

        if (!response.ok || !data.news || data.news.length === 0) {
            throw new Error(data.error || 'Berita kosong');
        }

        allMarketNews = data.news;

        // Update last-updated label
        if (data.lastUpdated) {
            newsLastUpdated.textContent = `Diperbarui: ${data.lastUpdated}`;
        }

        // Render the news grid
        renderNewsGrid();

        // Render the ticker banner
        renderNewsTicker(data.news);

        // Hide skeleton, show grid
        newsSkeleton.classList.add('hidden');
        newsGrid.classList.remove('hidden');

    } catch (err) {
        console.error('News load error:', err);
        newsSkeleton.classList.add('hidden');
        newsError.classList.remove('hidden');
    } finally {
        newsRefreshIcon.classList.remove('animate-spin');
    }
}

function renderNewsGrid() {
    const filter = newsFilter.value;
    let filtered = allMarketNews;
    if (filter !== 'all') {
        filtered = allMarketNews.filter(n => n.category === filter);
    }

    const limit = newsExpanded ? filtered.length : Math.min(NEWS_INITIAL_COUNT, filtered.length);
    const visible = filtered.slice(0, limit);

    newsGrid.innerHTML = '';

    if (visible.length === 0) {
        newsGrid.innerHTML = `
            <div class="col-span-full text-center py-10">
                <svg class="w-12 h-12 text-gray-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"></path></svg>
                <p class="text-gray-500 font-medium">Tidak ada berita untuk kategori "${filter}".</p>
            </div>`;
        newsToggleWrapper.classList.add('hidden');
        return;
    }

    visible.forEach((news, idx) => {
        const card = document.createElement('a');
        card.href = news.link;
        card.target = '_blank';
        card.rel = 'noopener noreferrer';
        card.className = 'news-card news-card-anim bg-gray-800/60 rounded-xl p-5 block cursor-pointer group';
        card.style.animationDelay = `${idx * 0.07}s`;

        card.innerHTML = `
            <div class="flex items-center justify-between mb-3">
                <span class="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${getCategoryBadgeClass(news.category)}">${news.category}</span>
                <span class="text-[11px] text-gray-500">${timeAgo(news.pubDate)}</span>
            </div>
            <h3 class="text-sm font-semibold text-gray-200 leading-snug mb-3 group-hover:text-brandBlue transition-colors line-clamp-3">${news.title}</h3>
            <div class="flex items-center justify-between">
                <span class="text-[11px] text-gray-500 flex items-center gap-1">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"></path></svg>
                    ${news.source}
                </span>
                <span class="text-brandBlue text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                    Baca
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                </span>
            </div>
        `;

        newsGrid.appendChild(card);
    });

    // Show/hide toggle button
    if (filtered.length > NEWS_INITIAL_COUNT) {
        newsToggleWrapper.classList.remove('hidden');
        const toggleLabel = btnShowMoreNews.querySelector('span');
        if (newsExpanded) {
            toggleLabel.textContent = 'Tampilkan Lebih Sedikit';
            newsToggleChevron.style.transform = 'rotate(180deg)';
        } else {
            toggleLabel.textContent = `Tampilkan Lebih Banyak (${filtered.length - NEWS_INITIAL_COUNT} lainnya)`;
            newsToggleChevron.style.transform = 'rotate(0deg)';
        }
    } else {
        newsToggleWrapper.classList.add('hidden');
    }
}

function renderNewsTicker(news) {
    newsTickerTrack.innerHTML = '';

    // Duplicate items for seamless infinite scroll
    const items = [...news, ...news];
    items.forEach(n => {
        const span = document.createElement('span');
        span.className = 'inline-flex items-center gap-2 mr-8 text-xs text-gray-400';
        span.innerHTML = `
            <span class="w-1.5 h-1.5 rounded-full ${getCategoryDotColor(n.category)}"></span>
            <span class="text-gray-300 font-medium">${n.title.substring(0, 80)}${n.title.length > 80 ? '…' : ''}</span>
            <span class="text-gray-600">|</span>
            <span class="text-gray-500">${n.source}</span>
            <span class="text-gray-600 mr-4">•</span>
        `;
        newsTickerTrack.appendChild(span);
    });

    // Animate ticker wrapper in
    newsTickerWrapper.style.height = '40px';
    newsTickerWrapper.classList.remove('opacity-0');
    newsTickerWrapper.classList.add('opacity-100');
}

function getCategoryDotColor(category) {
    const map = {
        'IHSG': 'bg-blue-400',
        'Dividen': 'bg-emerald-400',
        'IPO': 'bg-purple-400',
        'Aksi Korporasi': 'bg-yellow-400',
        'Obligasi': 'bg-sky-400',
        'Valas': 'bg-pink-400',
        'Makro': 'bg-orange-400',
        'Market': 'bg-gray-400'
    };
    return map[category] || 'bg-gray-400';
}

// --- News Event Listeners ---
newsFilter.addEventListener('change', () => {
    newsExpanded = false;
    renderNewsGrid();
});

btnRefreshNews.addEventListener('click', () => {
    loadMarketNews();
});

btnRetryNews.addEventListener('click', () => {
    loadMarketNews();
});

btnShowMoreNews.addEventListener('click', () => {
    newsExpanded = !newsExpanded;
    renderNewsGrid();
});

// --- Auto-refresh news every 5 minutes ---
setInterval(() => {
    loadMarketNews();
}, NEWS_AUTO_REFRESH_MS);

// --- Load news on page load ---
document.addEventListener('DOMContentLoaded', () => {
    loadMarketNews();
});

// ============================================================
//  TAB SWITCHING
// ============================================================
tabAnalyze.addEventListener('click', () => {
    tabAnalyze.classList.add('text-brandBlue', 'border-brandBlue');
    tabAnalyze.classList.remove('text-gray-400', 'border-transparent');
    tabScreener.classList.remove('text-brandBlue', 'border-brandBlue');
    tabScreener.classList.add('text-gray-400', 'border-transparent');
    secAnalyze.classList.remove('hidden');
    secScreener.classList.add('hidden');
});

tabScreener.addEventListener('click', () => {
    tabScreener.classList.add('text-brandBlue', 'border-brandBlue');
    tabScreener.classList.remove('text-gray-400', 'border-transparent');
    tabAnalyze.classList.remove('text-brandBlue', 'border-brandBlue');
    tabAnalyze.classList.add('text-gray-400', 'border-transparent');
    secScreener.classList.remove('hidden');
    secAnalyze.classList.add('hidden');
});

// ============================================================
//  ANALYZE LOGIC
// ============================================================
btnAnalyze.addEventListener('click', async () => {
    const ticker = tickerInput.value.trim().toUpperCase();
    if (ticker.length !== 4) {
        showError("Kode saham harus 4 huruf.");
        return;
    }

    // Reset UI
    errorBanner.classList.add('hidden');
    dashContent.classList.add('hidden');
    loadingIcon.classList.remove('hidden');
    btnAnalyze.disabled = true;

    try {
        const response = await fetch(`/api/analyze/${ticker}`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || `Data realtime untuk ${ticker} tidak ditemukan atau gagal dimuat dari penyedia data.`);
        }

        renderDashboard(data);
    } catch (err) {
        showError(err.message);
    } finally {
        loadingIcon.classList.add('hidden');
        btnAnalyze.disabled = false;
    }
});

// Allow Enter key to trigger analysis
tickerInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') btnAnalyze.click();
});

function showError(msg) {
    errorMessage.textContent = msg;
    errorBanner.classList.remove('hidden');
    dashContent.classList.add('hidden');
}

function renderDashboard(data) {
    dashContent.classList.remove('hidden');
    dashContent.classList.add('flex');

    // Trigger re-animation
    dashContent.classList.remove('animate__fadeInUp');
    void dashContent.offsetWidth; // force reflow
    dashContent.classList.add('animate__fadeInUp');

    // Header
    document.getElementById('stock-ticker').textContent = data.ticker;
    document.getElementById('stock-timestamp').textContent = `Data diakses pada: ${data.realtime.timestamp}`;
    
    const mktStat = document.getElementById('market-status');
    mktStat.textContent = data.realtime.marketStatus;
    mktStat.className = `px-3 py-1 rounded-full text-xs font-bold border ${data.realtime.marketStatus === 'OPEN' ? 'bg-upGreen/20 text-upGreen border-upGreen' : 'bg-gray-700 text-gray-300 border-gray-500'}`;

    // Realtime
    document.getElementById('rt-price').textContent = fmtRp.format(data.realtime.lastPrice);
    
    const chgEl = document.getElementById('rt-change');
    chgEl.textContent = `${data.realtime.changePct > 0 ? '+' : ''}${data.realtime.changePct.toFixed(2)}%`;
    chgEl.className = `text-2xl font-bold mt-1 ${data.realtime.changePct > 0 ? 'text-upGreen' : (data.realtime.changePct < 0 ? 'text-downRed' : 'text-gray-300')}`;

    document.getElementById('rt-high').textContent = fmtRp.format(data.realtime.high);
    document.getElementById('rt-low').textContent = fmtRp.format(data.realtime.low);
    document.getElementById('rt-vol').textContent = fmtNum.format(data.realtime.volume);
    document.getElementById('rt-val').textContent = fmtRp.format(data.realtime.value);

    // Valuation
    const val = data.valuation;
    const vStat = document.getElementById('val-status');
    vStat.textContent = val.status;
    if (val.status === 'UNDERVALUED') vStat.className = 'px-3 py-1 rounded font-bold text-sm bg-upGreen/20 text-upGreen border border-upGreen';
    else if (val.status === 'OVERVALUED') vStat.className = 'px-3 py-1 rounded font-bold text-sm bg-downRed/20 text-downRed border border-downRed';
    else vStat.className = 'px-3 py-1 rounded font-bold text-sm bg-warnYellow/20 text-warnYellow border border-warnYellow';

    document.getElementById('val-fair').textContent = val.fairValue ? fmtRp.format(val.fairValue) : 'N/A';
    document.getElementById('val-per').textContent = val.per ? `${val.per}x` : 'N/A';
    document.getElementById('val-pbv').textContent = val.pbv ? `${val.pbv}x` : 'N/A';
    document.getElementById('val-eps').textContent = val.eps ? fmtRp.format(val.eps) : 'N/A';
    document.getElementById('val-bvps').textContent = val.bvps ? fmtRp.format(val.bvps) : 'N/A';

    // Trend
    const trend = data.trend;
    const tStat = document.getElementById('trend-status');
    tStat.textContent = trend.status;
    if (trend.status === 'UPTREND') tStat.className = 'px-3 py-1 rounded font-bold text-sm bg-upGreen/20 text-upGreen border border-upGreen';
    else if (trend.status === 'DOWNTREND') tStat.className = 'px-3 py-1 rounded font-bold text-sm bg-downRed/20 text-downRed border border-downRed';
    else tStat.className = 'px-3 py-1 rounded font-bold text-sm bg-warnYellow/20 text-warnYellow border border-warnYellow';

    document.getElementById('trend-ema20').textContent = trend.ema20 ? fmtRp.format(trend.ema20) : 'N/A';
    document.getElementById('trend-ema50').textContent = trend.ema50 ? fmtRp.format(trend.ema50) : 'N/A';
    document.getElementById('trend-ema200').textContent = trend.ema200 ? fmtRp.format(trend.ema200) : 'N/A';
    document.getElementById('trend-rsi').textContent = trend.rsi14 ? trend.rsi14.toFixed(2) : 'N/A';
    
    // MACD formatting
    let macdStr = 'N/A';
    if (trend.macd_line && trend.macd_signal) {
        macdStr = `${trend.macd_line.toFixed(2)} | Sig: ${trend.macd_signal.toFixed(2)}`;
    }
    document.getElementById('trend-macd').textContent = macdStr;
    
    document.getElementById('trend-adx').textContent = trend.adx14 ? trend.adx14.toFixed(2) : 'N/A';

    // Financials
    const fin = data.financials;
    document.getElementById('fin-rev').textContent = fin.revenueGrowth ? `${(fin.revenueGrowth * 100).toFixed(2)}%` : 'N/A';
    document.getElementById('fin-gm').textContent = fin.grossMargin ? `${(fin.grossMargin * 100).toFixed(2)}%` : 'N/A';
    document.getElementById('fin-npm').textContent = fin.netProfitMargin ? `${(fin.netProfitMargin * 100).toFixed(2)}%` : 'N/A';
    document.getElementById('fin-om').textContent = fin.operatingMargin ? `${(fin.operatingMargin * 100).toFixed(2)}%` : 'N/A';
    document.getElementById('fin-roe').textContent = fin.roe ? `${(fin.roe * 100).toFixed(2)}%` : 'N/A';
    document.getElementById('fin-roa').textContent = fin.roa ? `${(fin.roa * 100).toFixed(2)}%` : 'N/A';
    
    document.getElementById('fin-cr').textContent = fin.currentRatio ? `${fin.currentRatio.toFixed(2)}x` : 'N/A';
    document.getElementById('fin-qr').textContent = fin.quickRatio ? `${fin.quickRatio.toFixed(2)}x` : 'N/A';
    document.getElementById('fin-der').textContent = fin.debtToEquity ? `${(fin.debtToEquity / 100).toFixed(2)}x` : 'N/A';
    document.getElementById('fin-fcf').textContent = fin.freeCashflow ? fmtRp.format(fin.freeCashflow) : 'N/A';

    // Analyst Consensus
    const analystBox = document.getElementById('fin-analyst-box');
    if (fin.analystRecommendation && fin.targetPrice) {
        analystBox.classList.remove('hidden');
        
        const recEl = document.getElementById('fin-recommendation');
        recEl.textContent = fin.analystRecommendation.toUpperCase();
        
        // Color coding for recommendation
        if (fin.analystRecommendation.toLowerCase().includes('buy')) {
            recEl.className = 'text-sm font-bold px-3 py-1 rounded-full bg-upGreen/20 text-upGreen';
        } else if (fin.analystRecommendation.toLowerCase().includes('sell')) {
            recEl.className = 'text-sm font-bold px-3 py-1 rounded-full bg-downRed/20 text-downRed';
        } else {
            recEl.className = 'text-sm font-bold px-3 py-1 rounded-full bg-gray-600/50 text-gray-300';
        }

        document.getElementById('fin-target').textContent = fmtRp.format(fin.targetPrice);
        
        const upsideEl = document.getElementById('fin-upside');
        if (fin.upsidePct) {
            const isUpside = fin.upsidePct > 0;
            upsideEl.textContent = `${isUpside ? '+' : ''}${(fin.upsidePct * 100).toFixed(2)}%`;
            upsideEl.className = `text-xs font-semibold ${isUpside ? 'text-upGreen' : 'text-downRed'}`;
        } else {
            upsideEl.textContent = '';
        }
    } else {
        analystBox.classList.add('hidden');
    }

    document.getElementById('fin-summary').textContent = fin.summary;

    // Corporate Action News (per-stock)
    const newsSec = document.getElementById('section-news');
    const newsCont = document.getElementById('news-container');
    newsCont.innerHTML = '';

    if (data.news && data.news.length > 0) {
        newsSec.classList.remove('hidden');
        data.news.forEach(n => {
            const el = document.createElement('div');
            el.className = 'bg-gray-800/80 p-4 rounded-lg border border-gray-700 hover:border-gray-500 transition cursor-pointer';
            el.innerHTML = `
                <div class="flex justify-between items-start mb-2">
                    <span class="text-xs text-brandBlue font-bold bg-brandBlue/10 px-2 py-1 rounded">${n.source}</span>
                    <span class="text-xs text-gray-500">${n.date}</span>
                </div>
                <a href="${n.link}" target="_blank" class="font-bold text-gray-200 hover:text-brandBlue">${n.title}</a>
                <p class="text-sm text-gray-400 mt-2 italic">Dampak: ${n.impact}</p>
            `;
            newsCont.appendChild(el);
        });
    } else {
        newsSec.classList.add('hidden');
    }
}

// ============================================================
//  SCREENER LOGIC
// ============================================================
const btnRunScreener = document.getElementById('btn-run-screener');
const scrLoading = document.getElementById('screener-loading');
const scrResults = document.getElementById('screener-results');

btnRunScreener.addEventListener('click', async () => {
    btnRunScreener.disabled = true;
    scrResults.classList.add('hidden');
    scrLoading.classList.remove('hidden');

    try {
        const response = await fetch(`/api/screener`);
        const data = await response.json();

        if (!response.ok) throw new Error(data.error);

        renderScreener(data);
    } catch (err) {
        alert("Gagal memuat screener: " + err.message);
    } finally {
        scrLoading.classList.add('hidden');
        btnRunScreener.disabled = false;
    }
});

function renderScreener(data) {
    scrResults.classList.remove('hidden');

    const fmtP = v => v ? fmtRp.format(v) : '-';

    // Helper: render confidence badge
    function confBadge(confidence, label) {
        const color = confidence >= 75 ? 'text-emerald-400' : confidence >= 55 ? 'text-yellow-400' : 'text-orange-400';
        const bgColor = confidence >= 75 ? 'bg-emerald-500/20' : confidence >= 55 ? 'bg-yellow-500/20' : 'bg-orange-500/20';
        const barColor = confidence >= 75 ? 'bg-emerald-500' : confidence >= 55 ? 'bg-yellow-500' : 'bg-orange-500';
        return {
            confCell: `<td class="p-3"><div class="flex items-center gap-2"><span class="${color} font-bold text-xs">${confidence}%</span><div class="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden"><div class="${barColor} h-full rounded-full" style="width:${confidence}%"></div></div></div></td>`,
            labelCell: `<td class="p-3"><span class="text-[10px] px-2 py-0.5 rounded font-semibold ${bgColor} ${color}">${label}</span></td>`
        };
    }

    // ── Scalping ──────────────────────────────────────
    const tblScalp = document.getElementById('tbl-scalping');
    tblScalp.innerHTML = '';
    (data.scalping || []).forEach(row => {
        const { confCell, labelCell } = confBadge(row.confidence, row.label);
        tblScalp.innerHTML += `
            <tr class="border-b border-gray-700/50 hover:bg-gray-800/40 transition">
                <td class="p-3 font-bold text-white">${row.ticker}</td>
                <td class="p-3 text-gray-200">${fmtRp.format(row.price)}</td>
                <td class="p-3 ${row.changePct >= 0 ? 'text-upGreen' : 'text-downRed'} font-semibold">${row.changePct >= 0 ? '+' : ''}${row.changePct}%</td>
                <td class="p-3 text-gray-300">${row.range}%</td>
                <td class="p-3 text-upGreen font-semibold">${fmtRp.format(row.targetProfit)}</td>
                <td class="p-3 text-downRed">${fmtRp.format(row.stopLoss)}</td>
                ${confCell}${labelCell}
            </tr>`;
    });
    if (!data.scalping?.length) tblScalp.innerHTML = `<tr><td colspan="8" class="p-4 text-center text-gray-500 italic text-sm">Tidak ada saham memenuhi kriteria scalping saat ini.</td></tr>`;

    // ── Daytrade ─────────────────────────────────────
    const tblDay = document.getElementById('tbl-daytrade');
    tblDay.innerHTML = '';
    (data.daytrade || []).forEach(row => {
        const { confCell, labelCell } = confBadge(row.confidence, row.label);
        tblDay.innerHTML += `
            <tr class="border-b border-gray-700/50 hover:bg-gray-800/40 transition">
                <td class="p-3 font-bold text-white">${row.ticker}</td>
                <td class="p-3 text-gray-200">${fmtRp.format(row.price)}</td>
                <td class="p-3 ${row.changePct >= 0 ? 'text-upGreen' : 'text-downRed'} font-semibold">${row.changePct >= 0 ? '+' : ''}${row.changePct}%</td>
                <td class="p-3 text-gray-300">${row.entryZone}</td>
                <td class="p-3 text-upGreen font-semibold">${fmtRp.format(row.targetProfit)}</td>
                <td class="p-3 text-downRed">${fmtRp.format(row.stopLoss)}</td>
                ${confCell}${labelCell}
            </tr>`;
    });
    if (!data.daytrade?.length) tblDay.innerHTML = `<tr><td colspan="8" class="p-4 text-center text-gray-500 italic text-sm">Tidak ada saham memenuhi kriteria daytrade saat ini.</td></tr>`;

    // ── Swing ─────────────────────────────────────────
    const tblSwing = document.getElementById('tbl-swing');
    tblSwing.innerHTML = '';
    (data.swing || []).forEach(row => {
        const { confCell, labelCell } = confBadge(row.confidence, row.label);
        tblSwing.innerHTML += `
            <tr class="border-b border-gray-700/50 hover:bg-gray-800/40 transition">
                <td class="p-3 font-bold text-white">${row.ticker}</td>
                <td class="p-3 text-gray-200">${fmtRp.format(row.price)}</td>
                <td class="p-3 text-gray-300">${row.areaBuy}</td>
                <td class="p-3 text-upGreen font-semibold">${fmtRp.format(row.targetPrice1)}</td>
                <td class="p-3 text-upGreen font-semibold">${fmtRp.format(row.targetPrice2)}</td>
                <td class="p-3 text-downRed">${fmtRp.format(row.cutLoss)}</td>
                <td class="p-3 text-brandBlue font-bold">${row.riskReward}</td>
                ${confCell}${labelCell}
            </tr>`;
    });
    if (!data.swing?.length) tblSwing.innerHTML = `<tr><td colspan="9" class="p-4 text-center text-gray-500 italic text-sm">Tidak ada saham memenuhi kriteria swing saat ini.</td></tr>`;

    // ── BSJP ─────────────────────────────────────────
    const tblBsjp = document.getElementById('tbl-bsjp');
    tblBsjp.innerHTML = '';
    (data.bsjp || []).forEach(row => {
        const { confCell, labelCell } = confBadge(row.confidence, row.label);
        tblBsjp.innerHTML += `
            <tr class="border-b border-gray-700/50 hover:bg-gray-800/40 transition">
                <td class="p-3 font-bold text-white">${row.ticker}</td>
                <td class="p-3 text-gray-200">${fmtRp.format(row.price)}</td>
                <td class="p-3 ${parseFloat(row.rsi) > 60 ? 'text-warnYellow' : 'text-upGreen'} font-semibold">${row.rsi}</td>
                <td class="p-3 text-gray-300">${row.pullbackFromHigh}%</td>
                <td class="p-3 text-orange-400 text-xs">${row.beliSore}</td>
                <td class="p-3 text-upGreen font-semibold">${fmtRp.format(row.targetPagi)}</td>
                <td class="p-3 text-downRed">${fmtRp.format(row.stopLoss)}</td>
                ${confCell}${labelCell}
            </tr>`;
    });
    if (!data.bsjp?.length) tblBsjp.innerHTML = `<tr><td colspan="9" class="p-4 text-center text-gray-500 italic text-sm">Tidak ada saham memenuhi kriteria BSJP saat ini.</td></tr>`;

    // ── BPJP ─────────────────────────────────────────
    const tblBpjp = document.getElementById('tbl-bpjp');
    tblBpjp.innerHTML = '';
    (data.bpjp || []).forEach(row => {
        const { confCell, labelCell } = confBadge(row.confidence, row.label);
        tblBpjp.innerHTML += `
            <tr class="border-b border-gray-700/50 hover:bg-gray-800/40 transition">
                <td class="p-3 font-bold text-white">${row.ticker}</td>
                <td class="p-3 text-gray-200">${fmtRp.format(row.price)}</td>
                <td class="p-3 text-upGreen font-semibold">${row.rsi} <span class="text-[10px] text-gray-500">(Oversold)</span></td>
                <td class="p-3 text-brandBlue font-semibold">${row.adx}</td>
                <td class="p-3 text-gray-300">${row.macd}</td>
                <td class="p-3 text-pink-400 text-xs">${row.entryPagi}</td>
                <td class="p-3 text-upGreen font-semibold">${fmtRp.format(row.target)}</td>
                <td class="p-3 text-downRed">${fmtRp.format(row.stopLoss)}</td>
                ${confCell}${labelCell}
            </tr>`;
    });
    if (!data.bpjp?.length) tblBpjp.innerHTML = `<tr><td colspan="10" class="p-4 text-center text-gray-500 italic text-sm">Tidak ada saham memenuhi kriteria BPJP saat ini.</td></tr>`;

    // ── Jangka Panjang ────────────────────────────────
    const tblLong = document.getElementById('tbl-longterm');
    tblLong.innerHTML = '';
    (data.longterm || []).forEach(row => {
        const { confCell, labelCell } = confBadge(row.confidence, row.label);
        tblLong.innerHTML += `
            <tr class="border-b border-gray-700/50 hover:bg-gray-800/40 transition">
                <td class="p-3 font-bold text-white">${row.ticker}</td>
                <td class="p-3 text-gray-200">${fmtRp.format(row.price)}</td>
                <td class="p-3 ${parseFloat(row.rsi) < 50 ? 'text-upGreen' : 'text-warnYellow'} font-semibold">${row.rsi}</td>
                <td class="p-3 text-gray-300">${fmtRp.format(row.ema200)}</td>
                <td class="p-3 text-gray-400">${fmtRp.format(row.support)}</td>
                <td class="p-3 text-upGreen font-semibold">${fmtRp.format(row.targetKonservatif)}</td>
                <td class="p-3 text-emerald-400 font-bold">${fmtRp.format(row.targetAgresif)}</td>
                <td class="p-3 text-downRed">${fmtRp.format(row.cutLoss)}</td>
                ${confCell}${labelCell}
            </tr>`;
    });
    if (!data.longterm?.length) tblLong.innerHTML = `<tr><td colspan="10" class="p-4 text-center text-gray-500 italic text-sm">Tidak ada saham memenuhi kriteria investasi jangka panjang saat ini.</td></tr>`;
}

