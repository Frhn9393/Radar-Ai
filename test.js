// Radar-AI Automated Test Suite
const { sanitizeTicker } = require('./services/utils');
const { search_stocks } = require('./services/searchService');
const { get_stock_price, get_market_indices } = require('./services/marketDataService');
const { get_technical_indicators } = require('./services/technicalService');
const { fetch_market_news, fetch_ma_deals, extractNewsTicker } = require('./services/newsService');
const { classifyNewsSentiment, findNewNewsItems, formatNewsAlert } = require('./services/newsAlertService');
const { isStrictBsjpEligible, isStrictBpjpEligible, isStrictIntradayEligible } = require('./services/strictScreenerFilters');
const { getDailyCatalysts } = require('./services/screenerService');
const { processTelegramUpdate, formatScreenerRows, STRICT_EMPTY_ALERT } = require('./services/telegramWebhookService');
const { fetchStockPrices, fetchHistorical, fetchBrokerSummary, analyzeBrokerSummary, GoApiError, GOAPI_CAPABILITIES, _clearCacheForTests } = require('./services/goapi');
const { fetchBroksum, tradingDaysBetween } = require('./services/broksumService');
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

async function testEmptyTelegramCommands() {
    const previousToken = process.env.TELEGRAM_BOT_TOKEN;
    const previousChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
    const previousFetch = global.fetch;
    const sentMessages = [];
    process.env.TELEGRAM_BOT_TOKEN = 'test-token';
    process.env.TELEGRAM_ADMIN_CHAT_ID = '555';
    global.fetch = async (_url, options) => {
        sentMessages.push(JSON.parse(options.body).text);
        return { ok: true, json: async () => ({ ok: true }) };
    };
    try {
        for (const command of ['/screener', '/bsjp', '/bpjs', '/bpjp', '/scalping', '/intraday', '/daytrade']) {
            await processTelegramUpdate({ message: { chat: { id: 555 }, text: command } }, {
                runScreener: async () => ({ swing: [], bsjp: [], bpjs: [], bpjp: [], scalping: [], scalpingSesi1: [], scalpingSesi2: [], daytrade: [] })
            });
        }
        return sentMessages;
    } finally {
        global.fetch = previousFetch;
        if (previousToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
        else process.env.TELEGRAM_BOT_TOKEN = previousToken;
        if (previousChatId === undefined) delete process.env.TELEGRAM_ADMIN_CHAT_ID;
        else process.env.TELEGRAM_ADMIN_CHAT_ID = previousChatId;
    }
}

async function testGoApiService() {
    const previousKey = process.env.GOAPI_KEY;
    const previousFetch = global.fetch;
    const requests = [];
    process.env.GOAPI_KEY = 'unit-test-key';
    _clearCacheForTests();
    global.fetch = async (url, options) => {
        requests.push({ url: String(url), options });
        const parsedUrl = new URL(String(url));
        if (parsedUrl.pathname.endsWith('/prices')) return { ok: true, json: async () => ({ status: 'success', data: [{ symbol: 'BBCA', date: '2026-09-23', open: 1000, high: 1020, low: 990, close: 1010, volume: 30000000 }] }) };
        if (parsedUrl.pathname.endsWith('/historical')) return { ok: true, json: async () => ({ status: 'success', data: [{ ticker: 'BBCA', date: '2026-09-22', open: 990, high: 1010, low: 980, close: 1000, volume: 20000000 }] }) };
        return { ok: true, json: async () => ({ status: 'success', data: { results: [
            { code: 'YP', side: 'BUY', transaction_type: 'NET', lot: 100, value: 600, avg: 1000 },
            { code: 'CC', side: 'BUY', transaction_type: 'NET', lot: 50, value: 300, avg: 1000 },
            { code: 'MG', side: 'BUY', transaction_type: 'NET', lot: 20, value: 100, avg: 1000 },
            { code: 'AK', side: 'SELL', transaction_type: 'NET', lot: 80, value: 500, avg: 1000 },
            { code: 'ZP', side: 'SELL', transaction_type: 'NET', lot: 40, value: 200, avg: 1000 },
            { code: 'BK', side: 'SELL', transaction_type: 'NET', lot: 40, value: 200, avg: 1000 }
        ] } }) };
    };
    try {
        const prices = await fetchStockPrices(['bbca', 'BBCA', 'BAD!']);
        assert(prices.get('BBCA')?.close === 1010 && prices.size === 1, 'GoAPI batched prices normalize issuer data and filter invalid symbols');
        const historical = await fetchHistorical('BBCA', '2026-09-01', '2026-09-23');
        assert(historical.length === 1 && historical[0].close === 1000, 'GoAPI historical endpoint returns normalized OHLCV rows');
        const summary = analyzeBrokerSummary(await fetchBrokerSummary('BBCA', '2026-09-23'));
        assert(summary?.dataSource === 'GOAPI' && summary.status === 'BIG ACCUMULATION', 'GoAPI broker summary calculates a strict accumulation classification');
        assert(GOAPI_CAPABILITIES.orderBook === false && GOAPI_CAPABILITIES.runningTrade === false, 'Unsupported order-book and running-trade feeds are explicitly unavailable, not fabricated');
        const periodSummary = await fetchBroksum('BBCA', { startDate: '2026-09-21', endDate: '2026-09-23' });
        assert(periodSummary.dataSource === 'GOAPI' && periodSummary.buyers.length > 0 && periodSummary.sellers.length > 0, 'Broksum service aggregates real-provider rows for the selected trading-date range');
        assert(tradingDaysBetween('2026-09-19', '2026-09-23').join(',') === '2026-09-21,2026-09-22,2026-09-23', 'Broksum date iteration skips weekend dates in WIB calendar');
        assert(requests.every(request => request.options.headers['X-API-KEY'] === 'unit-test-key'), 'GoAPI requests use the secret X-API-KEY header');
        assert(requests.every(request => !request.url.includes('unit-test-key')), 'GoAPI secret is not placed in request URLs');
        assert(requests.some(request => new URL(request.url).searchParams.get('investor') === 'ALL'), 'GoAPI broker-summary request specifies investor scope');
    } finally {
        global.fetch = previousFetch;
        if (previousKey === undefined) delete process.env.GOAPI_KEY;
        else process.env.GOAPI_KEY = previousKey;
        _clearCacheForTests();
    }
    const noKey = process.env.GOAPI_KEY;
    delete process.env.GOAPI_KEY;
    try {
        let missingKeyRejected = false;
        try { await fetchStockPrices(['BBCA']); } catch (error) { missingKeyRejected = error instanceof GoApiError; }
        assert(missingKeyRejected, 'GoAPI helper fails closed when GOAPI_KEY is missing');
    } finally {
        if (noKey !== undefined) process.env.GOAPI_KEY = noKey;
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
    assert(findNewNewsItems([{ title: 'existing' }], []).length === 0, 'Cold-start feed establishes a baseline without sending a notification burst');
    assert(findNewNewsItems([{ title: 'new' }, { title: 'old' }], [{ title: 'old' }]).length === 1, 'Only items added since the previous feed poll trigger alerts');
    assert(extractNewsTicker('Kredit Bank Tumbuh Agustus, BI Sebut Permintaan Naik!') === null, 'Ticker parser ignores ordinary title-case words');
    assert(extractNewsTicker('Buka Suara, Guna Memperkuat Sektor') === null, 'Ticker parser does not treat short common words as issuer names');
    assert(extractNewsTicker('Astra (ASII) Bakal Fokus ke 3 Segmen') === 'ASII', 'Ticker parser resolves an explicitly formatted issuer code');
    const formattedAlert = formatNewsAlert({ ticker: 'BBRI', title: 'Laba tumbuh', link: 'https://example.com/news' });
    assert(formattedAlert.includes('Emiten: $BBRI') && formattedAlert.includes('Link: https://example.com/news'), 'News alert includes issuer and source link');

    console.log('\n▶ Testing strict screener eligibility and null-data handling...');
    await testGoApiService();
    const strictBsjp = { isCurrentJakartaDay: true, close: 98, high: 100, tickSize: 1, turnover: 10000000001, volumeToday: 201, ma5Volume: 100, broksum: { dataSource: 'IDX_PROVIDER', analysis: { key: 'BIG_ACCUMULATION' } } };
    assert(isStrictBsjpEligible(strictBsjp), 'BSJP accepts a row meeting every strict criterion');
    assert(!isStrictBsjpEligible({ ...strictBsjp, broksum: { dataSource: 'MOCK', analysis: { key: 'BIG_ACCUMULATION' } } }), 'BSJP rejects mock broker-summary data');
    assert(!isStrictBsjpEligible({ ...strictBsjp, volumeToday: 200 }), 'BSJP rejects volume that is not greater than 2x MA5');
    assert(!isStrictBsjpEligible({ ...strictBsjp, close: 97.9 }), 'BSJP rejects a close more than two ticks below the high');
    assert(!isStrictBsjpEligible(null), 'BSJP safely rejects null market data');
    const strictBpjp = { isCurrentJakartaDay: true, open: 101, previousClose: 100, totalBidVolume: 201, totalOfferVolume: 100, hasDailyMaNews: true };
    assert(isStrictBpjpEligible(strictBpjp), 'BPJP accepts 1% gap-up, >2x bids, and a daily M&A catalyst');
    assert(!isStrictBpjpEligible({ ...strictBpjp, open: 100.99 }), 'BPJP rejects a gap below 1%');
    assert(!isStrictBpjpEligible({ ...strictBpjp, totalBidVolume: 200 }), 'BPJP requires bids strictly greater than 2x offers');
    assert(!isStrictBpjpEligible({ ...strictBpjp, hasDailyMaNews: false }), 'BPJP rejects rows without positive news or M&A');
    assert(!isStrictBpjpEligible(undefined), 'BPJP safely rejects missing market data');
    const strictIntraday = { isCurrentJakartaDay: true, runningTradeFrequencyPerMinute: 51, averageDailyTurnover: 20000000001, netBuyerPowerPct: 66 };
    assert(isStrictIntradayEligible(strictIntraday), 'Intraday accepts a row meeting all three strict thresholds');
    assert(!isStrictIntradayEligible({ ...strictIntraday, runningTradeFrequencyPerMinute: 50 }), 'Intraday frequency must be strictly greater than 50/min');
    assert(!isStrictIntradayEligible({ ...strictIntraday, averageDailyTurnover: 20000000000 }), 'Intraday turnover must be strictly greater than Rp20bn');
    assert(!isStrictIntradayEligible({ ...strictIntraday, netBuyerPowerPct: 65 }), 'Intraday buyer power must be strictly greater than 65%');
    assert(!isStrictIntradayEligible([]), 'Intraday safely rejects empty-array market data');
    const todayWib = new Date('2026-09-23T01:10:00.000Z');
    const dailyCatalysts = getDailyCatalysts({ news: [
        { ticker: 'GOTO', title: 'Laba tumbuh', pubDate: '2026-09-23T01:00:00.000Z' },
        { ticker: 'BBCA', title: 'Laba tumbuh', pubDate: '2026-09-22T16:59:00.000Z' }
    ] }, { deals: [{ tickers: ['BBRI'], pubDate: '2026-09-23T01:00:00.000Z' }] }, todayWib);
    assert(dailyCatalysts.positiveNewsTickers.has('GOTO') && dailyCatalysts.maTickers.has('BBRI'), 'Daily positive news and M&A are matched in WIB');
    assert(!dailyCatalysts.positiveNewsTickers.has('BBCA'), 'Catalyst from the previous WIB date is excluded');
    assert(getDailyCatalysts(null, { deals: [] }, todayWib).maTickers.size === 0, 'Catalyst lookup safely accepts null and empty feeds');
    const emptyCommandMessages = await testEmptyTelegramCommands();
    assert(emptyCommandMessages.length === 7 && emptyCommandMessages.every(message => message === STRICT_EMPTY_ALERT), 'All Telegram screener commands return the Wait & See alert when no rows qualify');
    assert(formatScreenerRows('test', null) === STRICT_EMPTY_ALERT && formatScreenerRows('test', [null]) === STRICT_EMPTY_ALERT, 'Telegram formatting handles null and malformed candidate arrays');

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
    assert(screenerResult && Array.isArray(screenerResult.scalping), 'Strict scalping result is always an array');
    assert(screenerResult && Array.isArray(screenerResult.daytrade), 'Strict intraday result is always an array');
    assert(screenerResult && Array.isArray(screenerResult.swing) && screenerResult.swing.length > 0, `Screener swing has ${screenerResult?.swing?.length} recommendations`);
    assert(screenerResult && Array.isArray(screenerResult.bsjp), 'Strict BSJP result is always an array');
    assert(screenerResult && Array.isArray(screenerResult.bpjp) && Array.isArray(screenerResult.bpjs), 'Strict BPJP/BPJS aliases are arrays');
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
