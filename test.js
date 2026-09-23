// Radar-AI Automated Test Suite
const { sanitizeTicker } = require('./services/utils');
const { search_stocks } = require('./services/searchService');
const { get_stock_price, get_market_indices } = require('./services/marketDataService');
const { get_technical_indicators } = require('./services/technicalService');
const { fetch_market_news, fetch_ma_deals } = require('./services/newsService');
const { classifyNewsSentiment, formatNewsAlert } = require('./services/newsAlertService');
const { analyzeStock, runScreener } = require('./services/stockService');

let totalTests = 0;
let passedTests = 0;
let failedTests = [];

function assert(condition, testName, details = '') {
    totalTests++;
    if (condition) {
        passedTests++;
        console.log(`  ✅ PASS: ${testName}`);
    } else {
        failedTests.push({ testName, details });
        console.error(`  ❌ FAIL: ${testName} - ${details}`);
    }
}

async function runAllTests() {
    console.log('════════════════════════════════════════════════════════════════');
    console.log('   RADAR-AI COMPREHENSIVE AUTOMATED VERIFICATION TEST SUITE     ');
    console.log('════════════════════════════════════════════════════════════════\n');

    // ── 1. Unit Tests: sanitizeTicker ───────────────────────────
    console.log('▶ [1/7] Testing utils.sanitizeTicker...');
    assert(sanitizeTicker('$BBCA') === 'BBCA', 'Strips $ prefix ($BBCA -> BBCA)');
    assert(sanitizeTicker('bbca') === 'BBCA', 'Uppercases ticker (bbca -> BBCA)');
    assert(sanitizeTicker('^JKSE') === 'IHSG', 'Maps ^JKSE to IHSG');
    assert(sanitizeTicker('IHSG.JK') === 'IHSG', 'Maps IHSG.JK to IHSG');
    assert(sanitizeTicker('  $tlkm  ') === 'TLKM', 'Trims whitespace and $ (  $tlkm   -> TLKM)');
    assert(sanitizeTicker('ASII.JK') === 'ASII', 'Strips .JK suffix (ASII.JK -> ASII)');
    assert(sanitizeTicker('') === '', 'Handles empty string gracefully');

    // ── 2. Unit Tests: searchService ─────────────────────────────
    console.log('\n▶ [2/7] Testing searchService.search_stocks...');
    const bbcaSuggest = search_stocks('$BBCA');
    assert(bbcaSuggest.length > 0 && bbcaSuggest[0].ticker === 'BBCA', 'Search with $ prefix ($BBCA) finds BBCA');

    const ihsgSuggest = search_stocks('IHSG');
    assert(ihsgSuggest.length > 0 && ihsgSuggest[0].ticker === 'IHSG' && ihsgSuggest[0].name.includes('Indeks Harga Saham Gabungan'), 'Search for IHSG returns market index metadata, not fake PT');

    const unknownSuggest = search_stocks('ZZZZNOTEXIST');
    assert(unknownSuggest.length === 0, 'Unknown query returns empty array instead of fake emiten');

    console.log('\n▶ Testing Telegram news alert formatting...');
    assert(classifyNewsSentiment({ title: 'Laba tumbuh dan dividen meningkat' }).label === 'Bullish', 'News alert recognizes positive headline sentiment');
    assert(classifyNewsSentiment({ title: 'Emiten catat rugi dan saham turun' }).label === 'Bearish', 'News alert recognizes negative headline sentiment');
    assert(classifyNewsSentiment({ title: 'Emiten umumkan akuisisi' }).label === 'Netral / perlu verifikasi', 'News alert avoids assuming M&A is bullish');
    const formattedAlert = formatNewsAlert({ ticker: 'BBRI', title: 'Laba tumbuh', link: 'https://example.com/news' });
    assert(formattedAlert.includes('Emiten: $BBRI') && formattedAlert.includes('Link: https://example.com/news'), 'News alert includes issuer and source link');

    // ── 3. Unit Tests: marketDataService ─────────────────────────
    console.log('\n▶ [3/7] Testing marketDataService...');
    const bbcaQuote = await get_stock_price('BBCA');
    assert(bbcaQuote && bbcaQuote.lastPrice > 0, `Fetch quote for BBCA (price: Rp ${bbcaQuote?.lastPrice})`);

    const ihsgQuote = await get_stock_price('IHSG');
    assert(ihsgQuote && ihsgQuote.lastPrice > 0, `Fetch quote for IHSG index (quote: ${ihsgQuote?.lastPrice})`);

    const indices = await get_market_indices();
    assert(indices && indices.ihsg && indices.ihsg.price > 0, `Fetch market indices (IHSG: ${indices?.ihsg?.price})`);
    assert(indices && indices.usdidr && indices.usdidr.price > 0, `Market indices contains valid USD/IDR: ${indices?.usdidr?.price}`);

    // ── 4. Unit Tests: technicalService ──────────────────────────
    console.log('\n▶ [4/7] Testing technicalService (Node.js engine)...');
    const startTa = Date.now();
    const taBbca = await get_technical_indicators('BBCA');
    const taDuration = Date.now() - startTa;
    assert(taBbca && taBbca.supertrend && taBbca.rsi14 > 0 && taBbca.macd_line !== undefined, `Calculate indicators for BBCA completed in ${taDuration}ms`);
    assert(taBbca.supertrend.direction === 1 || taBbca.supertrend.direction === -1, `Supertrend direction is valid: ${taBbca.supertrend.direction} (isBullish: ${taBbca.supertrend.isBullish})`);
    assert(taBbca.engine === 'nodejs' || taBbca.engine === 'python', `Engine used: ${taBbca.engine}`);

    // ── 5. Integration Tests: stockService ───────────────────────
    console.log('\n▶ [5/7] Testing stockService.analyzeStock...');
    const analysisBbca = await analyzeStock('$BBCA');
    assert(analysisBbca && analysisBbca.realtime && analysisBbca.trend, 'Full stock analysis for $BBCA returns realtime + trend data');

    const analysisIhsg = await analyzeStock('IHSG');
    assert(analysisIhsg && analysisIhsg.realtime && analysisIhsg.valuation && analysisIhsg.valuation.status.includes('INDEX'), 'Full stock analysis for IHSG completes without corporate balance sheet crash');

    // ── 6. Screener Performance Test ─────────────────────────────
    console.log('\n▶ [6/7] Testing screener speed and categorization...');
    const startScreener = Date.now();
    const screenerResult = await runScreener();
    const screenerDuration = Date.now() - startScreener;
    console.log(`  ⏱️ Screener finished in ${screenerDuration}ms (Target: < 10000ms cold start)`);
    assert(screenerDuration < 60000, `Screener completes quickly (${screenerDuration}ms vs former 61,000ms)`);
    assert(screenerResult && Array.isArray(screenerResult.scalping) && screenerResult.scalping.length > 0, `Screener scalping has ${screenerResult?.scalping?.length} recommendations`);
    assert(screenerResult && Array.isArray(screenerResult.daytrade) && screenerResult.daytrade.length > 0, `Screener daytrade has ${screenerResult?.daytrade?.length} recommendations`);
    assert(screenerResult && Array.isArray(screenerResult.swing) && screenerResult.swing.length > 0, `Screener swing has ${screenerResult?.swing?.length} recommendations`);
    assert(screenerResult && Array.isArray(screenerResult.bsjp) && screenerResult.bsjp.length > 0, `Screener BSJP has ${screenerResult?.bsjp?.length} recommendations`);
    assert(screenerResult && Array.isArray(screenerResult.bpjp) && screenerResult.bpjp.length > 0, `Screener BPJP has ${screenerResult?.bpjp?.length} recommendations`);
    assert(screenerResult && Array.isArray(screenerResult.longterm) && screenerResult.longterm.length > 0, `Screener longterm has ${screenerResult?.longterm?.length} recommendations`);

    // ── 7. News & Deals Feeds ────────────────────────────────────
    console.log('\n▶ [7/7] Testing newsService...');
    const news = await fetch_market_news();
    assert(news && Array.isArray(news.news) && news.news.length > 0, `Market news fetched successfully (${news?.news?.length} items)`);
    assert(news?.news?.length > 0 && news.news[0].link && news.news[0].link.startsWith('http'), `Market news items have valid direct URLs (Sample: ${news?.news?.[0]?.link})`);

    const deals = await fetch_ma_deals();
    assert(deals && Array.isArray(deals.deals) && deals.deals.length > 0, `M&A deals fetched successfully (${deals?.deals?.length} items)`);
    assert(deals?.deals?.length > 0 && deals.deals[0].link && deals.deals[0].link.startsWith('http'), `M&A deal items have valid direct URLs (Sample: ${deals?.deals?.[0]?.link})`);

    const { fetch_corporate_news } = require('./services/newsService');
    const corpNews = await fetch_corporate_news('BBRI');
    assert(Array.isArray(corpNews) && corpNews.length > 0, `Corporate news fetched for BBRI (${corpNews.length} items)`);
    assert(corpNews.length > 0 && corpNews[0].link && corpNews[0].link.startsWith('http'), `Corporate news has direct URL (Sample: ${corpNews[0]?.link})`);

    // ── 8. Foreign Flow Engine Test ─────────────────────────────
    console.log('\n▶ [8/8] Testing foreignFlowService...');
    const { getTickerForeignFlow, getForeignFlowData } = require('./services/foreignFlowService');
    const bbcaForeign = await getTickerForeignFlow('BBCA');
    assert(bbcaForeign && bbcaForeign.daily && bbcaForeign.weekly && bbcaForeign.monthly, 'getTickerForeignFlow(BBCA) returns daily, weekly, monthly attributes');
    assert(typeof bbcaForeign.daily.ffpi === 'number', `BBCA daily FFPI is a valid number: ${bbcaForeign?.daily?.ffpi}`);
    assert(typeof bbcaForeign.weekly.weeklyNetVal === 'number', `BBCA weekly net val is a valid number: ${bbcaForeign?.weekly?.weeklyNetVal}`);
    assert(bbcaForeign.monthly.foreignVWAP > 0, `BBCA monthly foreign VWAP is valid price: ${bbcaForeign?.monthly?.foreignVWAP}`);

    const allForeign = await getForeignFlowData();
    assert(allForeign && allForeign.macro && allForeign.daily && allForeign.weekly && allForeign.monthly, 'getForeignFlowData() returns complete multi-timeframe dataset');
    assert(allForeign.macro.totalEmitenTracked > 0, `Macro tracking ${allForeign?.macro?.totalEmitenTracked} liquid stocks`);
    assert(Array.isArray(allForeign.daily.topBuy) && allForeign.daily.topBuy.length > 0, `Daily Top Buy has ${allForeign?.daily?.topBuy?.length} emiten`);
    assert(Array.isArray(allForeign.daily.topSell) && allForeign.daily.topSell.length > 0, `Daily Top Sell has ${allForeign?.daily?.topSell?.length} emiten`);
    assert(Array.isArray(allForeign.streak?.streaks) && allForeign.streak.streaks.length > 0, `Active streak tracker detected ${allForeign?.streak?.streaks?.length} consecutive inflow emiten`);

    // ── 9. Enhanced Financial Health & AI Summary (6 Core Rules) ──
    console.log('\n▶ [9/9] Testing Enhanced Financial Health & AI Summary (6 Core Rules)...');
    const { get_financial_report } = require('./services/marketDataService');

    // Rule 1, 2, 4, 5, 6: BIPI Turnaround, Cost Efficiency, Currency Context & PER Footnote
    const bipiFin = await get_financial_report('BIPI');
    assert(bipiFin && bipiFin.financials, 'get_financial_report(BIPI) returns complete financial dataset');
    assert(bipiFin.financials.isTurnaround === true, 'Rule 2: BIPI is detected as turnaround (isTurnaround: true)');
    assert(bipiFin.financials.sentimentLabel === 'TURNAROUND / PEMULIHAN', `Rule 2: BIPI has sentiment label TURNAROUND / PEMULIHAN (Got: ${bipiFin.financials.sentimentLabel})`);
    assert(bipiFin.financials.isCostEfficient === true, 'Rule 1: BIPI detected COGS drop > Revenue drop with improved bottom line (isCostEfficient: true)');
    assert(bipiFin.financials.cogsGrowth < bipiFin.financials.revenueGrowth, `Rule 1: COGS growth (${(bipiFin.financials.cogsGrowth*100).toFixed(1)}%) dropped deeper than revenue growth (${(bipiFin.financials.revenueGrowth*100).toFixed(1)}%)`);
    assert(bipiFin.financials.healthStatus === 'TURNAROUND / PEMULIHAN', `Rule 4: Prioritas Laba Bersih > Pendapatan menilai BIPI sebagai sinyal POSITIF/TURNAROUND (Got: ${bipiFin.financials.healthStatus})`);
    assert(bipiFin.financials.currency === 'USD', `Rule 5: BIPI reporting currency identified as USD`);
    assert(typeof bipiFin.valuation.perFootnote === 'string' && bipiFin.valuation.perFootnote.includes('turnaround'), `Rule 6: High trailing PER has educational footnote noting low past EPS basis`);
    assert(bipiFin.financials.summary.includes('TURNAROUND') && bipiFin.financials.summary.includes('Efisiensi Beban Pokok'), 'Rule 3: AI Summary narrative synchronizes turnaround, cost efficiency, and net profit priority');

    // Rule 5: ITMG USD currency normalization
    const itmgFin = await get_financial_report('ITMG');
    assert(itmgFin && itmgFin.valuation, 'get_financial_report(ITMG) returns valid valuation data');
    assert(itmgFin.valuation.bvps > 5000, `Rule 5: ITMG BVPS properly normalized from USD to Rupiah (BVPS: Rp ${itmgFin.valuation.bvps})`);
    assert(parseFloat(itmgFin.valuation.pbv) < 2.0, `Rule 5: ITMG PBV correctly calculated on normalized basis (${itmgFin.valuation.pbv}x vs former buggy 15496x)`);

    // Sektor Perbankan (BBCA) leverage consistency
    const bbcaFin = await get_financial_report('BBCA');
    assert(bbcaFin && bbcaFin.financials, 'get_financial_report(BBCA) returns valid financial dataset');
    const bbcaSummary = bbcaFin.financials.summary;
    const hasContradiction = bbcaSummary.includes('struktur modal sehat') && bbcaSummary.includes('Utang tinggi');
    assert(!hasContradiction, 'AI Summary for banking sector does not contain contradictory DER claims');
    assert(bbcaSummary.includes('sektor perbankan') || bbcaSummary.includes('DPK'), 'Banking sector leverage properly recognized as funding/DPK gearing');

    // ── 10. Automated Quantitative Backtest Engine ────────────────
    console.log('\n▶ [10/10] Testing Automated Quantitative Backtest Engine...');
    const { runBacktest, getAvailableStrategies, quickAudit } = require('./services/backtestEngine');

    const strats = getAvailableStrategies();
    assert(Array.isArray(strats) && strats.length >= 5, `Backtest engine loaded ${strats.length} institutional quantitative strategies`);

    const startBt = Date.now();
    const btResult = await runBacktest({ ticker: 'BBCA', strategyKey: 'COMPOSITE_QUANT', period: '1y' });
    const btDuration = Date.now() - startBt;
    assert(btResult && btResult.metrics, `runBacktest(BBCA) executed successfully in ${btDuration}ms`);
    assert(typeof btResult.metrics.totalTrades === 'number' && btResult.metrics.totalTrades >= 0, `BBCA backtest calculated ${btResult.metrics.totalTrades} simulated trades`);
    assert(typeof btResult.metrics.winRate === 'string' && btResult.metrics.winRate.endsWith('%'), `BBCA winRate formatted properly: ${btResult.metrics.winRate}`);
    assert(Array.isArray(btResult.tradeLog), `BBCA tradeLog generated (${btResult.tradeLog.length} trade records)`);
    assert(Array.isArray(btResult.equityCurve) && btResult.equityCurve.length > 20, `BBCA equityCurve generated (${btResult.equityCurve.length} data points)`);

    const quickAuditBbca = await quickAudit('BBRI');
    assert(quickAuditBbca && quickAuditBbca.ticker === 'BBRI' && quickAuditBbca.winRate, `quickAudit(BBRI) returned instant quant audit (WinRate: ${quickAuditBbca.winRate})`);

    // ── Summary ──────────────────────────────────────────────────
    console.log('\n════════════════════════════════════════════════════════════════');
    console.log(`TEST SUMMARY: ${passedTests} passed / ${totalTests} total`);
    if (failedTests.length === 0) {
        console.log('🎉 ALL TESTS PASSED WITH 0 FAILURES!');
    } else {
        console.error(`💥 FAILURES (${failedTests.length}):`);
        failedTests.forEach(f => console.error(`  - ${f.testName}: ${f.details}`));
    }
    console.log('════════════════════════════════════════════════════════════════');

    if (failedTests.length > 0) process.exit(1);
}

runAllTests().catch(err => {
    console.error('Unhandled test suite error:', err);
    process.exit(1);
});
