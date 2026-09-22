const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });
const { processTechnicalData, calcBullishConfidence, getTickSize } = require('../services/technicalService');

async function testSingle() {
    const period1 = new Date(Date.now() - 365 * 24 * 3600 * 1000);
    try {
        const chart = await yahooFinance.chart('BBRI.JK', { period1, interval: '1d' });
        console.log('Quotes length:', chart?.quotes?.length);
        const validQuotes = chart.quotes.filter(q => q && q.close !== null);
        const latest = validQuotes[validQuotes.length - 1];
        console.log('Latest quote:', latest);
        const volume = latest.volume ? Math.floor(latest.volume / 100) : 0;
        const value = latest.volume && latest.close ? (latest.volume * latest.close) : 0;
        console.log('Volume (lot):', volume, 'Value (Rp):', value);
        const trendData = processTechnicalData(chart.quotes);
        console.log('TrendData:', { rsi: trendData.rsi14, supertrend: trendData.supertrend, ema20: trendData.ema20, rvol: trendData.rvol });
    } catch (e) {
        console.error('Error:', e);
    }
}
testSingle();
