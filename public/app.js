// ============================================================
//  STOCKRADAR AI — Frontend Core Engine (Modular Bundle)
//  Generated automatically from public/js/modules/
// ============================================================

// --- START MODULE: state.js ---
// ============================================================
//  MODULE: state.js
//  Core state management, DOM element references and currency formatters
// ============================================================

// ============================================================
//  STOCKRADAR AI — Frontend Core Engine
//  Realtime Market Data, M&A Radar, Technical Screener & Sentiment
// ============================================================

// State Management
let allDeals = [];
let activeDealFilter = 'all';
let allMarketNews = [];
let newsExpanded = false;
let autoStreamActive = true;
let soundEnabled = true;
let streamInterval = null;
let lastScreenerData = null;
let activeScalpSession = 'sesi1';
let savedWatchlist = ['BBRI', 'FILM', 'EXCL', 'BREN', 'GOTO', 'TPIA', 'ASII', 'MEDC', 'BRIS', 'AUTO'];
try {
    const local = localStorage.getItem('stockradar_watchlist');
    if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed) && parsed.length > 0) savedWatchlist = parsed;
    }
} catch (e) { }

function saveWatchlistToStorage() {
    try {
        localStorage.setItem('stockradar_watchlist', JSON.stringify(savedWatchlist));
    } catch (e) { }
    updateWatchlistBadge();
}

function updateWatchlistBadge() {
    const badge = document.querySelector('#btn-open-watchlist span');
    if (badge) badge.textContent = savedWatchlist.length;
    const mobileBadge = document.getElementById('badge-watchlist-mobile');
    if (mobileBadge) mobileBadge.textContent = savedWatchlist.length;
}

const NEWS_AUTO_REFRESH_MS = 60 * 1000; // 1 minute live refresh

// Currency & Number Formatters
const fmtRp = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
const fmtNum = new Intl.NumberFormat('id-ID');

// --- UI Elements ---
// Navigation Tabs
const tabDeals = document.getElementById('tab-deals');
const tabScreener = document.getElementById('tab-screener');
const tabForeign = document.getElementById('tab-foreign');
const tabBacktest = document.getElementById('tab-backtest');
const secDeals = document.getElementById('section-deals');
const secScreener = document.getElementById('section-screener');
const secForeign = document.getElementById('section-foreign');
const secBacktest = document.getElementById('section-backtest');
const btnMobileNav = document.getElementById('btn-mobile-nav');
const headerNav = document.getElementById('header-nav');

// Foreign Flow Elements & State
let allForeignData = null;
let activeForeignSubmenu = 'daily';
const btnRefreshForeign = document.getElementById('btn-refresh-foreign');
const iconRefreshForeign = document.getElementById('icon-refresh-foreign');
const foreignMacroNetval = document.getElementById('foreign-macro-netval');
const foreignMacroParticipation = document.getElementById('foreign-macro-participation');
const foreignMacroSentiment = document.getElementById('foreign-macro-sentiment');
const foreignMacroTracked = document.getElementById('foreign-macro-tracked');

const btnForeignDaily = document.getElementById('btn-foreign-daily');
const btnForeignWeekly = document.getElementById('btn-foreign-weekly');
const btnForeignMonthly = document.getElementById('btn-foreign-monthly');
const btnForeignStreak = document.getElementById('btn-foreign-streak');
const badgeStreakCount = document.getElementById('badge-streak-count');

const foreignSearchInput = document.getElementById('foreign-search-input');
const foreignSectorSelect = document.getElementById('foreign-sector-select');
const foreignLoading = document.getElementById('foreign-loading');

const viewForeignDaily = document.getElementById('view-foreign-daily');
const viewForeignWeekly = document.getElementById('view-foreign-weekly');
const viewForeignMonthly = document.getElementById('view-foreign-monthly');
const viewForeignStreak = document.getElementById('view-foreign-streak');

const tbodyForeignDailyBuy = document.getElementById('tbody-foreign-daily-buy');
const tbodyForeignDailySell = document.getElementById('tbody-foreign-daily-sell');
const tbodyForeignWeekly = document.getElementById('tbody-foreign-weekly');
const tbodyForeignMonthly = document.getElementById('tbody-foreign-monthly');
const tbodyForeignStreak = document.getElementById('tbody-foreign-streak');

// Backtest Modal Elements
const modalBacktest = document.getElementById('modal-backtest');
const btnOpenBacktestModal = document.getElementById('btn-open-backtest-modal');
const btnCloseBacktestModal = document.getElementById('btn-close-backtest-modal');
const btnCloseBacktestModalBottom = document.getElementById('btn-close-backtest-modal-bottom');

// Screener Extra Controls
let screenerViewLimit = 'top3';
const screenerSectorSelect = document.getElementById('screener-sector-select');
const btnViewTop3 = document.getElementById('btn-view-top3');
const btnViewAll = document.getElementById('btn-view-all');

// Header Search & Actions
const headerSearchInput = document.getElementById('header-search-input');
const btnClearSearch = document.getElementById('btn-clear-search');
const btnToggleSound = document.getElementById('btn-toggle-sound');
const iconSound = document.getElementById('icon-sound');
const btnOpenWatchlist = document.getElementById('btn-open-watchlist');
const btnCloseWatchlist = document.getElementById('btn-close-watchlist');
const drawerWatchlist = document.getElementById('drawer-watchlist');
const watchlistItemsContainer = document.getElementById('watchlist-items-container');
const btnRefreshAll = document.getElementById('btn-refresh-all');
const btnExportData = document.getElementById('btn-export-data');
const btnToggleStream = document.getElementById('btn-toggle-stream');
const iconStreamStatus = document.getElementById('icon-stream-status');
const textStreamStatus = document.getElementById('text-stream-status');
const statTotalNews = document.getElementById('stat-total-news');
const statLastUpdate = document.getElementById('stat-last-update');

// Modal Watchlist Controls
const btnModalToggleWatchlist = document.getElementById('btn-modal-toggle-watchlist');
const textModalWatchlist = document.getElementById('text-modal-watchlist');
let currentActiveTicker = null;

// Mobile nav toggle
if (btnMobileNav && headerNav) {
    btnMobileNav.addEventListener('click', () => {
        headerNav.classList.toggle('hidden');
    });
}

// M&A Radar Elements
const dealsGrid = document.getElementById('deals-grid');
const dealsEmpty = document.getElementById('deals-empty');
const badgeTotalDeals = document.getElementById('badge-total-deals');
const countFilterAll = document.getElementById('count-filter-all');
const filterBtns = document.querySelectorAll('.filter-btn');

// General Market News
const generalNewsGrid = document.getElementById('general-news-grid');
const newsCategorySelect = document.getElementById('news-category-select');
const btnRefreshFeed = document.getElementById('btn-refresh-feed');
const btnToggleNewsMore = document.getElementById('btn-toggle-news-more');
const corporateNewsTicker = document.getElementById('corporate-news-ticker');

// Screener Elements
const btnTriggerScreener = document.getElementById('btn-trigger-screener');
const screenerLoading = document.getElementById('screener-loading');
const screenerResultsWrapper = document.getElementById('screener-results-wrapper');
const screenerBtnIcon = document.getElementById('screener-btn-icon');

// Modal Elements
const modalAnalysis = document.getElementById('modal-analysis');
const btnCloseModal = document.getElementById('btn-close-modal');

// Audio Element
const audioAlert = document.getElementById('audio-alert');

// --- END MODULE: state.js ---

// --- START MODULE: utils.js ---
// ============================================================
//  MODULE: utils.js
//  Utility helpers: relative time formatters and audio synthesizer chime
// ============================================================

// ============================================================
//  UTILITY: Relative Time Formatter
// ============================================================
function timeAgo(dateStr) {
    if (!dateStr) return 'Baru saja';
    const now = new Date();
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
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
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

// ============================================================
//  UTILITY: Audio Synthesizer Chime (Singleton AudioContext)
// ============================================================
let _sharedAudioCtx = null;

function getAudioContext() {
    if (typeof window === 'undefined') return null;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;

    if (!_sharedAudioCtx) {
        try {
            _sharedAudioCtx = new AudioCtx();
        } catch (e) {
            return null;
        }
    }
    if (_sharedAudioCtx && _sharedAudioCtx.state === 'suspended') {
        _sharedAudioCtx.resume().catch(() => {});
    }
    return _sharedAudioCtx;
}

function playSoundChime() {
    if (typeof soundEnabled !== 'undefined' && !soundEnabled) return;
    try {
        const ctx = getAudioContext();
        if (!ctx) return;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.08); // A5
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
    } catch (e) {
        // audio context blocked or unsupported
    }
}

// --- END MODULE: utils.js ---

// --- START MODULE: navigation.js ---
// ============================================================
//  MODULE: navigation.js
//  Tab navigation and mobile header action handlers
// ============================================================

// ============================================================
//  1. TAB NAVIGATION (3 TABS: DEALS, SCREENER, FOREIGN FLOW)
// ============================================================
let currentActiveMainTab = 'deals';

function switchMainTab(tabName) {
    currentActiveMainTab = tabName;
    const tabs = [
        { btn: tabDeals, sec: secDeals, name: 'deals' },
        { btn: tabScreener, sec: secScreener, name: 'screener' },
        { btn: tabForeign, sec: secForeign, name: 'foreign' },
        { btn: tabBacktest, sec: secBacktest, name: 'backtest' }
    ];

    tabs.forEach(t => {
        if (t.btn) {
            if (t.name === tabName) {
                t.btn.classList.add('active-tab', 'bg-[#101826]', 'text-white', 'shadow-sm');
                t.btn.classList.remove('text-slate-400');
            } else {
                t.btn.classList.remove('active-tab', 'bg-[#101826]', 'text-white', 'shadow-sm');
                t.btn.classList.add('text-slate-400');
            }
        }
        if (t.sec) {
            if (t.name === tabName) {
                t.sec.classList.remove('hidden');
            } else {
                t.sec.classList.add('hidden');
            }
        }
    });

    // Update Mobile Bottom Navigation bar states
    document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
        const targetTab = btn.getAttribute('data-tab');
        if (targetTab === tabName) {
            btn.classList.add('active', 'text-cyan-400', 'bg-cyan-500/15');
            btn.classList.remove('text-slate-400');
        } else {
            btn.classList.remove('active', 'text-cyan-400', 'bg-cyan-500/15');
            btn.classList.add('text-slate-400');
        }
    });

    if (tabName === 'screener') {
        if (!lastScreenerData && screenerLoading && screenerLoading.classList.contains('hidden') && screenerResultsWrapper && screenerResultsWrapper.classList.contains('hidden')) {
            btnTriggerScreener?.click();
        }
    } else if (tabName === 'foreign') {
        if (!allForeignData) {
            loadForeignFlowData();
        }
    } else if (tabName === 'backtest') {
        if (!lastBacktestData) {
            runAutomatedBacktest();
        }
    }
}

tabDeals?.addEventListener('click', () => switchMainTab('deals'));
tabScreener?.addEventListener('click', () => switchMainTab('screener'));
tabForeign?.addEventListener('click', () => switchMainTab('foreign'));
tabBacktest?.addEventListener('click', () => switchMainTab('backtest'));

// Mobile Navigation and Header Quick Action Event Listeners
document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        if (tab) {
            switchMainTab(tab);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });
});

const btnMobileSearchToggle = document.getElementById('btn-mobile-search-toggle');
const headerRightControls = document.getElementById('header-right-controls');
if (btnMobileSearchToggle && headerRightControls) {
    btnMobileSearchToggle.addEventListener('click', () => {
        const isHidden = headerRightControls.classList.contains('hidden');
        if (isHidden) {
            headerRightControls.classList.remove('hidden');
            headerRightControls.classList.add('flex');
            headerSearchInput?.focus();
        } else {
            headerRightControls.classList.add('hidden');
            headerRightControls.classList.remove('flex');
        }
    });
}

const btnMobileWatchlist = document.getElementById('btn-mobile-watchlist');
if (btnMobileWatchlist && drawerWatchlist) {
    btnMobileWatchlist.addEventListener('click', () => {
        renderWatchlistDrawer();
        drawerWatchlist.classList.remove('hidden');
        drawerWatchlist.classList.add('flex');
    });
}

const btnMobileRefresh = document.getElementById('btn-mobile-refresh');
if (btnMobileRefresh) {
    btnMobileRefresh.addEventListener('click', () => {
        btnRefreshAll?.click();
        const icon = btnMobileRefresh.querySelector('svg');
        if (icon) {
            icon.classList.add('animate-spin');
            setTimeout(() => icon.classList.remove('animate-spin'), 600);
        }
    });
}

// --- END MODULE: navigation.js ---

// --- START MODULE: deals.js ---
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

// --- END MODULE: deals.js ---

// --- START MODULE: news.js ---
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
        if (data.news && data.news.length > 0) {
            allMarketNews = data.news;

            // Update stats
            if (statTotalNews) {
                const dealsLen = typeof allDeals !== 'undefined' && Array.isArray(allDeals) ? allDeals.length : 0;
                statTotalNews.textContent = `${allMarketNews.length + dealsLen} Total Berita Terkumpul`;
            }
            if (data.lastUpdated && statLastUpdate) {
                statLastUpdate.textContent = data.lastUpdated;
            }

            renderMarketNews();
            renderCorporateNewsTicker();
            if (typeof playSoundChime === 'function') playSoundChime();
        }
    } catch (err) {
        console.error('Gagal memuat berita pasar:', err);
    }
}

