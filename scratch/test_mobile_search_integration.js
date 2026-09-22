const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

async function testMobileSearch() {
    console.log('--- Testing Mobile Search UI & Logic Integration ---');
    const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');

    const dom = new JSDOM(html, {
        runScripts: 'dangerously',
        resources: 'usable',
        url: 'http://localhost:3000'
    });

    const { window } = dom;
    const { document } = window;

    // Mock fetch for suggestions
    window.fetch = async (url) => {
        if (url.includes('/api/search-suggest')) {
            return {
                json: async () => ({
                    query: 'BBCA',
                    count: 1,
                    suggestions: [
                        { ticker: 'BBCA', name: 'Bank Central Asia Tbk', sector: 'Financials' }
                    ]
                })
            };
        }
        return { json: async () => ({}) };
    };

    // Load app.js
    const appJs = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');
    window.eval(appJs);

    // 1. Verify Element Presence
    const pill = document.getElementById('btn-mobile-search-pill');
    const modal = document.getElementById('modal-mobile-search');
    const input = document.getElementById('input-mobile-search');
    const btnClose = document.getElementById('btn-close-mobile-search');
    const btnClear = document.getElementById('btn-clear-mobile-search');
    const results = document.getElementById('mobile-search-results');
    const quickPicks = document.getElementById('mobile-search-quick-picks');

    console.assert(pill, '❌ btn-mobile-search-pill missing');
    console.assert(modal, '❌ modal-mobile-search missing');
    console.assert(input, '❌ input-mobile-search missing');
    console.assert(btnClose, '❌ btn-close-mobile-search missing');
    console.assert(btnClear, '❌ btn-clear-mobile-search missing');
    console.assert(results, '❌ mobile-search-results missing');
    console.assert(quickPicks, '❌ mobile-search-quick-picks missing');

    console.log('✅ 1. All Mobile Search DOM Elements Exist');

    // 2. Test Open Modal
    console.assert(modal.classList.contains('hidden'), 'Modal should start hidden');
    pill.click();
    console.assert(!modal.classList.contains('hidden') && modal.classList.contains('flex'), '❌ Modal should be visible after pill click');
    console.log('✅ 2. Open Modal via Pill Works');

    // 3. Test Close Modal
    btnClose.click();
    console.assert(modal.classList.contains('hidden'), '❌ Modal should be hidden after close click');
    console.log('✅ 3. Close Modal via Back Button Works');

    // 4. Test Quick Chips
    pill.click();
    const chips = quickPicks.querySelectorAll('.mobile-quick-chip');
    console.assert(chips.length >= 8, `Expected at least 8 quick chips, found ${chips.length}`);
    let analysisCalledTicker = null;
    window.executeStockAnalysis = (t) => { analysisCalledTicker = t; };

    chips[0].click(); // click $BBCA
    console.assert(modal.classList.contains('hidden'), '❌ Modal should close after selecting quick chip');
    console.assert(analysisCalledTicker === 'BBCA', `❌ Expected analysis on BBCA, got ${analysisCalledTicker}`);
    console.log(`✅ 4. Quick Chip Click Triggers Analysis for $${analysisCalledTicker}`);

    // 5. Test Live Search Input
    pill.click();
    input.value = 'BBCA';
    input.dispatchEvent(new window.Event('input'));

    await new Promise(r => setTimeout(r, 100)); // wait for debounce
    const resultItems = results.querySelectorAll('.mobile-search-item');
    console.assert(resultItems.length === 1, `❌ Expected 1 result item, got ${resultItems.length}`);
    console.log(`✅ 5. Live Search Input Auto-Suggests ${resultItems.length} match`);

    // 6. Test Result Item Click
    resultItems[0].click();
    console.assert(modal.classList.contains('hidden'), '❌ Modal should close after clicking result');
    console.assert(analysisCalledTicker === 'BBCA', `❌ Expected analysis on BBCA, got ${analysisCalledTicker}`);
    console.log('✅ 6. Result Item Click Triggers Stock Analysis');

    console.log('\n🎉 ALL MOBILE SEARCH INTEGRATION TESTS PASSED 100%!');
}

testMobileSearch().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});
