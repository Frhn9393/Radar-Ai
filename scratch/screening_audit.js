const {
    get_stock_price,
    get_financial_report,
    get_market_indices
} = require('../services/marketDataService');

const {
    fetch_market_news,
    fetch_corporate_news,
    fetch_ma_deals
} = require('../services/newsService');

const {
    getForeignFlowData,
    getTickerForeignFlow
} = require('../services/foreignFlowService');

const {
    getRightsIssueData,
    calculateTebus
} = require('../services/rightsIssueService');

const {
    getAvailableStrategies,
    runBacktest,
    quickAudit
} = require('../services/backtestEngine');

const { runScreener } = require('../services/stockService');

async function runFullAudit() {
    console.log('=== RADAR-AI COMPREHENSIVE SYSTEM SCREENING & AUDIT ===\n');
    let issues = 0;

    // 1. Check marketDataService
    console.log('--- 1. Screening marketDataService ---');
    try {
        const p1 = await get_stock_price('BBCA');
        console.log('✔ get_stock_price(BBCA): OK, price =', p1.lastPrice);
    } catch (e) {
        console.error('❌ Error get_stock_price(BBCA):', e.message);
        issues++;
    }

    try {
        const pIhsg = await get_stock_price('IHSG');
        console.log('✔ get_stock_price(IHSG): OK, price =', pIhsg.lastPrice);
    } catch (e) {
        console.error('❌ Error get_stock_price(IHSG):', e.message);
        issues++;
    }

    try {
        const fBbca = await get_financial_report('BBCA');
        console.log('✔ get_financial_report(BBCA): OK, status =', fBbca?.valuation?.status);
    } catch (e) {
        console.error('❌ Error get_financial_report(BBCA):', e.message);
        issues++;
    }

    try {
        const fIhsg = await get_financial_report('IHSG');
        console.log('✔ get_financial_report(IHSG): OK, status =', fIhsg?.valuation?.status);
    } catch (e) {
        console.error('❌ Error get_financial_report(IHSG):', e.message);
        issues++;
    }

    try {
        const indices = await get_market_indices();
        console.log('✔ get_market_indices: OK, IHSG =', indices?.ihsg?.price, 'USD/IDR =', indices?.usdidr?.price);
    } catch (e) {
        console.error('❌ Error get_market_indices:', e.message);
        issues++;
    }

    // 2. Check newsService
    console.log('\n--- 2. Screening newsService ---');
    try {
        const marketNews = await fetch_market_news();
        console.log('✔ fetch_market_news: OK, count =', marketNews?.news?.length);
    } catch (e) {
        console.error('❌ Error fetch_market_news:', e.message);
        issues++;
    }

    try {
        const deals = await fetch_ma_deals();
        console.log('✔ fetch_ma_deals: OK, count =', deals?.deals?.length);
    } catch (e) {
        console.error('❌ Error fetch_ma_deals:', e.message);
        issues++;
    }

    try {
        const corpNews = await fetch_corporate_news('BBCA');
        console.log('✔ fetch_corporate_news(BBCA): OK, count =', corpNews?.length);
    } catch (e) {
        console.error('❌ Error fetch_corporate_news:', e.message);
        issues++;
    }

    // 3. Check foreignFlowService
    console.log('\n--- 3. Screening foreignFlowService ---');
    try {
        const ffData = await getForeignFlowData(false);
        console.log('✔ getForeignFlowData: OK, topBuy daily =', ffData?.daily?.topBuy?.length, 'streak =', ffData?.streak?.length);
    } catch (e) {
        console.error('❌ Error getForeignFlowData:', e.message);
        issues++;
    }

    try {
        const ffBbca = await getTickerForeignFlow('BBCA');
        console.log('✔ getTickerForeignFlow(BBCA): OK, daily FFPI =', ffBbca?.daily?.ffpi);
    } catch (e) {
        console.error('❌ Error getTickerForeignFlow(BBCA):', e.message);
        issues++;
    }

    // 4. Check rightsIssueService
    console.log('\n--- 4. Screening rightsIssueService ---');
    try {
        const ri = getRightsIssueData('BBCA', 6200);
        console.log('✔ getRightsIssueData(BBCA): OK, hasCorporateAction =', ri?.hasCorporateAction);
    } catch (e) {
        console.error('❌ Error getRightsIssueData:', e.message);
        issues++;
    }

    try {
        const tebus = calculateTebus({ ownedLots: 100, ratioOld: 10, ratioNew: 1, exercisePrice: 5000, cumPrice: 6000 });
        console.log('✔ calculateTebus: OK, theoreticalPrice =', tebus?.theoreticalPrice);
    } catch (e) {
        console.error('❌ Error calculateTebus:', e.message);
        issues++;
    }

    // 5. Check backtestEngine
    console.log('\n--- 5. Screening backtestEngine ---');
    try {
        const strats = getAvailableStrategies();
        console.log('✔ getAvailableStrategies: OK, count =', strats?.length);
    } catch (e) {
        console.error('❌ Error getAvailableStrategies:', e.message);
        issues++;
    }

    try {
        const bt = await runBacktest({ ticker: 'BBCA', strategyKey: 'COMPOSITE_QUANT', period: '1y' });
        console.log('✔ runBacktest(BBCA): OK, totalTrades =', bt?.metrics?.totalTrades, 'winRate =', bt?.metrics?.winRateFormatted);
    } catch (e) {
        console.error('❌ Error runBacktest(BBCA):', e.message);
        issues++;
    }

    try {
        const qa = await quickAudit('BBCA');
        console.log('✔ quickAudit(BBCA): OK, primaryStrategy =', qa?.primaryStrategy?.name);
    } catch (e) {
        console.error('❌ Error quickAudit(BBCA):', e.message);
        issues++;
    }

    // 6. Check screenerService
    console.log('\n--- 6. Screening screenerService ---');
    try {
        const sc = await runScreener();
        console.log('✔ runScreener: OK, categories =', Object.keys(sc || {}));
    } catch (e) {
        console.error('❌ Error runScreener:', e.message);
        issues++;
    }

    console.log('\n=== AUDIT SUMMARY: Total Issues Found =', issues, '===');
}

runFullAudit().catch(err => {
    console.error('Fatal audit error:', err);
    process.exit(1);
});