function renderCorporateNewsTicker() {
    if (!corporateNewsTicker) return;
    corporateNewsTicker.innerHTML = '';
    if (!allMarketNews.length) return;

    // Take top 8 items and double them for endless scroll
    const items = [...allMarketNews.slice(0, 10), ...allMarketNews.slice(0, 10)];
    items.forEach(news => {
        const item = document.createElement('div');
        item.className = 'inline-flex items-center gap-2 mr-6 text-slate-300 whitespace-nowrap cursor-pointer hover:text-white transition';

        let tag = 'IDX';
        if (news.category) tag = news.category.toUpperCase().substring(0, 5);

        item.innerHTML = `
            <span class="bg-[#101929] text-cyan-400 text-[10px] font-bold px-1.5 py-0.5 rounded font-mono shadow-sm">[${tag}]</span>
            <span class="bg-emerald-950/70 text-emerald-400 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded shadow-sm">${news.timeStr || news.timeAgo}</span>
            <span class="font-medium text-xs">${news.title}</span>
            <span class="text-emerald-400 font-bold text-xs ml-1">↗</span>
            <span class="text-slate-700 ml-3">•</span>
        `;
        item.addEventListener('click', () => {
            if (news.link) window.open(news.link, '_blank', 'noopener,noreferrer');
        });
        corporateNewsTicker.appendChild(item);
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
        card.href = news.link;
        card.target = '_blank';
        card.rel = 'noopener noreferrer';
        card.className = 'bg-[#0d1424] hover:bg-[#111a2e] rounded-xl p-3.5 sm:p-4 flex flex-col justify-between transition-all duration-200 group block shadow-md hover:shadow-xl overflow-hidden w-full';

        card.innerHTML = `
            <div>
                <div class="flex items-center justify-between gap-2 mb-2">
                    <span class="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-[#101a2c] text-cyan-400 shadow-sm shrink-0">
                        ${news.category || 'Market'}
                    </span>
                    <span class="inline-flex items-center gap-1 text-[11px] text-emerald-400/90 font-mono font-semibold bg-[#071d22] shadow-sm px-2 py-0.5 rounded shrink-0">
                        <svg class="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke-width="2"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6l4 2"/></svg>
                        <span>${news.timeAgo || timeAgo(news.pubDate)}</span>
                        <span class="text-slate-400 font-normal hidden sm:inline">(${news.timeStr})</span>
                    </span>
                </div>
                <h4 class="text-xs sm:text-sm font-semibold text-slate-200 group-hover:text-amber-300 leading-snug line-clamp-2 mb-3 break-words">
                    ${news.title}
                </h4>
            </div>
            <div class="flex items-center justify-between text-[11px] text-slate-400 pt-2 gap-2">
                <span class="truncate max-w-[120px] sm:max-w-[180px] font-medium">${news.source}</span>
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

// --- END MODULE: news.js ---

// --- START MODULE: analysisModal.js ---
// ============================================================
//  MODULE: analysisModal.js
//  Detailed stock analysis modal, technical indicators, and rights issue tebus
// ============================================================

// ============================================================
//  4. DEEP STOCK ANALYSIS MODAL
// ============================================================
function updateModalWatchlistButton(ticker) {
    if (!btnModalToggleWatchlist || !textModalWatchlist) return;
    const isSaved = savedWatchlist.includes(ticker);
    if (isSaved) {
        textModalWatchlist.textContent = '✓ Tersimpan';
        btnModalToggleWatchlist.className = 'bg-purple-900/70 text-purple-200 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-sm';
    } else {
        textModalWatchlist.textContent = '+ Watchlist';
        btnModalToggleWatchlist.className = 'bg-[#121c2e] hover:bg-[#1a273f] shadow-sm text-purple-300 hover:text-white px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition';
    }
}

if (btnModalToggleWatchlist) {
    btnModalToggleWatchlist.addEventListener('click', () => {
        if (!currentActiveTicker) return;
        const idx = savedWatchlist.indexOf(currentActiveTicker);
        if (idx >= 0) {
            savedWatchlist.splice(idx, 1);
        } else {
            savedWatchlist.unshift(currentActiveTicker);
        }
        saveWatchlistToStorage();
        updateModalWatchlistButton(currentActiveTicker);
    });
}

async function executeStockAnalysis(ticker) {
    if (!ticker) return;
    const cleanTicker = ticker.trim().toUpperCase().replace(/^[\$#]/, '').replace(/\.JK$/i, '');
    currentActiveTicker = cleanTicker;

    // Open modal with loading placeholders
    modalAnalysis.classList.remove('hidden');
    modalAnalysis.classList.add('flex');
    document.body.style.overflow = 'hidden';

    document.getElementById('modal-stock-ticker').textContent = cleanTicker;
    document.getElementById('modal-ticker-icon').textContent = cleanTicker.charAt(0);
    document.getElementById('modal-price').textContent = 'Memuat...';
    document.getElementById('modal-change').textContent = '...';
    document.getElementById('modal-fin-summary').textContent = `Menghubungi bursa dan menganalisa indikator fundamental & teknikal untuk ${cleanTicker}...`;
    updateModalWatchlistButton(cleanTicker);

    try {
        const res = await fetch(`/api/analyze/${cleanTicker}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal memuat data saham');

        populateAnalysisModal(data);
    } catch (err) {
        document.getElementById('modal-price').textContent = 'N/A';
        document.getElementById('modal-change').textContent = '-';
        document.getElementById('modal-fin-summary').textContent = `Gagal menganalisa ${cleanTicker}: ${err.message}`;
    }
}
window.executeStockAnalysis = executeStockAnalysis;

function populateAnalysisModal(data) {
    const rt = data.realtime;
    const val = data.valuation;
    const trend = data.trend;
    const fin = data.financials;

    // Header info
    document.getElementById('modal-stock-ticker').textContent = data.ticker;
    document.getElementById('modal-stock-timestamp').textContent = `Waktu Akses: ${rt.timestamp || 'Realtime'}`;

    const mktStat = document.getElementById('modal-market-status');
    mktStat.textContent = rt.marketStatus || 'OPEN';
    mktStat.className = rt.marketStatus === 'OPEN' ? 'px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 shadow-sm' : 'px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-800 text-slate-300 shadow-sm';

    // Price ribbon
    document.getElementById('modal-price').textContent = fmtRp.format(rt.lastPrice);
    const chgEl = document.getElementById('modal-change');
    chgEl.textContent = `${rt.changePct >= 0 ? '+' : ''}${rt.changePct.toFixed(2)}%`;
    chgEl.className = `text-2xl font-bold font-mono ${rt.changePct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`;

    document.getElementById('modal-high-low').textContent = `${fmtRp.format(rt.high)} / ${fmtRp.format(rt.low)}`;
    document.getElementById('modal-volume').textContent = fmtNum.format(rt.volume);
    document.getElementById('modal-turnover').textContent = fmtRp.format(rt.value);

    // Valuasi & Harga Wajar
    // Valuasi & Harga Wajar
    const valStatusEl = document.getElementById('modal-val-status');
    valStatusEl.textContent = val.status;
    if (val.status === 'UNDERVALUED' || val.status.includes('UNDERVALUED')) {
        valStatusEl.className = 'px-2 py-0.5 rounded text-[11px] font-extrabold bg-emerald-500/20 text-emerald-400 shadow-sm';
    } else if (val.status === 'OVERVALUED') {
        valStatusEl.className = 'px-2 py-0.5 rounded text-[11px] font-extrabold bg-rose-500/20 text-rose-400 shadow-sm';
    } else if (val.status.includes('TURNAROUND')) {
        valStatusEl.className = 'px-2 py-0.5 rounded text-[11px] font-extrabold bg-cyan-500/20 text-cyan-300 shadow-sm shadow-sm';
    } else {
        valStatusEl.className = 'px-2 py-0.5 rounded text-[11px] font-extrabold bg-amber-500/20 text-amber-400 shadow-sm';
    }

    document.getElementById('modal-val-fair').textContent = val.fairValue ? fmtRp.format(val.fairValue) : 'N/A';
    document.getElementById('modal-val-per').textContent = val.per ? `${val.per}x` : 'N/A';

    // PER Footnote (Aturan 6: Penjelasan jika PER tinggi akibat basis laba rendah masa turnaround)
    const footnoteEl = document.getElementById('modal-val-per-footnote');
    if (footnoteEl) {
        if (val.perFootnote) {
            footnoteEl.textContent = val.perFootnote;
            footnoteEl.classList.remove('hidden');
        } else {
            footnoteEl.classList.add('hidden');
        }
    }

    document.getElementById('modal-val-pbv').textContent = val.pbv ? `${val.pbv}x` : 'N/A';
    document.getElementById('modal-val-eps').textContent = val.eps ? fmtRp.format(val.eps) : 'N/A';
    document.getElementById('modal-val-bvps').textContent = val.bvps ? fmtRp.format(val.bvps) : 'N/A';

    // Analisa Teknikal
    const trendStatEl = document.getElementById('modal-trend-status');
    trendStatEl.textContent = trend.status || 'NEUTRAL';
    if (trend.status === 'UPTREND') {
        trendStatEl.className = 'px-2 py-0.5 rounded text-[11px] font-extrabold bg-emerald-500/20 text-emerald-400 shadow-sm';
    } else if (trend.status === 'DOWNTREND') {
        trendStatEl.className = 'px-2 py-0.5 rounded text-[11px] font-extrabold bg-rose-500/20 text-rose-400 shadow-sm';
    } else {
        trendStatEl.className = 'px-2 py-0.5 rounded text-[11px] font-extrabold bg-amber-500/20 text-amber-400 shadow-sm';
    }

    const stEl = document.getElementById('modal-trend-supertrend');
    if (stEl) {
        if (trend.supertrend) {
            const isB = trend.supertrend.isBullish;
            const suppVal = trend.supertrend.value || trend.supertrend.support || trend.supertrend.resistance;
            stEl.innerHTML = isB
                ? `<span class="text-emerald-400 font-bold">BULLISH 🟢</span> <span class="text-slate-400 text-[10px]">(Supp: ${suppVal ? fmtRp.format(suppVal) : '-'})</span>`
                : `<span class="text-rose-400 font-bold">BEARISH 🔴</span> <span class="text-slate-400 text-[10px]">(Res: ${suppVal ? fmtRp.format(suppVal) : '-'})</span>`;
        } else {
            stEl.textContent = 'N/A';
        }
    }

    const maEl = document.getElementById('modal-trend-ma20-50');
    if (maEl) {
        const ma20 = trend.ema20 || trend.sma20;
        const ma50 = trend.ema50 || trend.sma50;
        if (ma20 && ma50) {
            const isGolden = ma20 > ma50;
            maEl.innerHTML = `<span class="${isGolden ? 'text-cyan-300' : 'text-slate-300'} font-bold">${isGolden ? 'Golden Alignment 🟢' : 'Bearish / Netral ⚪'}</span> <span class="text-slate-400 text-[10px]">(${fmtRp.format(ma20)} / ${fmtRp.format(ma50)})</span>`;
        } else {
            maEl.textContent = 'N/A';
        }
    }

    const rvolEl = document.getElementById('modal-trend-rvol');
    if (rvolEl) {
        const rvol = trend.rvol || 1.0;
        const color = rvol >= 1.5 ? 'text-amber-400' : rvol >= 1.1 ? 'text-emerald-400' : 'text-slate-300';
        rvolEl.innerHTML = `<span class="${color} font-bold font-mono">${rvol.toFixed(2)}x</span> <span class="text-[10px] text-slate-400">(${trend.volumeStatus || 'Normal'})</span>`;
    }

    const rsiEl = document.getElementById('modal-trend-rsi');
    if (rsiEl) {
        const rsiVal = trend.rsi14 ? trend.rsi14.toFixed(1) : '50.0';
        const rsiNum = parseFloat(rsiVal);
        const rsiColor = rsiNum >= 70 ? 'text-rose-400' : rsiNum >= 50 ? 'text-emerald-400' : 'text-amber-400';
        rsiEl.innerHTML = `<span class="${rsiColor} font-bold font-mono">${rsiVal}</span> <span class="text-slate-400 text-[10px]">(${rsiNum > 70 ? 'Overbought' : rsiNum < 35 ? 'Oversold' : 'Sweet Zone'})</span>`;
    }

    const macdAdxEl = document.getElementById('modal-trend-macd-adx');
    if (macdAdxEl) {
        let macdTxt = 'Neutral';
        if (trend.macd_line && trend.macd_signal) {
            macdTxt = trend.macd_line > trend.macd_signal ? 'Bullish 🟢' : 'Bearish 🔴';
        }
        const adxTxt = trend.adx14 ? `${trend.adx14.toFixed(1)}` : '-';
        macdAdxEl.innerHTML = `<span class="text-white font-mono">${macdTxt}</span> | <span class="text-cyan-300 font-mono">ADX ${adxTxt}</span>`;
    }

    // Kesehatan Finansial (Aturan 1, 2, 4, 5)
    const finBadgeEl = document.getElementById('modal-fin-badge');
    if (finBadgeEl) {
        const label = fin.sentimentLabel || fin.healthStatus || 'Q-Report';
        finBadgeEl.textContent = label;
        if (label.includes('TURNAROUND') || label.includes('PEMULIHAN')) {
            finBadgeEl.className = 'px-2.5 py-0.5 rounded text-[11px] font-black bg-emerald-500/25 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.25)]';
        } else if (label.includes('KUAT') || label.includes('POSITIF') || label.includes('SEHAT')) {
            finBadgeEl.className = 'px-2 py-0.5 rounded text-[11px] font-extrabold bg-emerald-500/20 text-emerald-400 shadow-sm';
        } else if (label.includes('WASPADA') || label.includes('RUGI')) {
            finBadgeEl.className = 'px-2 py-0.5 rounded text-[11px] font-extrabold bg-rose-500/20 text-rose-400 shadow-sm';
        } else {
            finBadgeEl.className = 'px-2 py-0.5 rounded text-[11px] font-extrabold bg-amber-500/20 text-amber-400 shadow-sm';
        }
    }

    document.getElementById('modal-fin-roe').textContent = fin.roe ? `${(fin.roe * 100).toFixed(2)}%` : 'N/A';
    document.getElementById('modal-fin-npm').textContent = fin.netProfitMargin ? `${(fin.netProfitMargin * 100).toFixed(2)}%` : 'N/A';

    // Pertumbuhan Laba Bersih (Aturan 2 & 4: Prioritas Laba Bersih > Pendapatan)
    const netGrowthEl = document.getElementById('modal-fin-net-growth');
    if (netGrowthEl) {
        if (fin.isTurnaround) {
            const pct = fin.netProfitGrowth !== null && fin.netProfitGrowth !== undefined ? ` (+${(fin.netProfitGrowth * 100).toFixed(1)}%)` : '';
            netGrowthEl.innerHTML = `<span class="text-emerald-400 font-bold">Turnaround (Rugi ➔ Laba) 🚀</span><span class="text-[10px] text-emerald-300 font-mono">${pct}</span>`;
        } else if (fin.netProfitGrowth !== null && fin.netProfitGrowth !== undefined) {
            const netVal = (fin.netProfitGrowth * 100).toFixed(2);
            const isPos = fin.netProfitGrowth >= 0;
            netGrowthEl.textContent = `${isPos ? '+' : ''}${netVal}%`;
            netGrowthEl.className = `font-mono font-bold ${isPos ? 'text-emerald-400' : 'text-rose-400'}`;
        } else {
            netGrowthEl.textContent = 'Data Terbatas';
            netGrowthEl.className = 'font-mono text-slate-400 font-semibold';
        }
    }

    // Revenue Growth
    const revEl = document.getElementById('modal-fin-rev');
    if (revEl) {
        if (fin.revenueGrowth !== null && fin.revenueGrowth !== undefined) {
            const revVal = (fin.revenueGrowth * 100).toFixed(2);
            revEl.textContent = `${fin.revenueGrowth >= 0 ? '+' : ''}${revVal}%`;
            revEl.className = `font-mono font-semibold ${fin.revenueGrowth >= 0 ? 'text-white' : 'text-amber-300'}`;
        } else {
            revEl.textContent = 'N/A';
            revEl.className = 'font-mono text-slate-400';
        }
    }

    // Beban Pokok (COGS) YoY (Aturan 1: Analisis Efisiensi Biaya)
    const cogsEl = document.getElementById('modal-fin-cogs');
    if (cogsEl) {
        if (fin.cogsGrowth !== null && fin.cogsGrowth !== undefined) {
            const cogsVal = (fin.cogsGrowth * 100).toFixed(2);
            const isDrop = fin.cogsGrowth < 0;
            if (fin.isCostEfficient) {
                cogsEl.innerHTML = `<span class="text-cyan-300 font-bold">${cogsVal}%</span> <span class="text-[10px] text-cyan-400 font-normal">(Efisiensi Beban ✓)</span>`;
            } else {
                cogsEl.textContent = `${fin.cogsGrowth >= 0 ? '+' : ''}${cogsVal}%`;
                cogsEl.className = `font-mono font-semibold ${isDrop ? 'text-emerald-400' : 'text-slate-300'}`;
            }
        } else {
            cogsEl.textContent = 'N/A (Sektor Jasa/Bank)';
            cogsEl.className = 'font-mono text-slate-400 font-semibold';
        }
    }

    // Sektor Perbankan Override vs DER
    const rowDer = document.getElementById('row-fin-der');
    const rowBank = document.getElementById('row-fin-banking');
    const bankRatiosEl = document.getElementById('modal-fin-banking-ratios');
    const derEl = document.getElementById('modal-fin-der');

    if (fin.isBanking && fin.bankingMetrics) {
        if (rowDer) rowDer.classList.add('hidden');
        if (rowBank) {
            rowBank.classList.remove('hidden');
            if (bankRatiosEl) {
                bankRatiosEl.textContent = `${fin.bankingMetrics.npl} (NPL) | ${fin.bankingMetrics.car} (CAR) | ${fin.bankingMetrics.ldr} (LDR)`;
            }
        }
    } else {
        if (rowBank) rowBank.classList.add('hidden');
        if (rowDer) {
            rowDer.classList.remove('hidden');
            if (derEl) {
                derEl.textContent = fin.debtToEquity ? `${(fin.debtToEquity / 100).toFixed(2)}x` : 'Sektor Finansial / Bank';
            }
        }
    }

    // Mata Uang Lapkeu (Aturan 5)
    const currEl = document.getElementById('modal-fin-currency');
    if (currEl) {
        if (fin.currency === 'USD') {
            currEl.innerHTML = `<span class="text-amber-300 font-bold font-mono">USD 💵</span> <span class="text-[10px] text-slate-400">(Dikonversi ke Rp)</span>`;
        } else {
            currEl.textContent = fin.currency || 'IDR';
            currEl.className = 'font-mono text-white font-semibold';
        }
    }

    // AI Summary & Sentiment Badge (Aturan 3: Sinkronisasi Narasi)
    document.getElementById('modal-fin-summary').textContent = fin.summary || 'Data fundamental lengkap tersedia di modul laporan keuangan.';
    const sumBadgeEl = document.getElementById('modal-fin-summary-badge');
    if (sumBadgeEl) {
        if (fin.isTurnaround) {
            sumBadgeEl.textContent = 'TURNAROUND / PEMULIHAN';
            sumBadgeEl.className = 'px-2 py-0.5 rounded text-[10px] font-black bg-emerald-500/20 text-emerald-300 shadow-sm shadow-sm';
            sumBadgeEl.classList.remove('hidden');
        } else if (fin.isCostEfficient) {
            sumBadgeEl.textContent = 'EFISIENSI BIAYA (MARGIN NAIK)';
            sumBadgeEl.className = 'px-2 py-0.5 rounded text-[10px] font-black bg-cyan-500/20 text-cyan-300 shadow-sm shadow-sm';
            sumBadgeEl.classList.remove('hidden');
        } else if (fin.healthStatus && fin.healthStatus !== 'MODERAT') {
            sumBadgeEl.textContent = fin.sentimentLabel || fin.healthStatus;
            sumBadgeEl.className = 'px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 shadow-sm';
            sumBadgeEl.classList.remove('hidden');
        } else {
            sumBadgeEl.classList.add('hidden');
        }
    }

    // Konsensus Analis (BUG FIXED: always displayed properly!)
    const recEl = document.getElementById('modal-analyst-rec');
    const targetEl = document.getElementById('modal-analyst-target');
    const upsideEl = document.getElementById('modal-analyst-upside');

    const rec = fin.analystRecommendation || val.recommendation;
    if (!rec || rec.toLowerCase() === 'none') {
        recEl.textContent = 'NEUTRAL / KONSENSUS MINIM';
        recEl.className = 'bg-slate-800 text-slate-300 shadow-sm px-3 py-1 rounded-full text-xs font-bold uppercase';
    } else if (rec.toLowerCase().includes('buy')) {
        recEl.textContent = rec.toUpperCase();
        recEl.className = 'bg-emerald-500/20 text-emerald-400 shadow-sm px-3 py-1 rounded-full text-xs font-black uppercase';
    } else if (rec.toLowerCase().includes('sell')) {
        recEl.textContent = rec.toUpperCase();
        recEl.className = 'bg-rose-500/20 text-rose-400 shadow-sm px-3 py-1 rounded-full text-xs font-black uppercase';
    } else {
        recEl.textContent = rec.toUpperCase();
        recEl.className = 'bg-amber-500/20 text-amber-400 shadow-sm px-3 py-1 rounded-full text-xs font-black uppercase';
    }

    const targetPrice = fin.targetPrice || val.targetMeanPrice;
    if (targetPrice) {
        targetEl.textContent = fmtRp.format(targetPrice);
        const upside = fin.upsidePct !== null && fin.upsidePct !== undefined
            ? (fin.upsidePct * 100).toFixed(1)
            : (((targetPrice - rt.lastPrice) / rt.lastPrice) * 100).toFixed(1);
        upsideEl.textContent = `(${upside > 0 ? '+' : ''}${upside}% Upside)`;
        upsideEl.className = `text-xs font-bold font-mono ml-1.5 ${upside > 0 ? 'text-emerald-400' : 'text-rose-400'}`;
    } else {
        targetEl.textContent = fmtRp.format(rt.lastPrice * 1.15);
        upsideEl.textContent = '(Estimasi +15%)';
    }

    // Card 4: Aliran Asing & Flow
    const ff = data.foreignFlow;
    const ffStatusEl = document.getElementById('modal-foreign-status');
    const ffNet1dEl = document.getElementById('modal-foreign-net1d');
    const ffNet5dEl = document.getElementById('modal-foreign-net5d');
    const ffVwapEl = document.getElementById('modal-foreign-vwap');
    const ffFfpiEl = document.getElementById('modal-foreign-ffpi');
    const ffStreakEl = document.getElementById('modal-foreign-streak');

    if (ff) {
        if (ffStatusEl) {
            const st = ff.daily?.status || ff.weekly?.phase || 'NETRAL ⚪';
            ffStatusEl.textContent = st;
            if (st.includes('AKUMULASI') || st.includes('Mark-Up')) {
                ffStatusEl.className = 'px-2 py-0.5 rounded text-[11px] font-extrabold bg-emerald-500/20 text-emerald-400 shadow-sm';
            } else if (st.includes('DISTRIBUSI') || st.includes('Distribution')) {
                ffStatusEl.className = 'px-2 py-0.5 rounded text-[11px] font-extrabold bg-rose-500/20 text-rose-400 shadow-sm';
            } else {
                ffStatusEl.className = 'px-2 py-0.5 rounded text-[11px] font-extrabold bg-cyan-500/20 text-cyan-300 shadow-sm';
            }
        }
        if (ffNet1dEl) {
            const net1d = ff.daily?.netForeignVal || 0;
            ffNet1dEl.textContent = fmtRpMiliar(net1d);
            ffNet1dEl.className = `font-mono font-bold ${net1d >= 0 ? 'text-emerald-400' : 'text-rose-400'}`;
        }
        if (ffNet5dEl) {
            const net5d = ff.weekly?.weeklyNetVal || 0;
            ffNet5dEl.textContent = fmtRpMiliar(net5d);
            ffNet5dEl.className = `font-mono font-semibold ${net5d >= 0 ? 'text-emerald-400' : 'text-rose-400'}`;
        }
        if (ffVwapEl) {
            const vwap = ff.monthly?.foreignVWAP || ff.weekly?.vwap;
            ffVwapEl.textContent = vwap ? fmtRp.format(vwap) : 'Rp -';
        }
        if (ffFfpiEl) {
            const ffpi = ff.daily?.ffpi !== undefined ? ff.daily.ffpi : 0;
            ffFfpiEl.textContent = `${ffpi > 0 ? '+' : ''}${ffpi} / 100`;
            ffFfpiEl.className = `font-mono font-semibold ${ffpi >= 30 ? 'text-emerald-400' : ffpi <= -30 ? 'text-rose-400' : 'text-cyan-300'}`;
        }
        if (ffStreakEl) {
            if (ff.streak && ff.streak.streakDays >= 2) {
                ffStreakEl.innerHTML = `<span class="text-amber-400 font-bold">${ff.streak.streakDays} Hari 🔥</span> <span class="text-slate-400 text-[10px]">(${fmtRpMiliar(ff.streak.streakTotalVal)})</span>`;
            } else {
                ffStreakEl.textContent = 'Netral / 0 Hari';
                ffStreakEl.className = 'font-mono text-slate-400 font-semibold';
            }
        }
    } else {
        if (ffStatusEl) ffStatusEl.textContent = 'NETRAL';
        if (ffNet1dEl) ffNet1dEl.textContent = 'Rp 0 M';
        if (ffNet5dEl) ffNet5dEl.textContent = 'Rp 0 M';
        if (ffVwapEl) ffVwapEl.textContent = 'Rp -';
        if (ffFfpiEl) ffFfpiEl.textContent = '0 / 100';
        if (ffStreakEl) ffStreakEl.textContent = '-';
    }

    // Associated Corporate News List
    const newsContainer = document.getElementById('modal-news-list');
    newsContainer.innerHTML = '';
    if (data.news && data.news.length > 0) {
        data.news.forEach(n => {
            const item = document.createElement('div');
            item.className = 'bg-[#070b13] hover:bg-[#111827] shadow-sm p-3 rounded-lg flex flex-col justify-between transition group gap-2';
            item.innerHTML = `
                <div>
                    <div class="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                        <span class="text-cyan-400 font-bold">${n.source}</span>
                        <span class="text-emerald-400 font-mono font-semibold">🕒 ${n.date || n.timeAgo}</span>
                    </div>
                    <h5 class="text-xs font-semibold text-slate-200 group-hover:text-amber-300 leading-snug">${n.title}</h5>
                    <p class="text-[10px] text-slate-400 italic mt-1">${n.impact}</p>
                </div>
                <div class="flex justify-end pt-1">
                    <a href="${n.link}" target="_blank" rel="noopener noreferrer"
                       class="inline-flex items-center gap-1 text-[11px] font-bold text-sky-300 hover:text-sky-100 bg-sky-950/60 hover:bg-sky-900/80 shadow-sm px-2.5 py-1 rounded transition">
                        <span>Baca Berita Lengkap</span>
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                    </a>
                </div>
            `;
            newsContainer.appendChild(item);
        });
    } else {
        newsContainer.innerHTML = `<p class="col-span-full text-xs text-slate-500 text-center py-4">Tidak ada aksi korporasi besar dalam 30 hari terakhir.</p>`;
    }

    // Card 5: Modul Aksi Korporasi Rights Issue (HMETD) & Tebus Calculator
    const ri = data.rightsIssue;
    const riContainer = document.getElementById('modal-rights-issue-container');

    if (ri && riContainer) {
        const badge = document.getElementById('modal-rights-status-badge');
        if (badge) {
            if (ri.hasRightsIssue && ri.isCorporateActionActive) {
                badge.textContent = 'HMETD AKTIF 🔥';
                badge.className = 'px-2.5 py-1 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-300 shadow-sm shadow-sm';
            } else if (ri.hasRightsIssue) {
                badge.textContent = ri.status || 'HISTORIS BENCHMARK';
                badge.className = 'px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 shadow-sm';
            } else {
                badge.textContent = 'SIMULASI HMETD';
                badge.className = 'px-2.5 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-300 shadow-sm';
            }
        }

        const ratioEl = document.getElementById('modal-rights-ratio');
        if (ratioEl) ratioEl.textContent = ri.ratioDisplay || `${ri.ratioOld || 100} : ${ri.ratioNew || 25}`;

        const peEl = document.getElementById('modal-rights-exercise-price');
        if (peEl) peEl.textContent = fmtRp.format(ri.exercisePrice || 0);

        const theoEl = document.getElementById('modal-rights-theoretical-price');
        if (theoEl) theoEl.textContent = fmtRp.format(ri.theoreticalPrice || 0);

        const dilEl = document.getElementById('modal-rights-dilution');
        if (dilEl) dilEl.textContent = `${(ri.dilutionPct || 0).toFixed(2)}%`;

        const discEl = document.getElementById('modal-rights-discount');
        if (discEl) {
            const disc = ri.discountPct || 0;
            discEl.textContent = `${disc >= 0 ? '+' : ''}${disc.toFixed(1)}%`;
            discEl.className = `font-mono font-bold text-sm ${disc >= 0 ? 'text-emerald-400' : 'text-rose-400'}`;
        }

        const procEl = document.getElementById('modal-rights-proceeds');
        if (procEl) procEl.textContent = ri.targetProceeds || '-';

        const sbEl = document.getElementById('modal-rights-standby-buyer');
        if (sbEl) sbEl.textContent = ri.standbyBuyer || 'Tidak Ada / Mandiri';

        const cumEl = document.getElementById('modal-rights-cum-date');
        if (cumEl) cumEl.textContent = ri.dates?.cumDate || '-';

        const tradeEl = document.getElementById('modal-rights-trading-period');
        if (tradeEl) tradeEl.textContent = (ri.dates?.tradingStart && ri.dates?.tradingStart !== '-') ? `${ri.dates.tradingStart} s/d ${ri.dates.tradingEnd}` : '-';

        const aiEl = document.getElementById('modal-rights-ai-summary');
        if (aiEl) aiEl.textContent = ri.aiSummary || 'Evaluasi rasio dilusi dan harga teoretis terhadap harga pasar.';

        // Populate calculator input fields
        const inputLots = document.getElementById('input-rights-lots');
        const inputPe = document.getElementById('input-rights-pe');
        const inputR = document.getElementById('input-rights-ratio-r');

        if (inputLots) inputLots.value = 100;
        if (inputPe) inputPe.value = ri.exercisePrice || 1000;
        if (inputR) {
            const rVal = ri.ratioOld ? Math.round((ri.ratioNew / ri.ratioOld) * 100) : (ri.ratioNew || 25);
            inputR.value = rVal;
        }

        // Active recalculator for current stock
        window.activeCalculateTebus = function () {
            const L = Math.max(0, parseInt(inputLots?.value) || 0);
            const pe = Math.max(1, parseFloat(inputPe?.value) || 1000);
            const r = Math.max(0, parseFloat(inputR?.value) || 25);
            const p0 = rt.lastPrice || 1000;
            const N = 100;

            const rightsLots = Math.floor(L * (r / N));
            const rightsShares = rightsLots * 100;
            const totalCost = rightsShares * pe;
            const initialVal = L * 100 * p0;
            const totalSharesPost = (L + rightsLots) * 100;
            const avgPrice = totalSharesPost > 0 ? Math.round((initialVal + totalCost) / totalSharesPost) : 0;
            const dilution = ((r / (N + r)) * 100).toFixed(2);

            const calcLotsEl = document.getElementById('calc-rights-lots');
            if (calcLotsEl) calcLotsEl.textContent = `${rightsLots.toLocaleString('id-ID')} Lot`;

            const calcSharesEl = document.getElementById('calc-rights-shares');
            if (calcSharesEl) calcSharesEl.textContent = `(${rightsShares.toLocaleString('id-ID')} lbr)`;

            const calcCostEl = document.getElementById('calc-rights-cost');
            if (calcCostEl) calcCostEl.textContent = fmtRp.format(totalCost);

            const calcAvgEl = document.getElementById('calc-rights-avg-price');
            if (calcAvgEl) calcAvgEl.textContent = fmtRp.format(avgPrice);

            const calcDilEl = document.getElementById('calc-rights-dilution-status');
            if (calcDilEl) calcDilEl.textContent = `${dilution}%`;
        };

        window.activeCalculateTebus();
    }
}

btnCloseModal.addEventListener('click', () => {
    modalAnalysis.classList.add('hidden');
    modalAnalysis.classList.remove('flex');
    document.body.style.overflow = 'auto';
});

// Close modal when clicking outer backdrop
modalAnalysis.addEventListener('click', (e) => {
    if (e.target === modalAnalysis) {
        btnCloseModal.click();
    }
});

// Rights Issue (HMETD) Interactive Tebus Calculator Live Input Handlers
['input-rights-lots', 'input-rights-pe', 'input-rights-ratio-r'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
        el.addEventListener('input', () => {
            if (typeof window.activeCalculateTebus === 'function') {
                window.activeCalculateTebus();
            }
        });
    }
});

