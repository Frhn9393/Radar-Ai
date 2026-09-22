// ============================================================
//  AUTOMATED QUANTITATIVE BACKTEST VERIFICATION SUITE
// ============================================================

const { runBacktest, getAvailableStrategies, quickAudit } = require('../services/backtestEngine');

async function verifyBacktestEngine() {
    console.log('════════════════════════════════════════════════════════════════');
    console.log('       RADAR-AI AUTOMATED BACKTEST QUANT VERIFICATION SUITE     ');
    console.log('════════════════════════════════════════════════════════════════\n');

    // 1. Verify Available Strategies
    console.log('▶ [1/4] Verifying Strategy Registry...');
    const strategies = getAvailableStrategies();
    if (strategies.length < 5) {
        throw new Error(`Expected at least 5 strategies, found ${strategies.length}`);
    }
    console.log(`  ✅ Verified ${strategies.length} quantitative strategies loaded.`);

    // 2. Verify Composite Quant on BBCA
    console.log('\n▶ [2/4] Executing Backtest: BBCA with Composite Quant (1 Year)...');
    const startBbca = Date.now();
    const bbcaResult = await runBacktest({
        ticker: 'BBCA',
        strategyKey: 'COMPOSITE_QUANT',
        period: '1y',
        initialCapital: 100000000
    });
    const bbcaDuration = Date.now() - startBbca;

    console.log(`  ⏱️ Backtest executed in ${bbcaDuration}ms`);
    console.log(`  - Total Trades: ${bbcaResult.metrics.totalTrades}`);
    console.log(`  - Win Rate: ${bbcaResult.metrics.winRate}`);
    console.log(`  - Profit Factor: ${bbcaResult.metrics.profitFactor}`);
    console.log(`  - Strategy Net Return: ${bbcaResult.metrics.netReturnPct}`);
    console.log(`  - Benchmark (B&H): ${bbcaResult.metrics.benchmarkReturnPct}`);
    console.log(`  - Max Drawdown: ${bbcaResult.metrics.maxDrawdown}`);
    console.log(`  - Equity Curve Points: ${bbcaResult.equityCurve.length}`);

    if (typeof bbcaResult.metrics.totalTrades !== 'number' || bbcaResult.metrics.totalTrades < 0) {
        throw new Error('Invalid totalTrades metric');
    }
    if (!Array.isArray(bbcaResult.tradeLog)) {
        throw new Error('Expected tradeLog to be an array');
    }
    if (!Array.isArray(bbcaResult.equityCurve) || bbcaResult.equityCurve.length === 0) {
        throw new Error('Expected equityCurve to have data points');
    }
    console.log('  ✅ BBCA Composite Quant verification PASSED!');

    // 3. Verify Other Strategies (Supertrend, RSI Oversold, Volume Breakout)
    console.log('\n▶ [3/4] Executing Multi-Strategy Multi-Ticker Stress Test...');
    const testCases = [
        { ticker: 'TINS', strategyKey: 'SUPERTREND_SWING', period: '1y' },
        { ticker: 'BBRI', strategyKey: 'RSI_DIP_BUYER', period: '1y' },
        { ticker: 'PTRO', strategyKey: 'VOLUME_BREAKOUT', period: '6m' },
        { ticker: 'MEDC', strategyKey: 'FOREIGN_FLOW_STREAK', period: '1y' }
    ];

    for (const tc of testCases) {
        const res = await runBacktest(tc);
        console.log(`  - $${res.ticker} [${res.strategy.name}]: ${res.metrics.totalTrades} trades | WinRate: ${res.metrics.winRate} | Net: ${res.metrics.netReturnPct} | PF: ${res.metrics.profitFactor}`);
        if (typeof res.finalEquity !== 'number' || isNaN(res.finalEquity)) {
            throw new Error(`Invalid finalEquity for ${tc.ticker}`);
        }
    }
    console.log('  ✅ Multi-Strategy stress test PASSED!');

    // 4. Verify Quick Audit Function
    console.log('\n▶ [4/4] Verifying Quick Audit Service...');
    const audit = await quickAudit('BMRI');
    console.log(`  - Quick Audit $${audit.ticker}: WinRate ${audit.winRate}, PF ${audit.profitFactor}, Return ${audit.netReturn}`);
    if (!audit.winRate || !audit.profitFactor) {
        throw new Error('Invalid quickAudit response');
    }
    console.log('  ✅ Quick Audit verification PASSED!');

    console.log('\n════════════════════════════════════════════════════════════════');
    console.log('🎉 ALL AUTOMATED BACKTEST ENGINE TESTS PASSED WITH 100% SUCCESS!');
    console.log('════════════════════════════════════════════════════════════════');
}

verifyBacktestEngine().catch(err => {
    console.error('❌ BACKTEST VERIFICATION ERROR:', err);
    process.exit(1);
});
