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
        { btn: tabPortfolio, sec: secPortfolio, name: 'portfolio' },
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
tabPortfolio?.addEventListener('click', () => switchMainTab('portfolio'));
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