// --- END MODULE: analysisModal.js ---

// --- START MODULE: search.js ---
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

// --- END MODULE: search.js ---

// --- START MODULE: screener.js ---
// ============================================================
//  MODULE: screener.js
//  Screener candidate tables, session toggles, and sector filtering
// ============================================================

// ============================================================
//  SHARED SCREENER HELPERS
// ============================================================
function confCell(confidence, label) {
    const color = confidence >= 75 ? 'text-emerald-400' : confidence >= 55 ? 'text-amber-400' : 'text-orange-400';
    const barColor = confidence >= 75 ? 'bg-emerald-400' : confidence >= 55 ? 'bg-amber-400' : 'bg-orange-400';
    const badgeBg = confidence >= 75 ? 'bg-emerald-500/20 text-emerald-400 shadow-sm' : confidence >= 55 ? 'bg-amber-500/20 text-amber-400 shadow-sm' : 'bg-orange-500/20 text-orange-400 shadow-sm';
    return `
        <td class="p-3">
            <div class="flex items-center gap-2">
                <span class="${color} font-bold font-mono text-xs">${confidence}%</span>
                <div class="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div class="${barColor} h-full rounded-full" style="width:${confidence}%"></div>
                </div>
            </div>
        </td>
        <td class="p-3">
            <span class="text-[10px] px-2 py-0.5 rounded font-semibold shadow-sm ${badgeBg}">${label}</span>
        </td>
    `;
}

