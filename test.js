// Radar-AI Automated Test Suite
const { sanitizeTicker } = require('./services/utils');
const { search_stocks } = require('./services/searchService');
const { get_stock_price, get_market_indices } = require('./services/marketDataService');
const { get_technical_indicators } = require('./services/technicalService');
const { fetch_market_news, fetch_ma_deals, extractNewsTicker } = require('./services/newsService');
const { classifyNewsSentiment, findNewNewsItems, formatNewsAlert } = require('./services/newsAlertService');
const { isStrictBsjpEligible, isStrictBpjpEligible, isStrictIntradayEligible } = require('./services/strictScreenerFilters');
const { processTelegramUpdate, formatScreenerRows, STRICT_EMPTY_ALERT } = require('./services/telegramWebhookService');
const { fetchBrokerTop, requestBrokerTop, parseStockbitResponse, _clearCacheForTests } = require('./services/customMarketFeed');
const { fetchBroksum } = require('./services/broksumService');
const { analyzeStock, runScreener, hasUsableRealtimeData } = require('./services/stockService');

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

async function testStockbitFeed() {
    const previousToken = process.env.SEKURITAS_AUTH_TOKEN;
    const previousFetch = global.fetch;
    const requests = [];
    process.env.SEKURITAS_AUTH_TOKEN = 'unit-test-bearer';
    _clearCacheForTests();
    global.fetch = async (url, options) => {
        requests.push({ url: String(url), options });
        const parsedUrl = new URL(String(url));
        assert(parsedUrl.origin === 'https://exodus.stockbit.com' && parsedUrl.pathname === '/order-trade/broker/top', 'Stockbit feed uses the configured broker-top endpoint');
        return { ok: true, status: 200, json: async () => ({ data: {
            symbol: 'BBCA', date: '2026-09-23',
            brokers_buy: [
                { code: 'YP', net_value: 600, lot: 100, avg_price: 1000 },
                { code: 'CC', net_value: 300, lot: 50, avg_price: 1000 },
                { code: 'MG', net_value: 100, lot: 20, avg_price: 1000 }
            ],
            brokers_sell: [
                { code: 'AK', net_value: 500, lot: 80, avg_price: 1000 },
                { code: 'ZP', net_value: 200, lot: 40, avg_price: 1000 },
                { code: 'BK', net_value: 200, lot: 40, avg_price: 1000 }
            ],
            order_book: { total_bid_volume: 300, total_offer_volume: 100 },
            running_trade_frequency_per_minute: 60,
            average_daily_turnover: 21_000_000_000
        } }) };
    };
    try {
        const feed = await fetchBrokerTop('bbca');
        assert(feed?.dataSource === 'STOCKBIT' && feed.ticker === 'BBCA' && feed.status === 'BIG ACCUMULATION', 'Stockbit broker feed parses real-schema data and classifies accumulation');
        assert(feed?.orderBook?.totalBidVolume === 300 && feed.runningTradeFrequencyPerMinute === 60, 'Stockbit microstructure metrics are normalized for strict strategy filters');
        assert(requests[0].options.headers.Authorization === 'Bearer unit-test-bearer', 'Stockbit requests use the Bearer Authorization header');
        assert(!requests[0].url.includes('unit-test-bearer'), 'Stockbit bearer token is never placed in the request URL');
        assert(new URL(requests[0].url).searchParams.get('symbol') === 'BBCA', 'Stockbit broker-top request is scoped to the validated ticker');
        const periodSummary = await fetchBroksum('BBCA', { startDate: '2026-09-22', endDate: '2026-09-23' });
        assert(periodSummary.dataSource === 'STOCKBIT' && periodSummary.buyers.length > 0 && periodSummary.sellers.length > 0, 'Broksum route response maps Stockbit buyers and sellers');
        assert(parseStockbitResponse({ data: { symbol: 'BBRI', brokers_buy: [], brokers_sell: [] } }, 'BBCA') === null, 'Stockbit feed rejects a response for a different issuer');
        assert(parseStockbitResponse({ data: { brokers_buy: [], brokers_sell: [] } }, 'BBCA') === null, 'Stockbit feed rejects broker data without issuer identity');
    } finally {
        global.fetch = previousFetch;
        if (previousToken === undefined) delete process.env.SEKURITAS_AUTH_TOKEN;
        else process.env.SEKURITAS_AUTH_TOKEN = previousToken;
        _clearCacheForTests();
    }
    const token = process.env.SEKURITAS_AUTH_TOKEN;
    delete process.env.SEKURITAS_AUTH_TOKEN;
    try {
        assert(await fetchBrokerTop('BBCA') === null, 'Stockbit feed fails closed when Bearer token is missing');
        const emptyResponse = await fetchBroksum('BBCA', { startDate: '2026-09-22', endDate: '2026-09-23' });
        assert(emptyResponse.dataSource === 'STOCKBIT_UNAVAILABLE' && emptyResponse.buyers.length === 0, 'Missing token returns empty broksum arrays for UI Wait & See');
    } finally {
        if (token !== undefined) process.env.SEKURITAS_AUTH_TOKEN = token;
    }

    process.env.SEKURITAS_AUTH_TOKEN = 'invalid-test-bearer';
    global.fetch = async () => ({ ok: false, status: 401 });
    try {
        assert(await fetchBrokerTop('BBCA') === null, 'Stockbit 401/expired token returns empty data instead of throwing');
    } finally {
        global.fetch = previousFetch;
        if (previousToken === undefined) delete process.env.SEKURITAS_AUTH_TOKEN;
        else process.env.SEKURITAS_AUTH_TOKEN = previousToken;
        _clearCacheForTests();
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
    const { generateScreenerSignal } = require('./services/backtestEngine');
    const historicalBars = Array.from({ length: 20 }, (_, index) => ({ date: `2026-01-${String(index + 1).padStart(2, '0')}`, open: 100, high: 105, low: 99, close: index === 19 ? 104 : 100, volume: index === 19 ? 200 : 100 }));
    assert(generateScreenerSignal('DAYTRADE', historicalBars, 19), 'Historical screener backtest recognizes >3% range and >1.8x volume signal');
    assert(!generateScreenerSignal('DAYTRADE', historicalBars.map((bar, index) => index === 19 ? { ...bar, volume: 180 } : bar), 19), 'Historical screener backtest respects strict volume threshold');
    assert(generateScreenerSignal('SWING', historicalBars.map((bar, index) => ({ ...bar, high: 110, close: index === 19 ? 106 : 100 })), 19), 'Historical swing backtest uses only available moving-average and volume data');

    console.log('\n▶ Testing strict screener eligibility and null-data handling...');
    const strictBsjp = { isCurrentJakartaDay: true, close: 98, high: 100, tickSize: 1, volumeToday: 151, ma5Volume: 100, rsi: 60 };
    assert(isStrictBsjpEligible(strictBsjp), 'BSJP accepts Yahoo candle, 1.5x volume spike, and RSI 50-70');
    assert(isStrictBsjpEligible({ ...strictBsjp, broksum: null }), 'BSJP does not require broker-summary data');
    assert(!isStrictBsjpEligible({ ...strictBsjp, volumeToday: 150 }), 'BSJP requires volume strictly greater than 1.5x MA5');
    assert(!isStrictBsjpEligible({ ...strictBsjp, rsi: 49.9 }), 'BSJP rejects RSI below 50');
    assert(!isStrictBsjpEligible({ ...strictBsjp, rsi: 70.1 }), 'BSJP rejects RSI above 70');
    assert(!isStrictBsjpEligible({ ...strictBsjp, close: 97.9 }), 'BSJP rejects a close more than two ticks below the high');
    assert(!isStrictBsjpEligible(null), 'BSJP safely rejects null market data');
    const strictBpjp = { isCurrentJakartaDay: true, open: 101, previousClose: 100, close: 103 };
    assert(isStrictBpjpEligible(strictBpjp), 'BPJP accepts 1% gap-up with bullish candle without order-book/news data');
    assert(!isStrictBpjpEligible({ ...strictBpjp, open: 100.99 }), 'BPJP rejects a gap below 1%');
    assert(!isStrictBpjpEligible({ ...strictBpjp, open: 104 }), 'BPJP rejects a gap above 3%');
    assert(!isStrictBpjpEligible({ ...strictBpjp, close: 100 }), 'BPJP rejects a non-bullish candle when change is not above 2%');
    assert(isStrictBpjpEligible({ ...strictBpjp, close: 102.01 }), 'BPJP accepts change greater than 2%');
    assert(!isStrictBpjpEligible(undefined), 'BPJP safely rejects missing market data');
    const strictIntraday = { isCurrentJakartaDay: true, high: 104, low: 100, volumeToday: 181, ma5Volume: 100 };
    assert(isStrictIntradayEligible(strictIntraday), 'Scalping/Daytrade accepts >3% daily volatility and >1.8x MA5 volume');
    assert(!isStrictIntradayEligible({ ...strictIntraday, high: 103 }), 'Scalping/Daytrade requires volatility strictly above 3%');
    assert(!isStrictIntradayEligible({ ...strictIntraday, volumeToday: 180 }), 'Scalping/Daytrade requires volume strictly above 1.8x MA5');
    assert(!isStrictIntradayEligible([]), 'Intraday safely rejects empty-array market data');
    assert(!isStrictBsjpEligible({ ...strictBsjp, isCurrentJakartaDay: false }), 'BSJP rejects stale Yahoo daily candle');
    assert(!isStrictBpjpEligible({ ...strictBpjp, isCurrentJakartaDay: false }), 'BPJP rejects stale Yahoo daily candle');
    assert(!isStrictIntradayEligible({ ...strictIntraday, isCurrentJakartaDay: false }), 'Scalping/Daytrade rejects stale Yahoo daily candle');
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
    const validModalQuote = { lastPrice: 100, high: 105, low: 95, volume: 1000 };
    assert(hasUsableRealtimeData(validModalQuote), 'Detail modal accepts complete, positive OHLCV quote data');
    assert(!hasUsableRealtimeData({ ...validModalQuote, lastPrice: 0 }), 'Detail modal rejects zero last price');
    assert(!hasUsableRealtimeData({ ...validModalQuote, lastPrice: null }), 'Detail modal rejects null last price');
    assert(!hasUsableRealtimeData({ ...validModalQuote, high: null }), 'Detail modal rejects missing OHLC data');
    assert(!hasUsableRealtimeData({ ...validModalQuote, volume: 0 }), 'Detail modal rejects missing/zero market volume');
    assert(hasUsableRealtimeData({ ...validModalQuote, volume: 0 }, { allowZeroVolume: true }), 'Market index quotes may legitimately have no traded volume');
    assert(!hasUsableRealtimeData({ ...validModalQuote, high: 90, low: 95 }), 'Detail modal rejects inconsistent high/low range');
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
