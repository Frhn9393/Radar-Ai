const assert = require('assert');

async function testForeignFlowEndpoints() {
    console.log('Testing Foreign Flow HTTP endpoints on http://localhost:3000');

    // 1. Full data
    const resAll = await fetch('http://localhost:3000/api/foreign-flow');
    assert(resAll.ok, 'GET /api/foreign-flow failed');
    const all = await resAll.json();
    assert(all.macro && all.daily && all.weekly && all.monthly && all.streak, 'Complete dataset missing keys');
    console.log('✅ GET /api/foreign-flow: OK, Emiten Tracked:', all.macro.totalEmitenTracked);

    // 2. Timeframe streak
    const resStreak = await fetch('http://localhost:3000/api/foreign-flow?timeframe=streak');
    assert(resStreak.ok, 'GET /api/foreign-flow?timeframe=streak failed');
    const streakData = await resStreak.json();
    assert(streakData.macro && streakData.streak && Array.isArray(streakData.streaks), 'Streak response invalid format');
    console.log('✅ GET /api/foreign-flow?timeframe=streak: OK, Active streaks:', streakData.streaks.length);

    // 3. Timeframe daily
    const resDaily = await fetch('http://localhost:3000/api/foreign-flow?timeframe=daily');
    assert(resDaily.ok, 'GET /api/foreign-flow?timeframe=daily failed');
    const dailyData = await resDaily.json();
    assert(dailyData.macro && dailyData.daily && Array.isArray(dailyData.topBuy), 'Daily response invalid format');
    console.log('✅ GET /api/foreign-flow?timeframe=daily: OK, Top Buy length:', dailyData.topBuy.length);

    // 4. Query ticker: ?ticker=BBCA
    const resTickerQuery = await fetch('http://localhost:3000/api/foreign-flow?ticker=BBCA');
    assert(resTickerQuery.ok, 'GET /api/foreign-flow?ticker=BBCA failed');
    const tickerQueryData = await resTickerQuery.json();
    assert.strictEqual(tickerQueryData.ticker, 'BBCA');
    assert(tickerQueryData.daily && tickerQueryData.weekly && tickerQueryData.monthly, 'Single ticker payload missing timeframe metrics');
    console.log('✅ GET /api/foreign-flow?ticker=BBCA: OK, Status:', tickerQueryData.daily.status);

    // 5. Param ticker: /api/foreign-flow/bmri.jk
    const resTickerParam = await fetch('http://localhost:3000/api/foreign-flow/bmri.jk');
    assert(resTickerParam.ok, 'GET /api/foreign-flow/bmri.jk failed');
    const tickerParamData = await resTickerParam.json();
    assert.strictEqual(tickerParamData.ticker, 'BMRI');
    console.log('✅ GET /api/foreign-flow/bmri.jk: OK, Status:', tickerParamData.daily.status);

    // 6. Test force refresh
    const resForce = await fetch('http://localhost:3000/api/foreign-flow?force=true');
    assert(resForce.ok, 'GET /api/foreign-flow?force=true failed');
    console.log('✅ GET /api/foreign-flow?force=true: OK');

    console.log('\n🎉 ALL HTTP ENDPOINT TESTS PASSED 100%!');
}

testForeignFlowEndpoints().catch(err => {
    console.error('❌ HTTP TEST ERROR:', err);
    process.exit(1);
});