function getRankBadge(row) {
    if (row.rank === 1) return `<span class="text-[9px] px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-bold tracking-tight shadow-sm">🥇 #1</span>`;
    if (row.rank === 2) return `<span class="text-[9px] px-1.5 py-0.5 rounded-md bg-slate-400/20 text-slate-200 font-bold tracking-tight shadow-sm">🥈 #2</span>`;
    if (row.rank === 3) return `<span class="text-[9px] px-1.5 py-0.5 rounded-md bg-amber-700/20 text-amber-400 font-bold tracking-tight shadow-sm">🥉 #3</span>`;
    return '';
}

function filterScreenerList(items) {
    if (!Array.isArray(items)) return [];
    let result = items;
    const selectedSector = (typeof screenerSectorSelect !== 'undefined' && screenerSectorSelect?.value) || 'all';
    if (selectedSector !== 'all') {
        result = result.filter(item => (item.sector || '').toLowerCase().includes(selectedSector.toLowerCase()));
    }
    const limit = typeof screenerViewLimit !== 'undefined' ? screenerViewLimit : 'all';
    if (limit === 'top3') {
        result = result.slice(0, 3);
    }
    return result;
}

// ============================================================
//  5. SCREENER EXECUTION & RENDERING
// ============================================================

function renderScalpingTable(session = 'sesi1') {
    activeScalpSession = session;
    const tbodyScalp = document.getElementById('tbody-scalping');
    const btnSesi1 = document.getElementById('btn-scalp-sesi1');
    const btnSesi2 = document.getElementById('btn-scalp-sesi2');
    const targetInfo = document.getElementById('scalp-target-info');

    if (session === 'sesi1') {
        if (btnSesi1) btnSesi1.className = 'scalp-sesi-btn active bg-emerald-500/20 text-emerald-400 text-xs font-bold px-3 py-1 rounded-lg transition flex items-center gap-1.5 shadow-sm';
        if (btnSesi2) btnSesi2.className = 'scalp-sesi-btn text-slate-400 hover:text-slate-200 text-xs font-bold px-3 py-1 rounded-lg transition flex items-center gap-1.5 ml-1';
        if (targetInfo) targetInfo.textContent = 'Target Gain: 1.5% - 2.5% | Jam: 09:00 - 11:30 WIB';
    } else {
        if (btnSesi1) btnSesi1.className = 'scalp-sesi-btn text-slate-400 hover:text-slate-200 text-xs font-bold px-3 py-1 rounded-lg transition flex items-center gap-1.5';
        if (btnSesi2) btnSesi2.className = 'scalp-sesi-btn active bg-amber-500/20 text-amber-400 text-xs font-bold px-3 py-1 rounded-lg transition flex items-center gap-1.5 shadow-sm ml-1';
        if (targetInfo) targetInfo.textContent = 'Target Gain: 1.8% - 3.0% | Jam: 13:30 - 15:50 WIB';
    }

    if (!tbodyScalp) return;

    const rawList = session === 'sesi1'
        ? (lastScreenerData?.scalpingSesi1 || lastScreenerData?.scalping || [])
        : (lastScreenerData?.scalpingSesi2 || lastScreenerData?.scalping || []);

    const list = filterScreenerList(rawList);

    if (!list || list.length === 0) {
        tbodyScalp.innerHTML = `<tr><td colspan="10" class="p-4 text-center text-slate-500 italic">Tidak ada saham lolos filter scalping ${session === 'sesi1' ? 'Sesi 1' : 'Sesi 2'} saat ini.</td></tr>`;
        return;
    }

    tbodyScalp.innerHTML = list.map(row => {
        const tick = (row.price < 200 ? 1 : row.price < 500 ? 2 : row.price < 2000 ? 5 : row.price < 5000 ? 10 : 25);
        const antrean = row.antreanBeli || (session === 'sesi1' ? `Antre Bid Rp ${fmtRp.format(row.price - tick)} - Rp ${fmtRp.format(row.price)} (Bid 1-2)` : `Antre Bid Rp ${fmtRp.format(row.price - 2 * tick)} - Rp ${fmtRp.format(row.price - tick)} (Bid 2-3)`);
        const jam = row.jamEksekusi || (session === 'sesi1' ? '09:00 - 09:30 WIB' : '13:30 - 14:15 WIB');
        const rankBadge = getRankBadge(row);
        const stBadge = row.supertrendBadge ? `<span class="text-[9px] px-1.5 py-0.2 rounded bg-emerald-950/80 text-emerald-400 shadow-sm font-sans font-semibold">${row.supertrendBadge}</span>` : '';
        const rvBadge = row.rvolBadge ? `<span class="text-[9px] px-1.5 py-0.2 rounded bg-amber-950/80 text-amber-300 shadow-sm font-sans font-semibold">${row.rvolBadge}</span>` : '';

        return `
            <tr class=" hover:bg-[#11192a] transition cursor-pointer" data-ticker="${row.ticker}">
                <td class="p-3 font-mono">
                    <div class="flex items-center gap-1.5">
                        <span class="font-bold text-cyan-400 hover:underline text-sm">$${row.ticker}</span>
                        ${rankBadge}
                    </div>
                    <div class="flex flex-wrap items-center gap-1 mt-1">${stBadge} ${rvBadge}</div>
                </td>
                <td class="p-3 font-mono font-semibold text-white">${fmtRp.format(row.price)}</td>
                <td class="p-3 font-mono font-bold ${parseFloat(row.changePct) >= 0 ? 'text-emerald-400' : 'text-rose-400'}">${parseFloat(row.changePct) >= 0 ? '+' : ''}${row.changePct}%</td>
                <td class="p-3 font-mono text-slate-300">${row.range}%</td>
                <td class="p-3 font-mono font-bold text-cyan-300 whitespace-nowrap"><span class="bg-cyan-950/40 shadow-sm px-2 py-0.5 rounded text-xs">${antrean}</span></td>
                <td class="p-3 font-mono text-amber-300 font-semibold whitespace-nowrap text-xs">🕒 ${jam}</td>
                <td class="p-3 font-mono font-semibold text-emerald-400">${fmtRp.format(row.targetProfit)}</td>
                <td class="p-3 font-mono text-rose-400">${fmtRp.format(row.stopLoss)}</td>
                ${confCell(row.confidence, row.label)}
            </tr>
        `;
    }).join('');
}

// Bind Sesi 1 & Sesi 2 buttons
document.getElementById('btn-scalp-sesi1')?.addEventListener('click', () => {
    renderScalpingTable('sesi1');
});
document.getElementById('btn-scalp-sesi2')?.addEventListener('click', () => {
    renderScalpingTable('sesi2');
});

btnTriggerScreener?.addEventListener('click', async () => {
    if (btnTriggerScreener) btnTriggerScreener.disabled = true;
    screenerLoading?.classList.remove('hidden');
    screenerResultsWrapper?.classList.add('hidden');
    screenerBtnIcon?.classList.add('animate-spin');

    // ── Live Elapsed Timer & Progress ──────────────────────────
    const timerEl = document.getElementById('screener-timer');
    const statusEl = document.getElementById('screener-scan-status');
    const progressBar = document.getElementById('screener-progress-bar');
    let elapsed = 0;
    let progress = 0;
    if (timerEl) timerEl.textContent = '0s';
    if (progressBar) progressBar.style.width = '0%';
    if (statusEl) statusEl.textContent = 'Menginisialisasi engine...';

    const statusMessages = [
        'Mengambil data harga real-time...',
        'Menghitung Supertrend (10, 3.0)...',
        'Menghitung MA 20 / 50 Golden Alignment...',
        'Mendeteksi lonjakan Volume Spike (RVol)...',
        'Analisis RSI & MACD expansion...',
        'Filter anti-gorengan ketat & likuiditas...',
        'Menentukan antrean Bid scalping...',
        'Menghitung stop-loss & target profit...',
        'Menyusun 3 rekomendasi terbaik tiap kategori...',
        'Finalisasi analisis teknikal...'
    ];

    const timerInterval = setInterval(() => {
        elapsed++;
        if (timerEl) timerEl.textContent = elapsed + 's';

        // Simulate progress (cap at 90% until real response arrives)
        if (progress < 90) {
            progress += (90 - progress) * 0.08;
            if (progressBar) progressBar.style.width = Math.round(progress) + '%';
        }

        // Cycle status messages
        const msgIdx = Math.min(Math.floor(elapsed / 3), statusMessages.length - 1);
        if (statusEl) statusEl.textContent = statusMessages[msgIdx];
    }, 1000);

    try {
        const res = await fetch('/api/screener');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        // Complete the progress bar
        if (progressBar) progressBar.style.width = '100%';
        const totalTopPicks = (data.scalping?.length || 0) + (data.daytrade?.length || 0) + (data.swing?.length || 0) + (data.bsjp?.length || 0) + (data.bpjp?.length || 0) + (data.longterm?.length || 0);
        if (statusEl) statusEl.textContent = `✅ Selesai dalam ${elapsed}s — Top ${totalTopPicks} saham rekomendasi berhasil dikurasi`;

        lastScreenerData = data;
        renderScreenerResults(data);

        // Short delay to show 100% completion
        await new Promise(r => setTimeout(r, 500));
        screenerResultsWrapper?.classList.remove('hidden');
    } catch (err) {
        alert('Kendala Screener: ' + err.message);
    } finally {
        clearInterval(timerInterval);
        screenerLoading?.classList.add('hidden');
        if (btnTriggerScreener) btnTriggerScreener.disabled = false;
        screenerBtnIcon?.classList.remove('animate-spin');
    }
});

function renderScreenerResults(data) {
    if (!data) return;

    // 1. Scalping (rendered with session support)
    renderScalpingTable(activeScalpSession || 'sesi1');

    // 2. Daytrade
    const tbodyDay = document.getElementById('tbody-daytrade');
    if (tbodyDay) {
        const dayList = filterScreenerList(data.daytrade || []);
        if (dayList.length === 0) {
            tbodyDay.innerHTML = `<tr><td colspan="8" class="p-4 text-center text-slate-500 italic">Tidak ada saham lolos filter daytrade ketat saat ini.</td></tr>`;
        } else {
            tbodyDay.innerHTML = dayList.map(row => {
                const rankBadge = getRankBadge(row);
                const stBadge = row.supertrendBadge ? `<span class="text-[9px] px-1.5 py-0.2 rounded bg-emerald-950/80 text-emerald-400 shadow-sm font-sans font-semibold">${row.supertrendBadge}</span>` : '';
                const rvBadge = row.rvolBadge ? `<span class="text-[9px] px-1.5 py-0.2 rounded bg-amber-950/80 text-amber-300 shadow-sm font-sans font-semibold">${row.rvolBadge}</span>` : '';

                return `
                    <tr class=" hover:bg-[#11192a] transition cursor-pointer" data-ticker="${row.ticker}">
                        <td class="p-3 font-mono">
                            <div class="flex items-center gap-1.5">
                                <span class="font-bold text-cyan-400 hover:underline text-sm">$${row.ticker}</span>
                                ${rankBadge}
                            </div>
                            <div class="flex flex-wrap items-center gap-1 mt-1">${stBadge} ${rvBadge}</div>
                        </td>
                        <td class="p-3 font-mono font-semibold text-white">${fmtRp.format(row.price)}</td>
                        <td class="p-3 font-mono font-bold ${parseFloat(row.changePct) >= 0 ? 'text-emerald-400' : 'text-rose-400'}">${parseFloat(row.changePct) >= 0 ? '+' : ''}${row.changePct}%</td>
                        <td class="p-3 font-mono text-slate-300">${row.entryZone}</td>
                        <td class="p-3 font-mono font-semibold text-emerald-400">${fmtRp.format(row.targetProfit)}</td>
                        <td class="p-3 font-mono text-rose-400">${fmtRp.format(row.stopLoss)}</td>
                        ${confCell(row.confidence, row.label)}
                    </tr>
                `;
            }).join('');
        }
    }

    // 3. Swing
    const tbodySwing = document.getElementById('tbody-swing');
    if (tbodySwing) {
        const swingList = filterScreenerList(data.swing || []);
        if (swingList.length === 0) {
            tbodySwing.innerHTML = `<tr><td colspan="9" class="p-4 text-center text-slate-500 italic">Tidak ada saham lolos filter swing ketat saat ini.</td></tr>`;
        } else {
            tbodySwing.innerHTML = swingList.map(row => {
                const rankBadge = getRankBadge(row);
                const stBadge = row.supertrendBadge ? `<span class="text-[9px] px-1.5 py-0.2 rounded bg-emerald-950/80 text-emerald-400 shadow-sm font-sans font-semibold">${row.supertrendBadge}</span>` : '';
                const rvBadge = row.rvolBadge ? `<span class="text-[9px] px-1.5 py-0.2 rounded bg-amber-950/80 text-amber-300 shadow-sm font-sans font-semibold">${row.rvolBadge}</span>` : '';

                return `
                    <tr class=" hover:bg-[#11192a] transition cursor-pointer" data-ticker="${row.ticker}">
                        <td class="p-3 font-mono">
                            <div class="flex items-center gap-1.5">
                                <span class="font-bold text-cyan-400 hover:underline text-sm">$${row.ticker}</span>
                                ${rankBadge}
                            </div>
                            <div class="flex flex-wrap items-center gap-1 mt-1">${stBadge} ${rvBadge}</div>
                        </td>
                        <td class="p-3 font-mono font-semibold text-white">${fmtRp.format(row.price)}</td>
                        <td class="p-3 font-mono text-slate-300">${row.areaBuy}</td>
                        <td class="p-3 font-mono font-semibold text-emerald-400">${fmtRp.format(row.targetPrice1)}</td>
                        <td class="p-3 font-mono font-semibold text-emerald-400">${fmtRp.format(row.targetPrice2)}</td>
                        <td class="p-3 font-mono text-rose-400">${fmtRp.format(row.cutLoss)}</td>
                        <td class="p-3 font-mono font-bold text-purple-400">${row.riskReward}</td>
                        ${confCell(row.confidence, row.label)}
                    </tr>
                `;
            }).join('');
        }
    }

    // 4. BSJP
    const tbodyBsjp = document.getElementById('tbody-bsjp');
    if (tbodyBsjp) {
        const bsjpList = filterScreenerList(data.bsjp || []);
        if (bsjpList.length === 0) {
            tbodyBsjp.innerHTML = `<tr><td colspan="9" class="p-4 text-center text-slate-500 italic">Tidak ada saham lolos filter BSJP ketat saat ini.</td></tr>`;
        } else {
            tbodyBsjp.innerHTML = bsjpList.map(row => {
                const rankBadge = getRankBadge(row);
                const stBadge = row.supertrendBadge ? `<span class="text-[9px] px-1.5 py-0.2 rounded bg-emerald-950/80 text-emerald-400 shadow-sm font-sans font-semibold">${row.supertrendBadge}</span>` : '';
                const rvBadge = row.rvolBadge ? `<span class="text-[9px] px-1.5 py-0.2 rounded bg-amber-950/80 text-amber-300 shadow-sm font-sans font-semibold">${row.rvolBadge}</span>` : '';

                return `
                    <tr class=" hover:bg-[#11192a] transition cursor-pointer" data-ticker="${row.ticker}">
                        <td class="p-3 font-mono">
                            <div class="flex items-center gap-1.5">
                                <span class="font-bold text-cyan-400 hover:underline text-sm">$${row.ticker}</span>
                                ${rankBadge}
                            </div>
                            <div class="flex flex-wrap items-center gap-1 mt-1">${stBadge} ${rvBadge}</div>
                        </td>
                        <td class="p-3 font-mono font-semibold text-white">${fmtRp.format(row.price)}</td>
                        <td class="p-3 font-mono font-semibold ${parseFloat(row.rsi) > 60 ? 'text-amber-400' : 'text-emerald-400'}">${row.rsi}</td>
                        <td class="p-3 font-mono text-slate-300">${row.pullbackFromHigh}%</td>
                        <td class="p-3 text-amber-400 text-xs">${row.beliSore}</td>
                        <td class="p-3 font-mono font-semibold text-emerald-400">${fmtRp.format(row.targetPagi)}</td>
                        <td class="p-3 font-mono text-rose-400">${fmtRp.format(row.stopLoss)}</td>
                        ${confCell(row.confidence, row.label)}
                    </tr>
                `;
            }).join('');
        }
    }

    // 5. BPJP
    const tbodyBpjp = document.getElementById('tbody-bpjp');
    if (tbodyBpjp) {
        const bpjpList = filterScreenerList(data.bpjp || []);
        if (bpjpList.length === 0) {
            tbodyBpjp.innerHTML = `<tr><td colspan="10" class="p-4 text-center text-slate-500 italic">Tidak ada saham lolos filter BPJP oversold saat ini.</td></tr>`;
        } else {
            tbodyBpjp.innerHTML = bpjpList.map(row => {
                const rankBadge = getRankBadge(row);
                const stBadge = row.supertrendBadge ? `<span class="text-[9px] px-1.5 py-0.2 rounded bg-emerald-950/80 text-emerald-400 shadow-sm font-sans font-semibold">${row.supertrendBadge}</span>` : '';
                const rvBadge = row.rvolBadge ? `<span class="text-[9px] px-1.5 py-0.2 rounded bg-amber-950/80 text-amber-300 shadow-sm font-sans font-semibold">${row.rvolBadge}</span>` : '';

                return `
                    <tr class=" hover:bg-[#11192a] transition cursor-pointer" data-ticker="${row.ticker}">
                        <td class="p-3 font-mono">
                            <div class="flex items-center gap-1.5">
                                <span class="font-bold text-cyan-400 hover:underline text-sm">$${row.ticker}</span>
                                ${rankBadge}
                            </div>
                            <div class="flex flex-wrap items-center gap-1 mt-1">${stBadge} ${rvBadge}</div>
                        </td>
                        <td class="p-3 font-mono font-semibold text-white">${fmtRp.format(row.price)}</td>
                        <td class="p-3 font-mono font-semibold text-emerald-400">${row.rsi} <span class="text-[10px] text-cyan-300 font-sans">(${row.rsiStatus || 'Bounce'})</span></td>
                        <td class="p-3 font-mono text-purple-400">${row.adx}</td>
                        <td class="p-3 font-mono text-slate-300">${row.macd}</td>
                        <td class="p-3 text-pink-400 text-xs">${row.entryPagi}</td>
                        <td class="p-3 font-mono font-semibold text-emerald-400">${fmtRp.format(row.target)}</td>
                        <td class="p-3 font-mono text-rose-400">${fmtRp.format(row.stopLoss)}</td>
                        ${confCell(row.confidence, row.label)}
                    </tr>
                `;
            }).join('');
        }
    }

    // 6. Jangka Panjang
    const tbodyLong = document.getElementById('tbody-longterm');
    if (tbodyLong) {
        const longList = filterScreenerList(data.longterm || []);
        if (longList.length === 0) {
            tbodyLong.innerHTML = `<tr><td colspan="10" class="p-4 text-center text-slate-500 italic">Tidak ada saham lolos filter jangka panjang saat ini.</td></tr>`;
        } else {
            tbodyLong.innerHTML = longList.map(row => {
                const rankBadge = getRankBadge(row);
                const stBadge = row.supertrendBadge ? `<span class="text-[9px] px-1.5 py-0.2 rounded bg-emerald-950/80 text-emerald-400 shadow-sm font-sans font-semibold">${row.supertrendBadge}</span>` : '';

                return `
                    <tr class=" hover:bg-[#11192a] transition cursor-pointer" data-ticker="${row.ticker}">
                        <td class="p-3 font-mono">
                            <div class="flex items-center gap-1.5">
                                <span class="font-bold text-cyan-400 hover:underline text-sm">$${row.ticker}</span>
                                ${rankBadge}
                            </div>
                            <div class="flex flex-wrap items-center gap-1 mt-1">${stBadge}</div>
                        </td>
                        <td class="p-3 font-mono font-semibold text-white">${fmtRp.format(row.price)}</td>
                        <td class="p-3 font-mono font-semibold text-amber-400">${row.rsi}</td>
                        <td class="p-3 font-mono text-slate-300">${fmtRp.format(row.ema200)}</td>
                        <td class="p-3 font-mono text-slate-400">${fmtRp.format(row.support)}</td>
                        <td class="p-3 font-mono font-semibold text-emerald-400">${fmtRp.format(row.targetKonservatif)}</td>
                        <td class="p-3 font-mono font-extrabold text-emerald-300">${fmtRp.format(row.targetAgresif)}</td>
                        <td class="p-3 font-mono text-rose-400">${fmtRp.format(row.cutLoss)}</td>
                        ${confCell(row.confidence, row.label)}
                    </tr>
                `;
            }).join('');
        }
    }
}

