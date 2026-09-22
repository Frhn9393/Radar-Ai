const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

async function testBrowserDOM() {
    console.log('====================================================');
    console.log('🌐 RUNNING JSDOM BROWSER UI INTEGRATION TEST');
    console.log('====================================================');

    let htmlContent = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
    const appJsContent = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');

    // Remove tailwind CDN call and replace external script
    htmlContent = htmlContent.replace('<script src="https://cdn.tailwindcss.com"></script>', '<script>window.tailwind = { config: {} };</script>');
    htmlContent = htmlContent.replace('<script src="/app.js"></script>', `<script>${appJsContent}</script>`);

    const dom = new JSDOM(htmlContent, {
        url: 'http://localhost:3000',
        runScripts: 'dangerously',
        pretendToBeVisual: true,
        beforeParse(window) {
            window.tailwind = { config: {} };
            // Polyfill fetch to connect to live server on http://localhost:3000
            window.fetch = async function(url, options) {
                const fullUrl = url.startsWith('http') ? url : `http://localhost:3000${url}`;
                return fetch(fullUrl, options);
            };
        }
    });

    const { window } = dom;
    const { document } = window;

    // Trigger DOMContentLoaded
    window.dispatchEvent(new window.Event('DOMContentLoaded'));

    // Wait 3s for initial data load
    await new Promise(r => setTimeout(r, 3000));

    console.log('\n--- 1. Testing Tab Navigation to Foreign Flow ---');
    const tabForeign = document.getElementById('tab-foreign');
    const secForeign = document.getElementById('section-foreign');
    const secDeals = document.getElementById('section-deals');
    const secScreener = document.getElementById('section-screener');

    if (!tabForeign || !secForeign) throw new Error('Missing tab-foreign or section-foreign');

    // Click Foreign Tab
    tabForeign.click();
    console.log('   - Clicked tab-foreign');
    console.log('   - section-foreign hidden:', secForeign.classList.contains('hidden'));
    console.log('   - section-deals hidden:', secDeals.classList.contains('hidden'));
    console.log('   - section-screener hidden:', secScreener.classList.contains('hidden'));

    if (secForeign.classList.contains('hidden')) {
        throw new Error('FAILED: section-foreign should NOT be hidden after clicking tab');
    }

    // Wait 1.5s for foreign data rendering
    await new Promise(r => setTimeout(r, 1500));

    console.log('\n--- 2. Verifying Macro Cards ---');
    const netvalEl = document.getElementById('foreign-macro-netval');
    const partEl = document.getElementById('foreign-macro-participation');
    const sentEl = document.getElementById('foreign-macro-sentiment');
    const trackedEl = document.getElementById('foreign-macro-tracked');

    console.log('   - Net Foreign Val:', netvalEl?.textContent);
    console.log('   - Participation:', partEl?.textContent);
    console.log('   - Sentiment:', sentEl?.textContent);
    console.log('   - Tracked Emiten:', trackedEl?.textContent);

    if (!netvalEl?.textContent || netvalEl.textContent === 'Rp 0 M') {
        throw new Error('FAILED: Macro Net Val is not populated properly');
    }

    console.log('\n--- 3. Verifying Daily View (Top Buy & Sell) ---');
    const tbodyDailyBuy = document.getElementById('tbody-foreign-daily-buy');
    const tbodyDailySell = document.getElementById('tbody-foreign-daily-sell');

    console.log('   - Daily Buy rows count:', tbodyDailyBuy.querySelectorAll('tr').length);
    console.log('   - Daily Sell rows count:', tbodyDailySell.querySelectorAll('tr').length);

    const firstBuyTr = tbodyDailyBuy.querySelector('tr');
    console.log('   - First Top Buy row sample:', firstBuyTr?.textContent?.replace(/\s+/g, ' ').trim());

    const firstSellTr = tbodyDailySell.querySelector('tr');
    console.log('   - First Top Sell row sample:', firstSellTr?.textContent?.replace(/\s+/g, ' ').trim());

    if (tbodyDailyBuy.querySelectorAll('tr').length < 5) {
        throw new Error('FAILED: Daily Buy table has too few rows');
    }

    console.log('\n--- 4. Testing Weekly Submenu ---');
    const btnWeekly = document.getElementById('btn-foreign-weekly');
    const viewWeekly = document.getElementById('view-foreign-weekly');
    const tbodyWeekly = document.getElementById('tbody-foreign-weekly');

    btnWeekly.click();
    console.log('   - Clicked btn-foreign-weekly');
    console.log('   - view-foreign-weekly hidden:', viewWeekly.classList.contains('hidden'));
    console.log('   - Weekly rows count:', tbodyWeekly.querySelectorAll('tr').length);
    console.log('   - First Weekly row:', tbodyWeekly.querySelector('tr')?.textContent?.replace(/\s+/g, ' ').trim());

    if (viewWeekly.classList.contains('hidden') || tbodyWeekly.querySelectorAll('tr').length === 0) {
        throw new Error('FAILED: Weekly view is not rendering rows');
    }

    console.log('\n--- 5. Testing Monthly Submenu ---');
    const btnMonthly = document.getElementById('btn-foreign-monthly');
    const viewMonthly = document.getElementById('view-foreign-monthly');
    const tbodyMonthly = document.getElementById('tbody-foreign-monthly');

    btnMonthly.click();
    console.log('   - Clicked btn-foreign-monthly');
    console.log('   - view-foreign-monthly hidden:', viewMonthly.classList.contains('hidden'));
    console.log('   - Monthly rows count:', tbodyMonthly.querySelectorAll('tr').length);
    console.log('   - First Monthly row:', tbodyMonthly.querySelector('tr')?.textContent?.replace(/\s+/g, ' ').trim());

    if (viewMonthly.classList.contains('hidden') || tbodyMonthly.querySelectorAll('tr').length === 0) {
        throw new Error('FAILED: Monthly view is not rendering rows');
    }

    console.log('\n--- 6. Testing Streak Pembelian Submenu ---');
    const btnStreak = document.getElementById('btn-foreign-streak');
    const viewStreak = document.getElementById('view-foreign-streak');
    const tbodyStreak = document.getElementById('tbody-foreign-streak');

    btnStreak.click();
    console.log('   - Clicked btn-foreign-streak');
    console.log('   - view-foreign-streak hidden:', viewStreak.classList.contains('hidden'));
    const streakRows = tbodyStreak.querySelectorAll('tr');
    console.log('   - Streak rows count:', streakRows.length);
    console.log('   - First Streak row:', streakRows[0]?.textContent?.replace(/\s+/g, ' ').trim());

    if (viewStreak.classList.contains('hidden') || streakRows.length === 0) {
        throw new Error('FAILED: Streak view is not rendering rows');
    }

    console.log('\n--- 7. Testing Row Click & Stock Detail Modal ---');
    const firstStreakRow = streakRows[0];
    const ticker = firstStreakRow.getAttribute('data-ticker');
    console.log(`   - Clicking streak row for $${ticker}...`);
    firstStreakRow.click();

    // Wait 2.5s for analyze API to resolve and modal to populate
    await new Promise(r => setTimeout(r, 2500));

    console.log('   - Modal ticker header:', document.getElementById('modal-stock-ticker')?.textContent);
    console.log('   - Modal price:', document.getElementById('modal-price')?.textContent);
    console.log('   - Modal Foreign Status:', document.getElementById('modal-foreign-status')?.textContent);
    console.log('   - Modal Foreign Net 1D:', document.getElementById('modal-foreign-net1d')?.textContent);
    console.log('   - Modal Foreign Net 5D:', document.getElementById('modal-foreign-net5d')?.textContent);
    console.log('   - Modal Foreign VWAP:', document.getElementById('modal-foreign-vwap')?.textContent);
    console.log('   - Modal Foreign FFPI:', document.getElementById('modal-foreign-ffpi')?.textContent);
    console.log('   - Modal Foreign Streak:', document.getElementById('modal-foreign-streak')?.textContent);

    if (document.getElementById('modal-foreign-status')?.textContent === 'Memuat...') {
        throw new Error('FAILED: Modal foreign status was not updated');
    }

    // Close modal
    const btnCloseModal = document.getElementById('modal-close-btn');
    btnCloseModal?.click();
    console.log('   - Modal closed');

    console.log('\n--- 8. Testing Tab 1 & Tab 2 Crosscheck ---');
    const tabDeals = document.getElementById('tab-deals');
    const tabScreener = document.getElementById('tab-screener');

    tabDeals.click();
    console.log('   - Clicked tab-deals: deals visible =', !secDeals.classList.contains('hidden'), 'foreign hidden =', secForeign.classList.contains('hidden'));

    tabScreener.click();
    console.log('   - Clicked tab-screener: screener visible =', !secScreener.classList.contains('hidden'), 'foreign hidden =', secForeign.classList.contains('hidden'));

    console.log('\n🎉 ALL JSDOM BROWSER UI INTEGRATION TESTS PASSED 100%!');
}

testBrowserDOM().catch(err => {
    console.error('❌ DOM TEST FAILED:', err);
    process.exit(1);
});
