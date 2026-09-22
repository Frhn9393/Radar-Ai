const assert = require('assert');
const { computeAllForeignFlow, getTickerForeignFlow, processQuotesForForeignFlow } = require('../services/foreignFlowService');

async function testRequirements() {
    console.log('--- 1. Testing Tier Participation & Fallback ---');
    // Mock quotes
    function generateQuotes(close, prevClose, open, high, low, volume) {
        const quotes = [];
        for (let i = 0; i < 25; i++) {
            quotes.push({
                date: new Date(Date.now() - (25 - i) * 86400000),
                open: i === 24 ? open : 1000,
                high: i === 24 ? high : 1050,
                low: i === 24 ? low : 950,
                close: i === 24 ? close : (i === 23 ? prevClose : 1000),
                volume: i === 24 ? volume : 100000
            });
        }
        return quotes;
    }

    // Tier 1 (65% base)
    const bbcaRes = processQuotesForForeignFlow('BBCA', generateQuotes(1000, 1000, 1000, 1000, 1000, 100000));
    assert.strictEqual(bbcaRes.daily.foreignParticipationPct, 65, 'BBCA (Tier 1) should have 65% base participation');

    // Tier 2 (45% base)
    const unvrRes = processQuotesForForeignFlow('UNVR', generateQuotes(1000, 1000, 1000, 1000, 1000, 100000));
    assert.strictEqual(unvrRes.daily.foreignParticipationPct, 45, 'UNVR (Tier 2) should have 45% base participation');

    // Tier 3 (30% base)
    const medcRes = processQuotesForForeignFlow('MEDC', generateQuotes(1000, 1000, 1000, 1000, 1000, 100000));
    assert.strictEqual(medcRes.daily.foreignParticipationPct, 30, 'MEDC (Tier 3) should have 30% base participation');

    // Tier 4 (15% base)
    const bumiRes = processQuotesForForeignFlow('BUMI', generateQuotes(1000, 1000, 1000, 1000, 1000, 100000));
    assert.strictEqual(bumiRes.daily.foreignParticipationPct, 15, 'BUMI (Tier 4) should have 15% base participation');

    // Unlisted ticker fallback (15% base)
    const unknownRes = processQuotesForForeignFlow('UNKNOWNXYZ', generateQuotes(1000, 1000, 1000, 1000, 1000, 100000));
    assert.strictEqual(unknownRes.daily.foreignParticipationPct, 15, 'Unknown ticker fallback should have 15% base participation');

    console.log('✅ 1. All 4 Tiers and Fallback verified perfectly!');

    console.log('\n--- 2. Testing Volume Spike Multiplier (RVol >= 1.5x -> 1.35x) ---');
    // Normal volume = 100,000. Spike volume = 200,000 (2.0x >= 1.5x)
    // For Tier 3 (base 0.30): 0.30 * 1.35 = 0.405 -> Math.round is 41%
    const spikeRes = processQuotesForForeignFlow('MEDC', generateQuotes(1000, 1000, 1000, 1000, 1000, 200000));
    assert.strictEqual(spikeRes.daily.foreignParticipationPct, 41, 'Volume spike should scale participation by 1.35x (30% -> 41%)');
    console.log('✅ 2. Volume Spike Multiplier verified!');

    console.log('\n--- 3. Testing Direction Formula & Hard Safety Guard ---');
    // Test Hard Safety Guard
    // When turnover is small or large, buyVal + sellVal <= turnover
    const safetyRes = processQuotesForForeignFlow('BBCA', generateQuotes(5000, 4800, 4900, 5100, 4850, 500000));
    assert(safetyRes.daily.foreignBuyVal + safetyRes.daily.foreignSellVal <= safetyRes.daily.turnoverRp, 'foreignBuyVal + foreignSellVal MUST NOT exceed turnoverRp');
    assert(safetyRes.daily.foreignBuyVal <= safetyRes.daily.turnoverRp, 'foreignBuyVal MUST NOT exceed turnoverRp');
    assert(safetyRes.daily.foreignSellVal <= safetyRes.daily.turnoverRp, 'foreignSellVal MUST NOT exceed turnoverRp');
    console.log('✅ 3. Hard Safety Guard verified!');

    console.log('\n--- 4. Testing Streak Dual-Property Aliasing & Trailing Stop Safety ---');
    const allData = await computeAllForeignFlow(true);
    assert(allData.streak && Array.isArray(allData.streak.streaks), 'Streaks array must exist');
    console.log(`   Found ${allData.streak.streaks.length} active streaks.`);

    allData.streak.streaks.forEach((item, idx) => {
        // Dual-aliased properties
        assert.strictEqual(item.avgDailyInflow, item.streakAvgDailyVal, `Item #${idx} avgDailyInflow matches streakAvgDailyVal`);
        assert.strictEqual(item.streakPriceGain, item.streakGainPct, `Item #${idx} streakPriceGain matches streakGainPct`);
        assert.strictEqual(item.convictionRating, item.convictionBadge, `Item #${idx} convictionRating matches convictionBadge`);
        assert.strictEqual(item.entryArea, item.entryZone, `Item #${idx} entryArea matches entryZone`);
        assert.strictEqual(item.backtestWinRate, item.backtest.winRate, `Item #${idx} backtestWinRate matches backtest.winRate`);
        assert.strictEqual(item.profitFactor, item.backtest.profitFactor, `Item #${idx} profitFactor matches backtest.profitFactor`);

        // Trailing stop safety check
        assert(item.trailingStop < item.currentPrice, `Item #${idx} $${item.ticker} trailing stop (${item.trailingStop}) MUST be below current price (${item.currentPrice})`);
    });
    console.log('✅ 4. Dual-Property Aliases & Trailing Stop Safety Guard verified for all streaks!');

    console.log('\n🎉 ALL REFACTORING REQUIREMENTS VERIFIED 100% SUCCESSFUL!');
}

testRequirements().catch(e => {
    console.error('❌ Requirement test failed:', e);
    process.exit(1);
});