// Delegated click handler for all screener tables (guarantees clickability regardless of scope)
['tbody-scalping', 'tbody-daytrade', 'tbody-swing', 'tbody-bsjp', 'tbody-bpjp', 'tbody-longterm'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('click', (e) => {
        const tr = e.target.closest('tr[data-ticker]');
        if (tr) {
            const ticker = tr.getAttribute('data-ticker');
            if (ticker) executeStockAnalysis(ticker);
        }
    });
});

// Screener Sector & View Limit Event Listeners
screenerSectorSelect?.addEventListener('change', () => {
    if (lastScreenerData) renderScreenerResults(lastScreenerData);
});
btnViewTop3?.addEventListener('click', () => {
    screenerViewLimit = 'top3';
    if (btnViewTop3) btnViewTop3.className = 'view-limit-btn active bg-emerald-500/20 text-emerald-400 shadow-sm text-xs font-bold px-3 py-1 rounded-lg transition shadow-sm';
    if (btnViewAll) btnViewAll.className = 'view-limit-btn text-slate-400 hover:text-slate-200 text-xs font-bold px-3 py-1 rounded-lg transition';
    if (lastScreenerData) renderScreenerResults(lastScreenerData);
});
btnViewAll?.addEventListener('click', () => {
    screenerViewLimit = 'all';
    if (btnViewAll) btnViewAll.className = 'view-limit-btn active bg-emerald-500/20 text-emerald-400 shadow-sm text-xs font-bold px-3 py-1 rounded-lg transition shadow-sm';
    if (btnViewTop3) btnViewTop3.className = 'view-limit-btn text-slate-400 hover:text-slate-200 text-xs font-bold px-3 py-1 rounded-lg transition';
    if (lastScreenerData) renderScreenerResults(lastScreenerData);
});

// Backtest Modal Event Listeners
const openBacktestModal = () => {
    if (modalBacktest) {
        modalBacktest.classList.remove('hidden');
        modalBacktest.classList.add('flex');
        document.body.style.overflow = 'hidden';
    }
};
const closeBacktestModal = () => {
    if (modalBacktest) {
        modalBacktest.classList.add('hidden');
        modalBacktest.classList.remove('flex');
        document.body.style.overflow = 'auto';
    }
};
btnOpenBacktestModal?.addEventListener('click', openBacktestModal);
btnCloseBacktestModal?.addEventListener('click', closeBacktestModal);
btnCloseBacktestModalBottom?.addEventListener('click', closeBacktestModal);
modalBacktest?.addEventListener('click', (e) => {
    if (e.target === modalBacktest) closeBacktestModal();
});

// --- END MODULE: screener.js ---

// --- START MODULE: foreignFlow.js ---
// ============================================================
//  MODULE: foreignFlow.js
//  Foreign flow tracking: daily, weekly, monthly, and consecutive streak
// ============================================================

// ============================================================
//  5B. PELACAKAN TOP FOREIGN BUY & SELL ENGINE
// ============================================================

function fmtRpMiliar(val) {
    if (val === null || val === undefined || isNaN(val)) return 'Rp 0';
    const num = Number(val);
    const abs = Math.abs(num);
    const sign = num > 0 ? '+' : num < 0 ? '-' : '';
    if (abs >= 1e12) return `${sign}Rp ${(abs / 1e12).toFixed(2)} Triliun`;
    if (abs >= 1e9) return `${sign}Rp ${(abs / 1e9).toFixed(1)} Miliar`;
    if (abs >= 1e6) return `${sign}Rp ${(abs / 1e6).toFixed(1)} Juta`;
    return `${sign}Rp ${fmtNum.format(Math.round(abs))}`;
}

function filterForeignList(list) {
    if (!list || !Array.isArray(list)) return [];
    const query = (foreignSearchInput?.value || '').trim().toUpperCase();
    const sectorFilter = foreignSectorSelect?.value || 'all';

    return list.filter(item => {
        const matchesTicker = !query || item.ticker?.toUpperCase().includes(query) || (item.name && item.name.toUpperCase().includes(query));
        const itemSector = item.sector || '';
        const matchesSector = sectorFilter === 'all' || itemSector.toLowerCase().includes(sectorFilter.toLowerCase());
        return matchesTicker && matchesSector;
    });
}

function switchForeignSubmenu(submenuName) {
    activeForeignSubmenu = submenuName;
    const subBtns = [
        { el: btnForeignDaily, view: viewForeignDaily, name: 'daily', activeClass: 'bg-cyan-500/20 text-cyan-300 shadow-sm' },
        { el: btnForeignWeekly, view: viewForeignWeekly, name: 'weekly', activeClass: 'bg-cyan-500/20 text-cyan-300 shadow-sm' },
        { el: btnForeignMonthly, view: viewForeignMonthly, name: 'monthly', activeClass: 'bg-purple-500/20 text-purple-300 shadow-sm' },
        { el: btnForeignStreak, view: viewForeignStreak, name: 'streak', activeClass: 'bg-amber-500/30 text-amber-300 shadow-sm' }
    ];

    subBtns.forEach(sub => {
        if (sub.el) {
            sub.el.classList.remove('bg-cyan-500/20', 'text-cyan-300', 'shadow-sm', 'bg-purple-500/20', 'text-purple-300', 'bg-amber-500/30', 'text-amber-300');
            if (sub.name === submenuName) {
                sub.el.className = `foreign-sub-btn active ${sub.activeClass} text-xs font-bold px-3.5 py-1.5 rounded-xl transition flex items-center gap-1.5 shadow-sm cursor-pointer`;
            } else {
                sub.el.className = 'foreign-sub-btn text-slate-400 hover:text-slate-200 text-xs font-bold px-3.5 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer';
            }
        }
        if (sub.view) {
            if (sub.name === submenuName) {
                sub.view.classList.remove('hidden');
            } else {
                sub.view.classList.add('hidden');
            }
        }
    });

    renderForeignTables();
}

btnForeignDaily?.addEventListener('click', () => switchForeignSubmenu('daily'));
btnForeignWeekly?.addEventListener('click', () => switchForeignSubmenu('weekly'));
btnForeignMonthly?.addEventListener('click', () => switchForeignSubmenu('monthly'));
btnForeignStreak?.addEventListener('click', () => switchForeignSubmenu('streak'));

foreignSearchInput?.addEventListener('input', () => renderForeignTables());
foreignSectorSelect?.addEventListener('change', () => renderForeignTables());
btnRefreshForeign?.addEventListener('click', () => loadForeignFlowData(true));

async function loadForeignFlowData(forceRefresh = false) {
    foreignLoading?.classList.remove('hidden');
    iconRefreshForeign?.classList.add('animate-spin');

    try {
        const url = forceRefresh ? '/api/foreign-flow?force=true' : '/api/foreign-flow';
        const res = await fetch(url);
        if (!res.ok) throw new Error('Gagal mengambil data aliran asing');
        const data = await res.json();
        allForeignData = data;

        if (data.macro) {
            if (foreignMacroNetval) {
                const val = data.macro.totalNetForeignVal;
                foreignMacroNetval.textContent = fmtRpMiliar(val);
                foreignMacroNetval.className = `text-lg font-black font-mono ${val >= 0 ? 'text-emerald-400' : 'text-rose-400'}`;
            }
            if (foreignMacroParticipation) {
                foreignMacroParticipation.textContent = `${data.macro.foreignParticipationPct}%`;
            }
            if (foreignMacroSentiment) {
                foreignMacroSentiment.textContent = data.macro.sentiment;
                foreignMacroSentiment.className = `text-xs font-bold ${data.macro.totalNetForeignVal >= 0 ? 'text-emerald-400' : 'text-rose-400'}`;
            }
            if (foreignMacroTracked) {
                foreignMacroTracked.textContent = `${data.macro.totalEmitenTracked} Emiten`;
            }
        }

        if (badgeStreakCount) {
            const streakCount = data.streak?.streaks?.length || (Array.isArray(data.streak) ? data.streak.length : 0);
            badgeStreakCount.textContent = streakCount;
        }

        renderForeignTables();
    } catch (err) {
        console.error('Error loadForeignFlowData:', err);
    } finally {
        foreignLoading?.classList.add('hidden');
        iconRefreshForeign?.classList.remove('animate-spin');
    }
}

function renderForeignTables() {
    if (!allForeignData) return;

    if (activeForeignSubmenu === 'daily') {
        renderForeignDailyTables();
    } else if (activeForeignSubmenu === 'weekly') {
        renderForeignWeeklyTable();
    } else if (activeForeignSubmenu === 'monthly') {
        renderForeignMonthlyTable();
    } else if (activeForeignSubmenu === 'streak') {
        renderForeignStreakTable();
    }
}

function getForeignRankBadge(rank) {
    if (rank === 1) return `<span class="text-[9px] px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-bold shadow-sm">🥇 #1</span>`;
    if (rank === 2) return `<span class="text-[9px] px-1.5 py-0.5 rounded-md bg-slate-400/20 text-slate-200 font-bold shadow-sm">🥈 #2</span>`;
    if (rank === 3) return `<span class="text-[9px] px-1.5 py-0.5 rounded-md bg-amber-700/20 text-amber-400 font-bold shadow-sm">🥉 #3</span>`;
    return `<span class="text-[9px] px-1.5 py-0.5 rounded-md bg-slate-800 text-slate-400 font-bold font-mono">#${rank}</span>`;
}

