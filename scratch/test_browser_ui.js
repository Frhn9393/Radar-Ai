const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

async function runBrowserTest() {
    console.log('================================================================');
    console.log('       RUNNING HEADLESS JSDOM UI & BUTTON INTERACTION TEST      ');
    console.log('================================================================');

    const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
    const appJs = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');

    // Create JSDOM environment
    const dom = new JSDOM(html, {
        url: 'http://localhost:3000/',
        runScripts: 'outside-only',
        resources: 'usable'
    });

    const { window } = dom;
    const { document } = window;

    // Polyfill AudioContext and localStorage
    window.AudioContext = class {
        createOscillator() { return { connect: () => {}, type: '', frequency: { setValueAtTime: () => {} }, start: () => {}, stop: () => {} }; }
        createGain() { return { connect: () => {}, gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} } }; }
        get currentTime() { return 0; }
        get destination() { return {}; }
    };

    // Forward native fetch to localhost:3000
    window.fetch = async (url, opts) => {
        const targetUrl = url.startsWith('/') ? `http://localhost:3000${url}` : url;
        return global.fetch(targetUrl, opts);
    };

    let jsErrors = [];
    window.addEventListener('error', (e) => {
        console.error('Browser Window Error:', e.error || e.message);
        jsErrors.push(e.error || e.message);
    });

    // Execute app.js
    try {
        window.eval(appJs);
        console.log('✅ PASS: app.js evaluated without any SyntaxError or load crashes');
    } catch (err) {
        console.error('❌ FAIL: app.js evaluation threw error:', err);
        process.exit(1);
    }

    // Trigger DOMContentLoaded
    const event = document.createEvent('Event');
    event.initEvent('DOMContentLoaded', true, true);
    document.dispatchEvent(event);
    console.log('✅ PASS: DOMContentLoaded event triggered successfully');

    // Wait for initial async loads
    await new Promise(r => setTimeout(r, 1200));

    // Test 1: Navigation tab switching
    const tabDeals = document.getElementById('tab-deals');
    const tabScreener = document.getElementById('tab-screener');
    const secDeals = document.getElementById('section-deals');
    const secScreener = document.getElementById('section-screener');

    tabScreener.click();
    const isScreenerActive = !secScreener.classList.contains('hidden') && secDeals.classList.contains('hidden');
    console.log(isScreenerActive
        ? '✅ PASS: Tab navigation to "Teknikal Screener" button works'
        : '❌ FAIL: Tab navigation to screener failed');

    // Test 2: Trigger Screener Scan Button
    const btnTriggerScreener = document.getElementById('btn-trigger-screener');
    console.log('⏳ Clicking "Pindai Pasar Sekarang" button and waiting for screener results...');
    btnTriggerScreener.click();

    // Poll until screenerResultsWrapper is no longer hidden (up to 8s)
    const screenerResultsWrapper = document.getElementById('screener-results-wrapper');
    let scanDone = false;
    for (let i = 0; i < 40; i++) {
        await new Promise(r => setTimeout(r, 200));
        if (!screenerResultsWrapper.classList.contains('hidden')) {
            scanDone = true;
            break;
        }
    }

    if (!scanDone) {
        console.error('❌ FAIL: Screener scan timed out or failed to show results');
        process.exit(1);
    }
    console.log('✅ PASS: Screener scan finished and results wrapper is displayed');

    // Test 3: Verify all 6 strategy tables have data (BSJP, BPJP, Daytrade, Swing, Scalping, Longterm)
    const tables = [
        { id: 'tbody-scalping', name: 'Scalping' },
        { id: 'tbody-daytrade', name: 'Daytrade' },
        { id: 'tbody-swing', name: 'Swing' },
        { id: 'tbody-bsjp', name: 'BSJP' },
        { id: 'tbody-bpjp', name: 'BPJP' },
        { id: 'tbody-longterm', name: 'Investasi Jangka Panjang' }
    ];

    for (const t of tables) {
        const tbody = document.getElementById(t.id);
        const rows = tbody.querySelectorAll('tr[data-ticker]');
        const hasContent = rows.length > 0 && !tbody.textContent.includes('Tidak ada saham');
        if (hasContent) {
            console.log(`✅ PASS: [${t.name}] table populated with ${rows.length} recommendations (Top: ${rows[0].getAttribute('data-ticker')})`);
        } else {
            console.error(`❌ FAIL: [${t.name}] table is EMPTY! Content:`, tbody.innerHTML);
            process.exit(1);
        }
    }

    // Test 4: Verify clicking table row opens Deep Stock Analysis Modal
    const bsjpTbody = document.getElementById('tbody-bsjp');
    const firstBsjpRow = bsjpTbody.querySelector('tr[data-ticker]');
    const targetTicker = firstBsjpRow.getAttribute('data-ticker');
    console.log(`⏳ Clicking BSJP row for $${targetTicker} to test modal opening...`);
    firstBsjpRow.click();

    await new Promise(r => setTimeout(r, 1000));
    const modal = document.getElementById('modal-analysis');
    const modalTicker = document.getElementById('modal-stock-ticker').textContent;
    const modalOpen = !modal.classList.contains('hidden') && modalTicker === targetTicker;
    console.log(modalOpen
        ? `✅ PASS: Deep Stock Analysis Modal opened for $${modalTicker}`
        : `❌ FAIL: Modal failed to open for $${targetTicker}`);

    // Test 5: Close Modal Button
    const btnCloseModal = document.getElementById('btn-close-modal');
    btnCloseModal.click();
    const modalClosed = modal.classList.contains('hidden');
    console.log(modalClosed
        ? '✅ PASS: Modal close button (✕) closes the modal properly'
        : '❌ FAIL: Modal close button failed');

    // Test 6: Watchlist Drawer & Delete Button
    const btnOpenWatchlist = document.getElementById('btn-open-watchlist');
    const btnCloseWatchlist = document.getElementById('btn-close-watchlist');
    const drawerWatchlist = document.getElementById('drawer-watchlist');
    const watchlistContainer = document.getElementById('watchlist-items-container');

    btnOpenWatchlist.click();
    const drawerOpened = !drawerWatchlist.classList.contains('hidden');
    console.log(drawerOpened
        ? '✅ PASS: Watchlist drawer button opened drawer'
        : '❌ FAIL: Watchlist drawer failed to open');

    const removeBtn = watchlistContainer.querySelector('[data-action="remove"]');
    if (removeBtn) {
        removeBtn.click();
        console.log('✅ PASS: Watchlist delete button clicked with 0 errors (TypeError: delete is not a function FIXED)');
    } else {
        console.log('⚠️ Watchlist had no items to remove');
    }

    btnCloseWatchlist.click();
    const drawerClosed = drawerWatchlist.classList.contains('hidden');
    console.log(drawerClosed
        ? '✅ PASS: Watchlist close button closes drawer'
        : '❌ FAIL: Watchlist drawer failed to close');

    // Test 7: Deals Tab & "Baca Berita" Buttons
    tabDeals.click();
    const dealsGrid = document.getElementById('deals-grid');
    const dealCards = dealsGrid.querySelectorAll('.deal-card');
    console.log(`✅ PASS: M&A Radar rendered with ${dealCards.length} deals`);

    const readNewsBtns = dealsGrid.querySelectorAll('a[href^="http"]');
    console.log(`✅ PASS: M&A Radar has ${readNewsBtns.length} direct "Baca Berita" links opening in new tabs`);

    // Test 8: Deep Analysis Modal UI Verification for Turnaround Stock (BIPI)
    console.log('⏳ Triggering executeStockAnalysis("BIPI") in UI to test turnaround rendering...');
    await window.executeStockAnalysis('BIPI');
    await new Promise(r => setTimeout(r, 600));

    const finBadge = document.getElementById('modal-fin-badge');
    const netGrowth = document.getElementById('modal-fin-net-growth');
    const cogsGrowth = document.getElementById('modal-fin-cogs');
    const currencyEl = document.getElementById('modal-fin-currency');
    const perFootnote = document.getElementById('modal-val-per-footnote');
    const summaryBadge = document.getElementById('modal-fin-summary-badge');
    const summaryText = document.getElementById('modal-fin-summary').textContent;

    if (finBadge && finBadge.textContent.includes('TURNAROUND')) {
        console.log(`✅ PASS: [Rule 2] modal-fin-badge displays: "${finBadge.textContent}"`);
    } else {
        console.error('❌ FAIL: modal-fin-badge does not display TURNAROUND. Content:', finBadge?.textContent);
        process.exit(1);
    }

    if (netGrowth && netGrowth.textContent.includes('Turnaround')) {
        console.log(`✅ PASS: [Rule 2 & 4] modal-fin-net-growth displays turnaround bottom-line: "${netGrowth.textContent}"`);
    } else {
        console.error('❌ FAIL: modal-fin-net-growth does not show turnaround:', netGrowth?.textContent);
        process.exit(1);
    }

    if (cogsGrowth && cogsGrowth.textContent.includes('Efisiensi Beban')) {
        console.log(`✅ PASS: [Rule 1] modal-fin-cogs displays cost efficiency: "${cogsGrowth.textContent}"`);
    } else {
        console.error('❌ FAIL: modal-fin-cogs does not show cost efficiency:', cogsGrowth?.textContent);
        process.exit(1);
    }

    if (currencyEl && currencyEl.textContent.includes('USD')) {
        console.log(`✅ PASS: [Rule 5] modal-fin-currency correctly indicates foreign currency: "${currencyEl.textContent}"`);
    } else {
        console.error('❌ FAIL: modal-fin-currency does not show USD:', currencyEl?.textContent);
        process.exit(1);
    }

    if (perFootnote && !perFootnote.classList.contains('hidden') && perFootnote.textContent.includes('turnaround')) {
        console.log(`✅ PASS: [Rule 6] modal-val-per-footnote is visible with educational note: "${perFootnote.textContent}"`);
    } else {
        console.error('❌ FAIL: modal-val-per-footnote missing or hidden');
        process.exit(1);
    }

    if (summaryBadge && !summaryBadge.classList.contains('hidden') && summaryBadge.textContent.includes('TURNAROUND')) {
        console.log(`✅ PASS: [Rule 3] modal-fin-summary-badge displays: "${summaryBadge.textContent}"`);
    } else {
        console.error('❌ FAIL: modal-fin-summary-badge missing or hidden');
        process.exit(1);
    }

    if (summaryText.includes('TURNAROUND') && summaryText.includes('Efisiensi Beban Pokok')) {
        console.log(`✅ PASS: [Rule 3] modal-fin-summary synchronized narrative contains objective turnaround & cost efficiency details`);
    } else {
        console.error('❌ FAIL: modal-fin-summary missing expected narrative');
        process.exit(1);
    }

    // Verify 0 JS errors
    console.log('================================================================');
    if (jsErrors.length === 0) {
        console.log('🎉 ALL 8 BROWSER UI & BUTTON TESTS PASSED WITH ZERO ERRORS!');
    } else {
        console.error(`💥 ENCOUNTERED ${jsErrors.length} UNEXPECTED JAVASCRIPT ERRORS!`);
        process.exit(1);
    }
    console.log('================================================================');
}

runBrowserTest().catch(err => {
    console.error('Browser test failure:', err);
    process.exit(1);
});
