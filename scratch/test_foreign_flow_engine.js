const { computeAllForeignFlow, getTickerForeignFlow } = require('../services/foreignFlowService');
const { analyzeStock } = require('../services/stockService');

async function runTests() {
    console.log('====================================================');
    console.log('🧪 RUNNING COMPREHENSIVE FOREIGN FLOW TEST SUITE');
    console.log('====================================================');

    const startTime = Date.now();
    const data = await computeAllForeignFlow(true);
    const duration = Date.now() - startTime;
    console.log(`⏱️ Engine completed in ${duration}ms\n`);

    // 1. Macro Summary Validation
    console.log('1. MACRO SUMMARY:');
    console.log('   - Total Net Foreign:', data.macro.totalNetForeignVal);
    console.log('   - Total Foreign Buy:', data.macro.totalForeignBuyVal);
    console.log('   - Total Foreign Sell:', data.macro.totalForeignSellVal);
    console.log('   - Foreign Participation:', data.macro.foreignParticipationPct + '%');
    console.log('   - Sentiment:', data.macro.sentiment);
    console.log('   - Emiten Tracked:', data.macro.totalEmitenTracked);

    if (!data.macro.totalEmitenTracked || data.macro.totalEmitenTracked < 90) {
        throw new Error('FAILED: Emiten tracked count too low');
    }

    // 2. Daily Top Buy & Sell
    console.log('\n2. DAILY TOP BUY (Top 5):');
    data.daily.topBuy.slice(0, 5).forEach((d, i) => {
        console.log(`   #${i + 1} $${d.ticker} (${d.sector.split('/')[0].trim()}): Close Rp ${d.price} (${d.changePct}%) | Net: Rp ${(d.netForeignVal / 1e9).toFixed(1)}B (B: ${(d.foreignBuyVal / 1e9).toFixed(1)}B, S: ${(d.foreignSellVal / 1e9).toFixed(1)}B) | FFPI: ${d.ffpi} | ${d.status}`);
    });

    console.log('\n   DAILY TOP SELL (Top 5):');
    data.daily.topSell.slice(0, 5).forEach((d, i) => {
        console.log(`   #${i + 1} $${d.ticker} (${d.sector.split('/')[0].trim()}): Close Rp ${d.price} (${d.changePct}%) | Net: Rp ${(d.netForeignVal / 1e9).toFixed(1)}B (B: ${(d.foreignBuyVal / 1e9).toFixed(1)}B, S: ${(d.foreignSellVal / 1e9).toFixed(1)}B) | FFPI: ${d.ffpi} | ${d.status}`);
    });

    // 3. Weekly Summary
    console.log('\n3. WEEKLY (5D) SUMMARY:');
    console.log('   - Weekly total items:', data.weekly.all.length);
    console.log('   - Top Weekly Buy #1:', data.weekly.topBuy[0].ticker, 'Net 5D: Rp ' + (data.weekly.topBuy[0].weeklyNetVal / 1e9).toFixed(1) + 'B', 'Phase:', data.weekly.topBuy[0].phase);

    // 4. Monthly Summary
    console.log('\n4. MONTHLY (20D) SUMMARY:');
    console.log('   - Monthly total items:', data.monthly.all.length);
    console.log('   - Top Monthly Buy #1:', data.monthly.topBuy[0].ticker, 'Net 20D: Rp ' + (data.monthly.topBuy[0].monthlyNetVal / 1e9).toFixed(1) + 'B', 'VWAP:', 'Rp ' + data.monthly.topBuy[0].foreignVWAP, 'Float P/L:', data.monthly.topBuy[0].foreignFloatingPL + '%');

    // 5. Streak Summary
    console.log('\n5. STREAK PEMBELIAN EMITEN (Total: ' + data.streak.streaks.length + ' emiten):');
    data.streak.streaks.slice(0, 5).forEach((s, i) => {
        console.log(`   #${i + 1} $${s.ticker} (${s.streakDays} Hari): Total Inflow Rp ${(s.streakTotalVal / 1e9).toFixed(1)}B | Avg: Rp ${(s.avgDailyInflow / 1e9).toFixed(1)}B/day | Gain: ${s.streakPriceGain}% | Conviction: ${s.convictionBadge} | Entry: ${s.entryArea} | Stop: Rp ${s.trailingStop} | WinRate: ${s.backtestWinRate}`);
    });

    // 6. Single Ticker Analytics
    console.log('\n6. TESTING SINGLE TICKER (BBCA & BMRI):');
    const bbcaFF = await getTickerForeignFlow('BBCA');
    console.log('   - BBCA FF:', {
        price: bbcaFF.daily.price,
        chg: bbcaFF.daily.changePct,
        fBuy: (bbcaFF.daily.foreignBuyVal / 1e9).toFixed(1) + 'B',
        fSell: (bbcaFF.daily.foreignSellVal / 1e9).toFixed(1) + 'B',
        netVal: (bbcaFF.daily.netForeignVal / 1e9).toFixed(1) + 'B',
        status: bbcaFF.daily.status
    });

    const bmriFF = await getTickerForeignFlow('BMRI');
    console.log('   - BMRI FF:', {
        price: bmriFF.daily.price,
        chg: bmriFF.daily.changePct,
        fBuy: (bmriFF.daily.foreignBuyVal / 1e9).toFixed(1) + 'B',
        fSell: (bmriFF.daily.foreignSellVal / 1e9).toFixed(1) + 'B',
        netVal: (bmriFF.daily.netForeignVal / 1e9).toFixed(1) + 'B',
        status: bmriFF.daily.status
    });

    // 7. Full Stock Analysis Integration
    console.log('\n7. TESTING ANALYZE STOCK INTEGRATION:');
    const fullAnalysis = await analyzeStock('BMRI');
    console.log('   - BMRI full analysis contains foreignFlow:', !!fullAnalysis.foreignFlow);
    console.log('   - BMRI foreignFlow status:', fullAnalysis.foreignFlow.daily.status);

    console.log('\n✅ ALL BACKEND FOREIGN FLOW TESTS PASSED PERFECTLY!');
}

runTests().catch(err => {
    console.error('❌ TEST FAILED:', err);
    process.exit(1);
});