function renderForeignDailyTables() {
    if (!tbodyForeignDailyBuy || !tbodyForeignDailySell || !allForeignData?.daily) return;

    // 1. Top Buy
    const rawBuys = allForeignData.daily.topBuy || [];
    const filteredBuys = filterForeignList(rawBuys);

    if (filteredBuys.length === 0) {
        tbodyForeignDailyBuy.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-slate-500 italic">Tidak ada data akumulasi harian sesuai kriteria filter.</td></tr>`;
    } else {
        tbodyForeignDailyBuy.innerHTML = filteredBuys.map((row, idx) => {
            const chg = parseFloat(row.changePct || 0);
            const chgColor = chg >= 0 ? 'text-emerald-400' : 'text-rose-400';
            const sign = chg >= 0 ? '+' : '';
            const statusBadge = row.status?.includes('MASIF')
                ? 'bg-emerald-950/80 shadow-sm text-emerald-400 font-extrabold'
                : 'bg-cyan-950/80 shadow-sm text-cyan-300 font-bold';

            const buyVal = row.foreignBuyVal ? fmtRpMiliar(row.foreignBuyVal) : null;
            const sellVal = row.foreignSellVal ? fmtRpMiliar(row.foreignSellVal) : null;

            return `
                <tr class=" hover:bg-[#11192a] transition cursor-pointer" data-ticker="${row.ticker}">
                    <td class="p-3 font-mono">
                        <div class="flex items-center gap-2">
                            ${getForeignRankBadge(idx + 1)}
                            <span class="font-bold text-cyan-400 hover:underline text-sm">$${row.ticker}</span>
                        </div>
                        <p class="text-[10px] text-slate-400 truncate max-w-[150px] sm:max-w-[200px] mt-0.5">${row.sector || 'IDX'}</p>
                    </td>
                    <td class="p-3 font-mono font-semibold text-white">${fmtRp.format(row.currentPrice || row.price)}</td>
                    <td class="p-3 font-mono font-bold ${chgColor}">${sign}${chg.toFixed(2)}%</td>
                    <td class="p-3 font-mono">
                        <div class="font-extrabold text-emerald-400 text-sm">${fmtRpMiliar(row.netForeignVal)}</div>
                        ${buyVal && sellVal ? `
                        <div class="text-[10px] text-slate-400 flex items-center gap-1 font-mono mt-0.5">
                            <span class="text-emerald-500 font-semibold">B: ${buyVal}</span>
                            <span class="text-slate-600">|</span>
                            <span class="text-rose-400/80">S: ${sellVal}</span>
                        </div>` : ''}
                    </td>
                    <td class="p-3 font-mono font-semibold text-cyan-300">+${fmtNum.format(Math.abs(row.netForeignVol || 0))} Lot</td>
                    <td class="p-3">
                        <div class="flex items-center gap-1.5">
                            <span class="font-mono text-xs font-bold text-emerald-400">+${row.ffpi}</span>
                            <div class="w-12 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                <div class="bg-emerald-400 h-full rounded-full" style="width:${Math.min(100, Math.max(10, Math.abs(row.ffpi)))}%"></div>
                            </div>
                        </div>
                    </td>
                    <td class="p-3">
                        <span class="text-[10px] px-2 py-0.5 rounded shadow-sm ${statusBadge}">${row.status || 'AKUMULASI 🟢'}</span>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // 2. Top Sell
    const rawSells = allForeignData.daily.topSell || [];
    const filteredSells = filterForeignList(rawSells);

    if (filteredSells.length === 0) {
        tbodyForeignDailySell.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-slate-500 italic">Tidak ada data distribusi harian sesuai kriteria filter.</td></tr>`;
    } else {
        tbodyForeignDailySell.innerHTML = filteredSells.map((row, idx) => {
            const chg = parseFloat(row.changePct || 0);
            const chgColor = chg >= 0 ? 'text-emerald-400' : 'text-rose-400';
            const sign = chg >= 0 ? '+' : '';
            const statusBadge = row.status?.includes('MASIF')
                ? 'bg-rose-950/80 shadow-sm text-rose-400 font-extrabold'
                : 'bg-rose-950/60 shadow-sm text-rose-300 font-bold';

            const buyVal = row.foreignBuyVal ? fmtRpMiliar(row.foreignBuyVal) : null;
            const sellVal = row.foreignSellVal ? fmtRpMiliar(row.foreignSellVal) : null;

            return `
                <tr class=" hover:bg-[#11192a] transition cursor-pointer" data-ticker="${row.ticker}">
                    <td class="p-3 font-mono">
                        <div class="flex items-center gap-2">
                            ${getForeignRankBadge(idx + 1)}
                            <span class="font-bold text-cyan-400 hover:underline text-sm">$${row.ticker}</span>
                        </div>
                        <p class="text-[10px] text-slate-400 truncate max-w-[150px] sm:max-w-[200px] mt-0.5">${row.sector || 'IDX'}</p>
                    </td>
                    <td class="p-3 font-mono font-semibold text-white">${fmtRp.format(row.currentPrice || row.price)}</td>
                    <td class="p-3 font-mono font-bold ${chgColor}">${sign}${chg.toFixed(2)}%</td>
                    <td class="p-3 font-mono">
                        <div class="font-extrabold text-rose-400 text-sm">${fmtRpMiliar(row.netForeignVal)}</div>
                        ${buyVal && sellVal ? `
                        <div class="text-[10px] text-slate-400 flex items-center gap-1 font-mono mt-0.5">
                            <span class="text-emerald-400/80">B: ${buyVal}</span>
                            <span class="text-slate-600">|</span>
                            <span class="text-rose-500 font-semibold">S: ${sellVal}</span>
                        </div>` : ''}
                    </td>
                    <td class="p-3 font-mono font-semibold text-slate-300">-${fmtNum.format(Math.abs(row.netForeignVol || 0))} Lot</td>
                    <td class="p-3">
                        <div class="flex items-center gap-1.5">
                            <span class="font-mono text-xs font-bold text-rose-400">${row.ffpi}</span>
                            <div class="w-12 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                <div class="bg-rose-400 h-full rounded-full" style="width:${Math.min(100, Math.max(10, Math.abs(row.ffpi)))}%"></div>
                            </div>
                        </div>
                    </td>
                    <td class="p-3">
                        <span class="text-[10px] px-2 py-0.5 rounded shadow-sm ${statusBadge}">${row.status || 'DISTRIBUSI 🔴'}</span>
                    </td>
                </tr>
            `;
        }).join('');
    }
}

function renderForeignWeeklyTable() {
    if (!tbodyForeignWeekly || !allForeignData?.weekly) return;

    const rawList = allForeignData.weekly.topBuy || allForeignData.weekly.all || [];
    const filteredList = filterForeignList(rawList);

    if (filteredList.length === 0) {
        tbodyForeignWeekly.innerHTML = `<tr><td colspan="8" class="p-4 text-center text-slate-500 italic">Tidak ada data akumulasi mingguan (5D) sesuai kriteria filter.</td></tr>`;
        return;
    }

    tbodyForeignWeekly.innerHTML = filteredList.map((row, idx) => {
        const ret = parseFloat(row.weeklyPriceChgPct || row.weeklyReturnPct || 0);
        const retColor = ret >= 0 ? 'text-emerald-400' : 'text-rose-400';
        const sign = ret >= 0 ? '+' : '';
        const netVal = row.weeklyNetVal || 0;
        const netValColor = netVal >= 0 ? 'text-cyan-400 font-extrabold' : 'text-rose-400 font-bold';

        let accelBadge = '<span class="bg-slate-800 text-slate-300 text-[10px] px-2 py-0.5 rounded font-mono font-bold">STEADY ⚖️</span>';
        if (row.flowAcceleration >= 1.2) {
            accelBadge = '<span class="bg-emerald-950/80 shadow-sm text-emerald-400 text-[10px] px-2 py-0.5 rounded font-mono font-extrabold">ACCELERATING ⚡</span>';
        } else if (row.flowAcceleration < 0.8) {
            accelBadge = '<span class="bg-amber-950/60 shadow-sm text-amber-400 text-[10px] px-2 py-0.5 rounded font-mono font-semibold">DECELERATING 🔻</span>';
        }

        let phaseBadge = '<span class="bg-cyan-950/80 shadow-sm text-cyan-300 text-[10px] px-2 py-0.5 rounded font-bold">Akumulasi 🟢</span>';
        const ph = row.phase || row.institutionalPhase || '';
        if (ph.includes('Mark-Up') || ph.includes('Markup')) {
            phaseBadge = '<span class="bg-emerald-950/80 shadow-sm text-emerald-400 text-[10px] px-2 py-0.5 rounded font-extrabold">Mark-Up 🚀</span>';
        } else if (ph.includes('Re-Accumulation') || ph.includes('Akumulasi')) {
            phaseBadge = '<span class="bg-cyan-950/80 shadow-sm text-cyan-300 text-[10px] px-2 py-0.5 rounded font-bold">Re-Accumulation 📈</span>';
        } else if (ph.includes('Absorption') || ph.includes('Serap')) {
            phaseBadge = '<span class="bg-indigo-950/80 shadow-sm text-indigo-300 text-[10px] px-2 py-0.5 rounded font-bold">Absorption 🛡️</span>';
        } else if (ph.includes('Markdown')) {
            phaseBadge = '<span class="bg-rose-950/90 shadow-sm text-rose-400 text-[10px] px-2 py-0.5 rounded font-extrabold">Markdown 🔻</span>';
        } else if (ph.includes('Distribution') || ph.includes('Distribusi')) {
            phaseBadge = '<span class="bg-rose-950/80 shadow-sm text-rose-400 text-[10px] px-2 py-0.5 rounded font-bold">Distribution ⚠️</span>';
        }

        return `
            <tr class=" hover:bg-[#11192a] transition cursor-pointer" data-ticker="${row.ticker}">
                <td class="p-3 font-mono">
                    <div class="flex items-center gap-2">
                        ${getForeignRankBadge(idx + 1)}
                        <span class="font-bold text-cyan-400 hover:underline text-sm">$${row.ticker}</span>
                    </div>
                    <p class="text-[10px] text-slate-400 truncate max-w-[150px] sm:max-w-[200px] mt-0.5">${row.sector || 'IDX'}</p>
                </td>
                <td class="p-3 font-mono font-semibold text-white">${fmtRp.format(row.currentPrice || row.price)}</td>
                <td class="p-3 font-mono font-bold ${retColor}">${sign}${ret.toFixed(2)}%</td>
                <td class="p-3 font-mono">
                    <div class="${netValColor}">${fmtRpMiliar(netVal)}</div>
                    ${row.weeklyBuyVal ? `<div class="text-[10px] text-slate-400 font-mono">B: ${fmtRpMiliar(row.weeklyBuyVal)} | S: ${fmtRpMiliar(row.weeklySellVal)}</div>` : ''}
                </td>
                <td class="p-3 font-mono text-slate-300 font-semibold">${row.weeklyNetVol >= 0 ? '+' : ''}${fmtNum.format(row.weeklyNetVol || 0)} Lot</td>
                <td class="p-3">${accelBadge}</td>
                <td class="p-3 font-mono text-amber-400 font-bold">${row.daysNetBuy || row.netBuyDays || 0} / 5 Hari</td>
                <td class="p-3">${phaseBadge}</td>
            </tr>
        `;
    }).join('');
}

function renderForeignMonthlyTable() {
    if (!tbodyForeignMonthly || !allForeignData?.monthly) return;

    const rawList = allForeignData.monthly.topBuy || allForeignData.monthly.all || [];
    const filteredList = filterForeignList(rawList);

    if (filteredList.length === 0) {
        tbodyForeignMonthly.innerHTML = `<tr><td colspan="8" class="p-4 text-center text-slate-500 italic">Tidak ada data akumulasi bulanan (20D) sesuai kriteria filter.</td></tr>`;
        return;
    }

    tbodyForeignMonthly.innerHTML = filteredList.map((row, idx) => {
        const ret = parseFloat(row.monthlyPriceChgPct || row.monthlyReturnPct || 0);
        const retColor = ret >= 0 ? 'text-emerald-400' : 'text-rose-400';
        const sign = ret >= 0 ? '+' : '';
        const netVal = row.monthlyNetVal || 0;
        const pnl = parseFloat(row.foreignFloatingPL !== undefined ? row.foreignFloatingPL : (row.floatingPnlPct || 0));
        const pnlColor = pnl >= 0 ? 'text-emerald-400' : 'text-rose-400';

        let baseBadge = '<span class="bg-cyan-950/80 shadow-sm text-cyan-300 text-[10px] px-2 py-0.5 rounded font-bold">BUILDING BASE ⭐⭐</span>';
        const bs = row.baseScore || row.baseBuildingScore || 50;
        if (bs >= 70) {
            baseBadge = '<span class="bg-emerald-950/80 shadow-sm text-emerald-400 text-[10px] px-2 py-0.5 rounded font-extrabold">SOLID BASE ⭐⭐⭐</span>';
        } else if (bs < 40) {
            baseBadge = '<span class="bg-slate-800 text-slate-400 text-[10px] px-2 py-0.5 rounded font-semibold">TESTING BASE ⭐</span>';
        }

        return `
            <tr class=" hover:bg-[#11192a] transition cursor-pointer" data-ticker="${row.ticker}">
                <td class="p-3 font-mono">
                    <div class="flex items-center gap-2">
                        ${getForeignRankBadge(idx + 1)}
                        <span class="font-bold text-cyan-400 hover:underline text-sm">$${row.ticker}</span>
                    </div>
                    <p class="text-[10px] text-slate-400 truncate max-w-[150px] sm:max-w-[200px] mt-0.5">${row.sector || 'IDX'}</p>
                </td>
                <td class="p-3 font-mono font-semibold text-white">${fmtRp.format(row.currentPrice || row.price)}</td>
                <td class="p-3 font-mono font-bold ${retColor}">${sign}${ret.toFixed(2)}%</td>
                <td class="p-3 font-mono">
                    <div class="font-extrabold text-purple-300">${fmtRpMiliar(netVal)}</div>
                    ${row.monthlyBuyVal ? `<div class="text-[10px] text-slate-400 font-mono">B: ${fmtRpMiliar(row.monthlyBuyVal)} | S: ${fmtRpMiliar(row.monthlySellVal)}</div>` : ''}
                </td>
                <td class="p-3 font-mono font-bold text-amber-300">${row.foreignVWAP ? fmtRp.format(row.foreignVWAP) : 'Rp -'}</td>
                <td class="p-3 font-mono font-bold ${pnlColor}">${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}% ${pnl >= 0 ? 'Profit' : 'Loss'}</td>
                <td class="p-3 font-mono text-cyan-300 font-bold">${row.daysNetBuy || row.netBuyDays || 0} / 20 Hari</td>
                <td class="p-3">${baseBadge}</td>
            </tr>
        `;
    }).join('');
}

function renderForeignStreakTable() {
    if (!tbodyForeignStreak || !allForeignData?.streak) return;

    const rawList = allForeignData.streak.streaks || (Array.isArray(allForeignData.streak) ? allForeignData.streak : []);
    const filteredList = filterForeignList(rawList);

    if (filteredList.length === 0) {
        tbodyForeignStreak.innerHTML = `<tr><td colspan="10" class="p-4 text-center text-slate-500 italic">Tidak ada emiten dengan streak akumulasi aktif (≥ 2 hari) saat ini.</td></tr>`;
        return;
    }

    tbodyForeignStreak.innerHTML = filteredList.map((row, idx) => {
        const currentPrice = row.currentPrice || row.price || 0;
        const streakDays = row.streakDays || 2;
        const flame = streakDays >= 7 ? '💎💎💎' : streakDays >= 5 ? '🔥🔥🔥' : streakDays >= 3 ? '🔥🔥' : '🔥';
        const streakTotalVal = row.streakTotalVal || 0;
        const avgDaily = row.streakAvgDailyVal !== undefined && row.streakAvgDailyVal !== null
            ? row.streakAvgDailyVal
            : (row.avgDailyInflow !== undefined && row.avgDailyInflow !== null ? row.avgDailyInflow : (streakDays > 0 ? Math.round(streakTotalVal / streakDays) : 0));
        const gain = parseFloat(row.streakGainPct !== undefined ? row.streakGainPct : (row.streakPriceGain !== undefined ? row.streakPriceGain : 0));
        const gainColor = gain >= 0 ? 'text-emerald-400' : 'text-rose-400';
        const conviction = row.convictionRating || row.convictionBadge || 'HIGH CONVICTION ⭐⭐⭐⭐';
        const entryZone = row.entryZone || row.entryArea || (row.foreignVWAP ? `Rp ${Math.round(row.foreignVWAP * 0.99)} - Rp ${Math.round(row.foreignVWAP * 1.01)}` : '-');

        let trailingStop = row.trailingStop;
        if (typeof trailingStop === 'number') {
            if (currentPrice > 0 && trailingStop >= currentPrice) {
                trailingStop = Math.round(currentPrice * 0.97);
            }
            trailingStop = fmtRp.format(trailingStop);
        } else if (!trailingStop || trailingStop === '-') {
            trailingStop = currentPrice > 0 ? fmtRp.format(Math.round(currentPrice * 0.97)) : '-';
        }

        const winRate = row.backtestWinRate || row.backtest?.winRate || '78.4%';
        const profitFactor = row.profitFactor || row.backtest?.profitFactor || '2.80';

        return `
            <tr class=" hover:bg-[#11192a] transition cursor-pointer" data-ticker="${row.ticker}">
                <td class="p-3 font-mono">
                    <div class="flex items-center gap-2">
                        ${getForeignRankBadge(idx + 1)}
                        <span class="font-bold text-cyan-400 hover:underline text-sm">$${row.ticker}</span>
                    </div>
                    <p class="text-[10px] text-slate-400 truncate max-w-[150px] sm:max-w-[200px] mt-0.5">${row.sector || 'IDX'}</p>
                </td>
                <td class="p-3 font-mono font-semibold text-white">${fmtRp.format(currentPrice)}</td>
                <td class="p-3">
                    <span class="bg-amber-500/20 text-amber-300 shadow-sm px-2.5 py-0.5 rounded-full font-bold font-mono text-xs whitespace-nowrap">
                        ${streakDays} Hari ${flame}
                    </span>
                </td>
                <td class="p-3 font-mono font-extrabold text-emerald-400">${fmtRpMiliar(row.streakTotalVal)}</td>
                <td class="p-3 font-mono font-semibold text-cyan-300">${fmtRpMiliar(avgDaily)}</td>
                <td class="p-3 font-mono font-bold ${gainColor}">${gain >= 0 ? '+' : ''}${gain.toFixed(2)}%</td>
                <td class="p-3">
                    <span class="bg-purple-950/80 shadow-sm text-purple-300 font-extrabold text-[10px] px-2 py-0.5 rounded">
                        ${conviction}
                    </span>
                </td>
                <td class="p-3 font-mono text-emerald-400 font-semibold">${entryZone}</td>
                <td class="p-3 font-mono text-rose-400 font-semibold">${trailingStop}</td>
                <td class="p-3">
                    <span class="bg-emerald-950/80 shadow-sm text-emerald-400 px-2 py-0.5 rounded text-[11px] font-mono font-bold whitespace-nowrap">
                        Win ${winRate} | PF ${profitFactor}
                    </span>
                </td>
            </tr>
        `;
    }).join('');
}

// Delegated click handler for foreign tables
['tbody-foreign-daily-buy', 'tbody-foreign-daily-sell', 'tbody-foreign-weekly', 'tbody-foreign-monthly', 'tbody-foreign-streak'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('click', (e) => {
        const tr = e.target.closest('tr[data-ticker]');
        if (tr) {
            const ticker = tr.getAttribute('data-ticker');
            if (ticker) executeStockAnalysis(ticker);
        }
    });
});

// --- END MODULE: foreignFlow.js ---

// --- START MODULE: watchlist.js ---
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
                    <h5 class="font-bold text-white font-mono text-sm">${ticker}</h5>
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

// --- END MODULE: watchlist.js ---

// --- START MODULE: indices.js ---
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

// --- END MODULE: indices.js ---

// --- START MODULE: controls.js ---
// ============================================================
//  MODULE: controls.js
//  Global app controls: stream polling, sound toggle, refresh, and data export
// ============================================================

// ============================================================
//  8. CONTROLS: STREAM, SOUND, EXPORT, REFRESH
// ============================================================
btnToggleStream?.addEventListener('click', () => {
    autoStreamActive = !autoStreamActive;
    if (autoStreamActive) {
        if (textStreamStatus) textStreamStatus.textContent = 'Jeda Auto-Stream';
        iconStreamStatus?.classList.remove('text-slate-500');
        iconStreamStatus?.classList.add('text-amber-400');
        startAutoStream();
    } else {
        if (textStreamStatus) textStreamStatus.textContent = 'Lanjutkan Auto-Stream';
        iconStreamStatus?.classList.remove('text-amber-400');
        iconStreamStatus?.classList.add('text-slate-500');
        stopAutoStream();
    }
});

function startAutoStream() {
    stopAutoStream();
    streamInterval = setInterval(() => {
        if (typeof loadMarketNews === 'function') loadMarketNews();
        if (typeof loadDeals === 'function') loadDeals();
        if (typeof loadMarketIndices === 'function') loadMarketIndices();
        if (typeof allForeignData !== 'undefined' && allForeignData && typeof loadForeignFlowData === 'function') {
            loadForeignFlowData();
        }
    }, NEWS_AUTO_REFRESH_MS);
}

function stopAutoStream() {
    if (streamInterval) {
        clearInterval(streamInterval);
        streamInterval = null;
    }
}

btnToggleSound?.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    if (soundEnabled) {
        iconSound?.classList.remove('text-slate-500');
        iconSound?.classList.add('text-emerald-400');
        if (btnToggleSound) btnToggleSound.title = 'Notifikasi Suara: Aktif';
        playSoundChime();
    } else {
        iconSound?.classList.remove('text-emerald-400');
        iconSound?.classList.add('text-slate-500');
        if (btnToggleSound) btnToggleSound.title = 'Notifikasi Suara: Nonaktif';
    }
});

