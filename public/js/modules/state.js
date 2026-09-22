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