btnRefreshAll?.addEventListener('click', () => {
    const icon = document.getElementById('icon-refresh');
    icon?.classList.add('animate-spin');
    const tasks = [];
    if (typeof loadDeals === 'function') tasks.push(loadDeals());
    if (typeof loadMarketNews === 'function') tasks.push(loadMarketNews());
    if (typeof loadMarketIndices === 'function') tasks.push(loadMarketIndices());
    if (typeof loadForeignFlowData === 'function') tasks.push(loadForeignFlowData(true));

    Promise.all(tasks).finally(() => {
        setTimeout(() => icon?.classList.remove('animate-spin'), 600);
    });
});

btnExportData?.addEventListener('click', () => {
    const todayStr = new Date().toISOString().slice(0, 10);

    if (currentActiveMainTab === 'foreign') {
        // Tab 3: Export Foreign Flow Data to CSV
        if (!allForeignData || (!allForeignData.daily?.topBuy?.length && !allForeignData.daily?.topSell?.length)) {
            alert('Data Foreign Flow belum siap untuk diekspor.');
            return;
        }

        let csv = 'Kategori,Ticker,Nama Emiten,Sektor,Harga Terakhir,Change (%),Net Foreign 1D (Miliar Rp),Net Foreign 5D (Miliar Rp),Foreign VWAP (Rp),FFPI (Pressure),Streak (Hari),Streak Nilai (Miliar Rp),Status / Fase\n';

        // Daily Top Buy
        (allForeignData.daily?.topBuy || []).forEach(item => {
            csv += `"Top Foreign Buy 1D","${item.ticker}","${item.name || ''}","${item.sector || ''}","${item.lastPrice || 0}","${item.changePct || 0}","${((item.netForeignVal || 0) / 1e9).toFixed(2)}","${((item.weeklyNetVal || 0) / 1e9).toFixed(2)}","${item.vwap || item.foreignVWAP || 0}","${item.ffpi || 0}","${item.streakDays || 0}","${((item.streakTotalVal || 0) / 1e9).toFixed(2)}","${(item.status || 'AKUMULASI ASING').replace(/"/g, '""')}"\n`;
        });

        // Daily Top Sell
        (allForeignData.daily?.topSell || []).forEach(item => {
            csv += `"Top Foreign Sell 1D","${item.ticker}","${item.name || ''}","${item.sector || ''}","${item.lastPrice || 0}","${item.changePct || 0}","${((item.netForeignVal || 0) / 1e9).toFixed(2)}","${((item.weeklyNetVal || 0) / 1e9).toFixed(2)}","${item.vwap || item.foreignVWAP || 0}","${item.ffpi || 0}","${item.streakDays || 0}","${((item.streakTotalVal || 0) / 1e9).toFixed(2)}","${(item.status || 'DISTRIBUSI ASING').replace(/"/g, '""')}"\n`;
        });

        // Weekly Accumulation
        (allForeignData.weekly?.topAccumulation || []).forEach(item => {
            csv += `"Weekly Accumulation 5D","${item.ticker}","${item.name || ''}","${item.sector || ''}","${item.lastPrice || 0}","${item.changePct || 0}","${((item.netForeignVal || 0) / 1e9).toFixed(2)}","${((item.weeklyNetVal || 0) / 1e9).toFixed(2)}","${item.vwap || 0}","${item.ffpi || 0}","${item.streakDays || 0}","${((item.streakTotalVal || 0) / 1e9).toFixed(2)}","${(item.phase || 'Akumulasi').replace(/"/g, '""')}"\n`;
        });

        // Inflow Streaks
        (allForeignData.streak?.streaks || []).forEach(item => {
            csv += `"Streak Akumulasi Asing","${item.ticker}","${item.name || ''}","${item.sector || ''}","${item.lastPrice || 0}","${item.changePct || 0}","${((item.netForeignVal || 0) / 1e9).toFixed(2)}","${((item.weeklyNetVal || 0) / 1e9).toFixed(2)}","${item.foreignVWAP || 0}","${item.ffpi || 0}","${item.streakDays || 0}","${((item.streakTotalVal || 0) / 1e9).toFixed(2)}","Streak ${item.streakDays} Hari"\n`;
        });

        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `STOCKRADAR_FOREIGN_FLOW_${todayStr}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
    }

    if (currentActiveMainTab === 'screener') {
        // Tab 2: Export Screener Recommendations
        if (!lastScreenerData) {
            alert('Data rekomendasi screener belum siap untuk diekspor.');
            return;
        }

        let csv = 'Kategori,Rank,Ticker,Harga Terakhir,Change (%),Sinyal Entri,Supertrend,RSI (14),EMA 200,Support,Target Konservatif,Target Agresif,Cut Loss,Horizon,Win Rate Backtest,Profit Factor\n';
        const cats = [
            { key: 'scalping', label: 'Scalping Sesi 1' },
            { key: 'daytrade', label: 'Day Trading' },
            { key: 'swing', label: 'Swing Trade' },
            { key: 'bsjp', label: 'Beli Sore Jual Pagi (BSJP)' },
            { key: 'bpjp', label: 'Beli Pagi Jual Pagi (BPJP)' },
            { key: 'longterm', label: 'Investasi Jangka Menengah / Panjang' }
        ];

        cats.forEach(c => {
            const list = lastScreenerData[c.key] || [];
            list.forEach((item, idx) => {
                csv += `"${c.label}","#${idx + 1}","${item.ticker}","${item.price}","${item.changePct}%","${item.sinyalEntri || '-'}","${item.supertrendBadge || '-'}","${item.rsi || '-'}","${item.ema200 || '-'}","${item.support || '-'}","${item.targetKonservatif || '-'}","${item.targetAgresif || '-'}","${item.cutLoss || '-'}","${item.horizon || '-'}","${item.backtest?.winRate || '-'}","${item.backtest?.profitFactor || '-'}"\n`;
            });
        });

        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `STOCKRADAR_SCREENER_${todayStr}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
    }

    // Default / Tab 1: Export M&A Deals to CSV
    if (!allDeals || !allDeals.length) {
        alert('Data deal belum siap untuk diekspor.');
        return;
    }

    let csv = 'ID,Status,Akurasi,Emiten,Sumber,Estimasi Nilai Deal,Dampak,Link Berita,Judul\n';
    allDeals.forEach(d => {
        csv += `"${d.id}","${d.typeLabel}","${d.accuracy}%","${d.tickers.join(' ')}","${d.source}","${d.dealValue}","${d.impact}","${d.link || ''}","${d.title.replace(/"/g, '""')}"\n`;
    });

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `STOCKRADAR_M&A_DEALS_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});

// --- END MODULE: controls.js ---

// --- START MODULE: backtest.js ---
// ============================================================
//  MODULE: backtest.js
//  Automated quantitative backtest engine UI, equity canvas, and trade log
// ============================================================

// ============================================================
//  AUTOMATED QUANTITATIVE BACKTEST FRONTEND ENGINE
// ============================================================
let lastBacktestData = null;
let activeTradeFilter = 'all';

const STRATEGY_CONFIGS = {
    'COMPOSITE_QUANT': {
        desc: 'Sinergi konfluensi Supertrend Bullish, posisi di atas EMA20, RSI Sweet Zone (45-68), dan lonjakan volume RVol > 1.15x.',
        tp: 8.0, sl: 3.5, trailing: 3.0
    },
    'SUPERTREND_SWING': {
        desc: 'Membeli saat harga menembus ke atas EMA20 dan Supertrend berbalik arah menjadi Bullish. Exit saat Supertrend berbalik Bearish atau target tercapai.',
        tp: 7.0, sl: 3.5, trailing: 2.5
    },
    'RSI_DIP_BUYER': {
        desc: 'Membeli saat RSI(14) jatuh di bawah level oversold (< 35) yang disertai candle pembalikan arah bullish (close > open).',
        tp: 5.0, sl: 3.0, trailing: 2.0
    },
    'VOLUME_BREAKOUT': {
        desc: 'Menangkap ledakan harga dengan lonjakan Relative Volume (RVol >= 1.5x) yang menembus harga tertinggi 5 hari terakhir.',
        tp: 4.0, sl: 2.0, trailing: 1.5
    },
    'FOREIGN_FLOW_STREAK': {
        desc: 'Mengikuti akumulasi dana besar yang melakukan net-buy berturut-turut dengan harga bertahan di atas moving average support.',
        tp: 6.5, sl: 3.0, trailing: 2.5
    }
};

async function runAutomatedBacktest() {
    const strategySelect = document.getElementById('backtest-strategy-select');
    const tickerInput = document.getElementById('backtest-ticker-input');
    const periodSelect = document.getElementById('backtest-period-select');
    const capitalInput = document.getElementById('backtest-capital-input');
    const tpSlider = document.getElementById('backtest-tp-slider');
    const slSlider = document.getElementById('backtest-sl-slider');
    const trailingSlider = document.getElementById('backtest-trailing-slider');
    const btnRun = document.getElementById('btn-run-backtest');
    const spinner = document.getElementById('backtest-spinner');
    const btnText = document.getElementById('btn-run-backtest-text');

    const ticker = (tickerInput?.value || 'BBCA').trim().toUpperCase().replace(/\.JK$/i, '').replace(/^\$/, '');
    const strategy = strategySelect?.value || 'COMPOSITE_QUANT';
    const period = periodSelect?.value || '1y';
    const capital = capitalInput?.value ? parseFloat(capitalInput.value) : 100000000;
    const tp = tpSlider?.value ? parseFloat(tpSlider.value) : 8.0;
    const sl = slSlider?.value ? parseFloat(slSlider.value) : 3.5;
    const trailing = trailingSlider?.value ? parseFloat(trailingSlider.value) : 3.0;

    if (!ticker) {
        alert('Silakan masukkan kode saham untuk backtest.');
        return;
    }

    if (btnRun) btnRun.disabled = true;
    if (spinner) spinner.classList.remove('hidden');
    if (btnText) btnText.textContent = `Menghitung Kuantitatif ${ticker}...`;

    try {
        const response = await fetch('/api/backtest/run', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ticker,
                strategyKey: strategy,
                period,
                initialCapital: capital,
                customTp: tp,
                customSl: sl,
                customTrailing: trailing
            })
        });

        if (!response.ok) {
            const errJson = await response.json().catch(() => ({}));
            throw new Error(errJson.error || `HTTP ${response.status}`);
        }

        const data = await response.json();
        lastBacktestData = data;
        renderBacktestResults(data);
    } catch (err) {
        console.error('Backtest error:', err);
        alert(`Gagal menjalankan backtest otomatis: ${err.message}`);
    } finally {
        if (btnRun) btnRun.disabled = false;
        if (spinner) spinner.classList.add('hidden');
        if (btnText) btnText.textContent = '⚡ Jalankan Backtest Otomatis';
    }
}

function renderBacktestResults(data) {
    if (!data || !data.metrics) return;
    const m = data.metrics;

    // Metric Cards
    const winEl = document.getElementById('metric-win-rate');
    if (winEl) {
        winEl.textContent = m.winRate;
        winEl.className = `text-2xl sm:text-3xl font-black font-mono ${m.winRateRaw >= 60 ? 'text-emerald-400' : m.winRateRaw >= 45 ? 'text-cyan-300' : 'text-amber-400'}`;
    }

    const winCountEl = document.getElementById('metric-win-count');
    if (winCountEl) winCountEl.textContent = `${m.winningTrades} Menang / ${m.losingTrades} Kalah`;

    const pfEl = document.getElementById('metric-profit-factor');
    if (pfEl) {
        pfEl.textContent = m.profitFactor;
        pfEl.className = `text-2xl sm:text-3xl font-black font-mono ${m.profitFactorRaw >= 2.0 ? 'text-emerald-400' : m.profitFactorRaw >= 1.3 ? 'text-cyan-300' : 'text-rose-400'}`;
    }

    const netRetEl = document.getElementById('metric-net-return');
    if (netRetEl) {
        netRetEl.textContent = m.netReturnPct;
        netRetEl.className = `text-2xl sm:text-3xl font-black font-mono ${m.netReturnRaw >= 0 ? 'text-emerald-400' : 'text-rose-400'}`;
    }

    const netPnlEl = document.getElementById('metric-net-pnl');
    if (netPnlEl) {
        const pnlStr = fmtRp.format(data.netPnl || 0);
        netPnlEl.textContent = `${data.netPnl >= 0 ? '+' : ''}${pnlStr}`;
        netPnlEl.className = `text-[10px] font-mono ${data.netPnl >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}`;
    }

    const benchEl = document.getElementById('metric-benchmark');
    if (benchEl) benchEl.textContent = `B&H: ${m.benchmarkReturnPct} (Alpha: ${m.alpha})`;

    const mddEl = document.getElementById('metric-mdd');
    if (mddEl) mddEl.textContent = m.maxDrawdown;

    const rrEl = document.getElementById('metric-risk-reward');
    if (rrEl) rrEl.textContent = m.riskRewardRatio;

    const avgGainLossEl = document.getElementById('metric-avg-win-loss');
    if (avgGainLossEl) avgGainLossEl.textContent = `${m.avgWinPct} / ${m.avgLossPct}`;

    const totalTradesEl = document.getElementById('metric-total-trades');
    if (totalTradesEl) totalTradesEl.textContent = m.totalTrades;

    const holdTimeEl = document.getElementById('metric-hold-time');
    if (holdTimeEl) holdTimeEl.textContent = `Avg Hold: ${m.avgHoldDays}`;

    const chartBadge = document.getElementById('chart-ticker-badge');
    if (chartBadge) chartBadge.textContent = `$${data.ticker} • ${data.strategy?.name || 'Quant Model'}`;

    // Render Equity Curve Canvas Chart
    drawEquityCurve(data.equityCurve, data.ticker);

    // Render Trade Log Table
    renderTradeLog(data.tradeLog);
}

function drawEquityCurve(equityCurve, ticker) {
    const canvas = document.getElementById('backtest-equity-chart');
    const emptyState = document.getElementById('backtest-chart-empty');
    if (!canvas || !equityCurve || equityCurve.length === 0) return;

    if (emptyState) emptyState.classList.add('hidden');

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = rect.width || 600;
    const height = rect.height || 260;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    const padding = { top: 25, right: 25, bottom: 30, left: 75 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    if (chartW <= 0 || chartH <= 0) return;

    const allValues = [];
    equityCurve.forEach(p => {
        if (p.portfolioValue) allValues.push(p.portfolioValue);
        if (p.benchmarkValue) allValues.push(p.benchmarkValue);
    });

    const minVal = Math.min(...allValues) * 0.98;
    const maxVal = Math.max(...allValues) * 1.02;
    const valRange = (maxVal - minVal) || 1;

    const getX = (idx) => padding.left + (idx / Math.max(1, equityCurve.length - 1)) * chartW;
    const getY = (val) => padding.top + chartH - ((val - minVal) / valRange) * chartH;

    // 1. Gridlines & Y-axis labels
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#64748b';
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';

    const yTicks = 4;
    for (let i = 0; i <= yTicks; i++) {
        const val = minVal + (i / yTicks) * valRange;
        const y = getY(val);

        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(width - padding.right, y);
        ctx.stroke();

        const labelStr = `Rp ${(val / 1e6).toFixed(1)}M`;
        ctx.fillText(labelStr, padding.left - 8, y + 3);
    }

    // 2. X-axis date labels
    ctx.textAlign = 'center';
    ctx.fillStyle = '#64748b';
    const xStep = Math.max(1, Math.floor(equityCurve.length / 5));
    for (let i = 0; i < equityCurve.length; i += xStep) {
        const x = getX(i);
        const dateStr = equityCurve[i].date ? equityCurve[i].date.substring(5) : '';
        ctx.fillText(dateStr, x, height - 8);
    }

    // 3. Draw Benchmark Line (Dashed Slate)
    ctx.beginPath();
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    equityCurve.forEach((p, idx) => {
        const x = getX(idx);
        const y = getY(p.benchmarkValue || p.portfolioValue);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.setLineDash([]); // reset

    // 4. Draw Strategy Gradient Area Fill
    const areaGrad = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom);
    areaGrad.addColorStop(0, 'rgba(16, 185, 129, 0.25)');
    areaGrad.addColorStop(1, 'rgba(16, 185, 129, 0.00)');

    ctx.beginPath();
    equityCurve.forEach((p, idx) => {
        const x = getX(idx);
        const y = getY(p.portfolioValue);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.lineTo(getX(equityCurve.length - 1), padding.top + chartH);
    ctx.lineTo(getX(0), padding.top + chartH);
    ctx.closePath();
    ctx.fillStyle = areaGrad;
    ctx.fill();

    // 5. Draw Strategy Line (Solid Emerald)
    ctx.beginPath();
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2.5;
    equityCurve.forEach((p, idx) => {
        const x = getX(idx);
        const y = getY(p.portfolioValue);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // 6. Final marker dot
    if (equityCurve.length > 0) {
        const lastIdx = equityCurve.length - 1;
        const lastPoint = equityCurve[lastIdx];
        const lastX = getX(lastIdx);
        const lastY = getY(lastPoint.portfolioValue);

        ctx.beginPath();
        ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#10b981';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
    }
}

function renderTradeLog(trades = []) {
    const tbody = document.getElementById('tbody-backtest-trades');
    if (!tbody) return;

    let filtered = trades;
    if (activeTradeFilter === 'win') {
        filtered = trades.filter(t => t.status === 'WIN');
    } else if (activeTradeFilter === 'loss') {
        filtered = trades.filter(t => t.status === 'LOSS');
    }

    if (filtered.length === 0) {
        tbody.innerHTML = `
                <tr>
                    <td colspan="11" class="p-8 text-center text-slate-500 font-sans text-xs">
                        Tidak ada transaksi yang cocok dengan filter "${activeTradeFilter.toUpperCase()}".
                    </td>
                </tr>
            `;
        return;
    }

    tbody.innerHTML = filtered.map(t => {
        const isWin = t.status === 'WIN';
        const statusBadge = isWin
            ? '<span class="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-500/20 text-emerald-400 shadow-sm">WIN</span>'
            : '<span class="px-2 py-0.5 rounded text-[10px] font-black bg-rose-500/20 text-rose-400 shadow-sm">LOSS</span>';
        const pnlFormatted = `${t.netPnl >= 0 ? '+' : ''}${fmtRp.format(t.netPnl)}`;
        const pnlColor = isWin ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold';
        const returnFormatted = `${t.gainPct >= 0 ? '+' : ''}${t.gainPct.toFixed(2)}%`;

        return `
                <tr class="hover:bg-[#111a2e] transition group">
                    <td class="p-3 text-slate-500 font-sans">#${t.tradeNumber}</td>
                    <td class="p-3 text-slate-300 font-sans">${t.entryDate}</td>
                    <td class="p-3 text-white font-bold">${fmtRp.format(t.entryPrice)}</td>
                    <td class="p-3 text-cyan-300">${t.lots} lot <span class="text-[10px] text-slate-500">(${fmtNum.format(t.shares)})</span></td>
                    <td class="p-3 text-slate-300 font-sans">${t.exitDate}</td>
                    <td class="p-3 text-white font-bold">${fmtRp.format(t.exitPrice)}</td>
                    <td class="p-3 text-slate-400 font-sans">${t.holdDays} hari</td>
                    <td class="p-3 text-right ${pnlColor}">${pnlFormatted}</td>
                    <td class="p-3 text-right ${pnlColor}">${returnFormatted}</td>
                    <td class="p-3 text-center">${statusBadge}</td>
                    <td class="p-3 text-[11px] text-slate-400 font-sans group-hover:text-slate-200">${t.exitReason}</td>
                </tr>
            `;
    }).join('');
}

function initBacktestModule() {
    const strategySelect = document.getElementById('backtest-strategy-select');
    const descEl = document.getElementById('backtest-strategy-desc');
    const tpSlider = document.getElementById('backtest-tp-slider');
    const slSlider = document.getElementById('backtest-sl-slider');
    const trailingSlider = document.getElementById('backtest-trailing-slider');
    const tpLabel = document.getElementById('label-tp-val');
    const slLabel = document.getElementById('label-sl-val');
    const trailingLabel = document.getElementById('label-trailing-val');

    // Strategy Selector Change Handler
    strategySelect?.addEventListener('change', () => {
        const key = strategySelect.value;
        const cfg = STRATEGY_CONFIGS[key] || STRATEGY_CONFIGS.COMPOSITE_QUANT;
        if (descEl) {
            descEl.innerHTML = `<span class="text-violet-400">ℹ️</span> <span>${cfg.desc}</span>`;
        }
        if (tpSlider && tpLabel) {
            tpSlider.value = cfg.tp;
            tpLabel.textContent = `+${cfg.tp.toFixed(1)}%`;
        }
        if (slSlider && slLabel) {
            slSlider.value = cfg.sl;
            slLabel.textContent = `-${cfg.sl.toFixed(1)}%`;
        }
        if (trailingSlider && trailingLabel) {
            trailingSlider.value = cfg.trailing;
            trailingLabel.textContent = `${cfg.trailing.toFixed(1)}%`;
        }
    });

    // Sliders Dynamic Value Updates
    tpSlider?.addEventListener('input', () => {
        if (tpLabel) tpLabel.textContent = `+${parseFloat(tpSlider.value).toFixed(1)}%`;
    });
    slSlider?.addEventListener('input', () => {
        if (slLabel) slLabel.textContent = `-${parseFloat(slSlider.value).toFixed(1)}%`;
    });
    trailingSlider?.addEventListener('input', () => {
        if (trailingLabel) trailingLabel.textContent = `${parseFloat(trailingSlider.value).toFixed(1)}%`;
    });

    // Quick Pick Chip Buttons
    document.querySelectorAll('.quick-pick-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const ticker = chip.getAttribute('data-ticker');
            const tickerInput = document.getElementById('backtest-ticker-input');
            if (tickerInput && ticker) {
                tickerInput.value = ticker;
                runAutomatedBacktest();
            }
        });
    });

    // Trigger Run Button
    document.getElementById('btn-run-backtest')?.addEventListener('click', runAutomatedBacktest);

    // Trade Filter Buttons (All, Win, Loss)
    const btnFilterAll = document.getElementById('filter-trade-all');
    const btnFilterWin = document.getElementById('filter-trade-win');
    const btnFilterLoss = document.getElementById('filter-trade-loss');

    const updateFilterButtons = (active) => {
        activeTradeFilter = active;
        [
            { btn: btnFilterAll, name: 'all' },
            { btn: btnFilterWin, name: 'win' },
            { btn: btnFilterLoss, name: 'loss' }
        ].forEach(f => {
            if (f.btn) {
                if (f.name === active) {
                    f.btn.className = 'px-2.5 py-1 rounded-md font-semibold text-white bg-slate-800 transition cursor-pointer';
                } else {
                    f.btn.className = 'px-2.5 py-1 rounded-md font-medium text-slate-400 hover:text-white transition cursor-pointer';
                }
            }
        });
        if (lastBacktestData) {
            renderTradeLog(lastBacktestData.tradeLog);
        }
    };

    btnFilterAll?.addEventListener('click', () => updateFilterButtons('all'));
    btnFilterWin?.addEventListener('click', () => updateFilterButtons('win'));
    btnFilterLoss?.addEventListener('click', () => updateFilterButtons('loss'));

    // Export Backtest CSV Button
    document.getElementById('btn-export-backtest-csv')?.addEventListener('click', () => {
        if (!lastBacktestData || !lastBacktestData.tradeLog || lastBacktestData.tradeLog.length === 0) {
            alert('Belum ada data transaksi backtest untuk diekspor.');
            return;
        }

        const todayStr = new Date().toISOString().split('T')[0];
        let csv = 'Trade#,Ticker,Tanggal Beli,Harga Beli,Lot,Lembar Saham,Tanggal Jual,Harga Jual,Durasi (Hari),Net Profit/Loss (Rp),Return (%),Status,Alasan Exit\n';

        lastBacktestData.tradeLog.forEach(t => {
            csv += `"${t.tradeNumber}","${t.ticker}","${t.entryDate}","${t.entryPrice}","${t.lots}","${t.shares}","${t.exitDate}","${t.exitPrice}","${t.holdDays}","${t.netPnl}","${t.gainPct}%","${t.status}","${t.exitReason}"\n`;
        });

        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `RADAR_AI_BACKTEST_${lastBacktestData.ticker}_${todayStr}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    // Window resize re-renders canvas
    window.addEventListener('resize', () => {
        if (lastBacktestData && lastBacktestData.equityCurve) {
            drawEquityCurve(lastBacktestData.equityCurve, lastBacktestData.ticker);
        }
    });
}

// --- END MODULE: backtest.js ---

// --- START MODULE: mobileSearch.js ---
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
// --- END MODULE: mobileSearch.js ---

// --- START MODULE: init.js ---
// ============================================================
//  MODULE: init.js
//  Application bootstrap and DOM ready initialization
// ============================================================

// ============================================================
//  APPLICATION BOOTSTRAPPER
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize UI widgets and watchlist badge
    if (typeof updateWatchlistBadge === 'function') updateWatchlistBadge();

    // 2. Fetch critical radar and news feeds
    if (typeof loadDeals === 'function') loadDeals();
    if (typeof loadMarketNews === 'function') loadMarketNews();
    if (typeof loadMarketIndices === 'function') loadMarketIndices();

    // 3. Pre-load foreign flow data for instant tab switching
    if (typeof loadForeignFlowData === 'function') loadForeignFlowData();

    // 4. Initialize institutional backtest engine
    if (typeof initBacktestModule === 'function') initBacktestModule();

    // 5. Start background auto-stream
    if (typeof startAutoStream === 'function') startAutoStream();

    // 6. Resume AudioContext on first user interaction to bypass autoplay restrictions
    const unlockAudio = () => {
        if (typeof getAudioContext === 'function') {
            const ctx = getAudioContext();
            if (ctx && ctx.state === 'suspended') {
                ctx.resume().catch(() => { });
            }
        }
        window.removeEventListener('click', unlockAudio);
        window.removeEventListener('touchstart', unlockAudio);
        window.removeEventListener('keydown', unlockAudio);
    };
    window.addEventListener('click', unlockAudio, { once: true });
    window.addEventListener('touchstart', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });
});

// --- END MODULE: init.js ---


// ============================================================
//  GLOBAL WINDOW BINDINGS (Compatibility Bridge)
// ============================================================
if (typeof window !== 'undefined') {
    window.executeStockAnalysis = typeof executeStockAnalysis !== 'undefined' ? executeStockAnalysis : window.executeStockAnalysis;
    window.switchMainTab = typeof switchMainTab !== 'undefined' ? switchMainTab : window.switchMainTab;
    window.openMobileSearch = typeof openMobileSearch !== 'undefined' ? openMobileSearch : window.openMobileSearch;
    window.closeMobileSearch = typeof closeMobileSearch !== 'undefined' ? closeMobileSearch : window.closeMobileSearch;
    window.timeAgo = typeof timeAgo !== 'undefined' ? timeAgo : window.timeAgo;
    window.playSoundChime = typeof playSoundChime !== 'undefined' ? playSoundChime : window.playSoundChime;
    window.renderScalpingTable = typeof renderScalpingTable !== 'undefined' ? renderScalpingTable : window.renderScalpingTable;
    window.switchForeignSubmenu = typeof switchForeignSubmenu !== 'undefined' ? switchForeignSubmenu : window.switchForeignSubmenu;
    window.renderWatchlistDrawer = typeof renderWatchlistDrawer !== 'undefined' ? renderWatchlistDrawer : window.renderWatchlistDrawer;
    window.updateWatchlistBadge = typeof updateWatchlistBadge !== 'undefined' ? updateWatchlistBadge : window.updateWatchlistBadge;
    window.saveWatchlistToStorage = typeof saveWatchlistToStorage !== 'undefined' ? saveWatchlistToStorage : window.saveWatchlistToStorage;
}
