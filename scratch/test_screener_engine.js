const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });
const { processTechnicalData, calcBullishConfidence } = require('../services/technicalService');
const { getTickSize } = require('../services/utils');

const WATCHLIST_UNIVERSE = [
    'BBCA', 'BBRI', 'BMRI', 'BBNI', 'TLKM', 'ASII', 'AMMN', 'BREN', 'GOTO', 'BRPT',
    'UNVR', 'ICBP', 'INDF', 'KLBF', 'ADRO', 'PGAS', 'PTBA', 'UNTR', 'CPIN', 'MDKA',
    'ARTO', 'BRIS', 'EMTK', 'ESSA', 'EXCL', 'HRUM', 'INKP', 'INCO', 'ITMG', 'MAPI',
    'MBMA', 'MEDC', 'MTEL', 'TINS', 'TPIA', 'SMRA', 'BSDE', 'INDY', 'NCKL', 'ANTM', 'AKRA',
    'DSSA', 'CUAN', 'PANI', 'PTRO', 'BUMI', 'DEWA', 'ENRG', 'RAJA', 'BIPI', 'FILM',
    'SGER', 'ADMR', 'BBTN', 'BTPS', 'MYOR', 'SIDO', 'MIKA', 'HEAL', 'SILO', 'CMRY',
    'AMRT', 'MIDI', 'ERAA', 'AUTO', 'DRMA', 'SMSM', 'CTRA', 'PWON', 'ASRI', 'SSIA',
    'SMGR', 'INTP', 'TKIM', 'AVIA', 'CLEO', 'ROTI', 'JPFA', 'MAIN', 'TAPG', 'LSIP',
    'ELSA', 'SMDR', 'TMAS', 'ASSA', 'BIRD', 'WIFI', 'MTDL', 'MLPT', 'SRTG', 'DOID'
];

async function testEngine() {
    const candidates = {
        scalpingSesi1: [],
        scalpingSesi2: [],
        daytrade: [],
        swing: [],
        bsjp: [],
        bpjp: [],
        longterm: []
    };

    const period1 = new Date(Date.now() - 365 * 24 * 3600 * 1000);

    const evaluateTicker = async (ticker) => {
        try {
            const chart = await yahooFinance.chart(`${ticker}.JK`, { period1, interval: '1d' });
            if (!chart || !chart.quotes || chart.quotes.length < 20) return;

            const trendData = processTechnicalData(chart.quotes);
            const validQuotes = chart.quotes.filter(q => q && q.close !== null);
            const latest = validQuotes[validQuotes.length - 1];
            const prev = validQuotes.length > 1 ? validQuotes[validQuotes.length - 2] : latest;

            const price = latest.close;
            const prevClose = prev.close;
            const high = latest.high || price;
            const low = latest.low || price;
            const volume = latest.volume ? Math.floor(latest.volume / 100) : 0;
            const value = latest.volume && price ? (latest.volume * price) : 0;
            const changePct = prevClose > 0 ? (((price - prevClose) / prevClose) * 100) : 0;
            const intraRange = low > 0 ? (((high - low) / low) * 100) : 0;

            // Liquidity filter: min 1 Miliar turnover & min price 50
            if (value < 1000000000 || price < 50 || intraRange > 35) return;

            const { confidence, label } = calcBullishConfidence(price, trendData, changePct, value, intraRange);
            const tick = getTickSize(price);
            const isSupertrendBullish = trendData.supertrend?.isBullish;
            const supertrendBadge = isSupertrendBullish ? 'ST Bullish 🟢' : 'ST Bearish 🔴';
            const rvol = trendData.rvol || 1.0;
            const rvolBadge = `RVol: ${rvol.toFixed(1)}x`;
            const pullbackFromHigh = high > 0 ? (((high - price) / high) * 100) : 0;
            const macdBullish = trendData.macd_line !== null && trendData.macd_signal !== null && trendData.macd_line > trendData.macd_signal;
            const rsi = trendData.rsi14 || 50;
            const adx = trendData.adx14 || 15;
            const ema20 = trendData.ema20 || price;
            const ema50 = trendData.ema50 || price;
            const ema200 = trendData.ema200 || (price * 0.95);

            // 1. SCALPING CANDIDATES
            let scalpScore = (intraRange * 3) + (rvol * 15) + (changePct > 0 ? changePct * 2 : -5) + (confidence * 0.5);
            if (value >= 5000000000) scalpScore += 10;
            if (isSupertrendBullish) scalpScore += 8;

            const antreanBeliSesi1 = `Antre Bid Rp ${(price - tick).toLocaleString('id-ID')} - Rp ${price.toLocaleString('id-ID')} (Bid 1-2)`;
            const tpSesi1 = Math.round(price + Math.max(2 * tick, Math.round(price * 0.02)));
            const slSesi1 = Math.round(price - Math.max(2 * tick, Math.round(price * 0.012)));

            candidates.scalpingSesi1.push({
                score: scalpScore,
                item: {
                    ticker, price, changePct: changePct.toFixed(2),
                    range: intraRange.toFixed(2),
                    antreanBeli: antreanBeliSesi1,
                    jamEksekusi: '09:00 - 09:30 WIB',
                    targetProfit: tpSesi1,
                    stopLoss: slSesi1,
                    supertrendBadge, rvolBadge, confidence, label
                }
            });

            if (pullbackFromHigh <= 5.0) {
                const antreanBeliSesi2 = `Antre Bid Rp ${(price - 2 * tick).toLocaleString('id-ID')} - Rp ${(price - tick).toLocaleString('id-ID')} (Bid 2-3)`;
                const tpSesi2 = Math.round(price + Math.max(3 * tick, Math.round(price * 0.025)));
                const slSesi2 = Math.round(price - Math.max(2 * tick, Math.round(price * 0.015)));

                candidates.scalpingSesi2.push({
                    score: scalpScore - (pullbackFromHigh * 2),
                    item: {
                        ticker, price, changePct: changePct.toFixed(2),
                        range: intraRange.toFixed(2),
                        antreanBeli: antreanBeliSesi2,
                        jamEksekusi: '13:30 - 14:15 WIB',
                        targetProfit: tpSesi2,
                        stopLoss: slSesi2,
                        supertrendBadge, rvolBadge, confidence, label
                    }
                });
            }

            // 2. DAYTRADE CANDIDATES
            let dayScore = (confidence * 0.8) + (rvol * 12) + (changePct * 2);
            if (isSupertrendBullish) dayScore += 15;
            if (price >= ema20) dayScore += 10;
            if (macdBullish) dayScore += 8;
            if (rsi >= 45 && rsi <= 72) dayScore += 10;

            candidates.daytrade.push({
                score: dayScore,
                item: {
                    ticker, price, changePct: changePct.toFixed(2),
                    entryZone: `${(price * 0.992).toFixed(0)} - ${price}`,
                    targetProfit: (price * 1.035).toFixed(0),
                    stopLoss: (price * 0.985).toFixed(0),
                    supertrendBadge, rvolBadge, confidence, label
                }
            });

            // 3. SWING TRADE CANDIDATES
            const distEma20 = (price - ema20) / ema20;
            let swingScore = (confidence * 0.6) + (adx * 1.2);
            if (ema20 >= ema50) swingScore += 15;
            if (price >= ema20) swingScore += 12;
            if (distEma20 >= -0.02 && distEma20 <= 0.06) swingScore += 15; // sweet spot near ema20
            if (rsi >= 42 && rsi <= 65) swingScore += 12;
            if (isSupertrendBullish) swingScore += 10;

            candidates.swing.push({
                score: swingScore,
                item: {
                    ticker, price, changePct: changePct.toFixed(2),
                    areaBuy: `${(ema20 * 0.985).toFixed(0)} - ${(ema20 * 1.015).toFixed(0)}`,
                    targetPrice1: (price * 1.08).toFixed(0),
                    targetPrice2: (price * 1.15).toFixed(0),
                    cutLoss: (ema50 * 0.96).toFixed(0),
                    riskReward: "1:3",
                    supertrendBadge, rvolBadge, confidence, label
                }
            });

            // 4. BSJP (Beli Sore Jual Pagi)
            // Strategy: close strong, low pullback from high, steady accumulation
            let bsjpScore = 0;
            if (pullbackFromHigh <= 2.5) bsjpScore += 30;
            else if (pullbackFromHigh <= 5.0) bsjpScore += 18;
            else bsjpScore += 5;

            if (changePct >= 1.0 && changePct <= 8.0) bsjpScore += 25;
            else if (changePct >= 0.0) bsjpScore += 15;

            if (rvol >= 1.1) bsjpScore += 20;
            else if (rvol >= 0.9) bsjpScore += 10;

            if (rsi >= 48 && rsi <= 72) bsjpScore += 15;
            if (isSupertrendBullish || price >= ema20) bsjpScore += 15;
            bsjpScore += (confidence * 0.3);

            candidates.bsjp.push({
                score: bsjpScore,
                item: {
                    ticker, price, changePct: changePct.toFixed(2),
                    rsi: rsi.toFixed(1),
                    pullbackFromHigh: pullbackFromHigh.toFixed(2),
                    beliSore: `Sesi II (14:30-15:00) ≤ ${price}`,
                    targetPagi: (price * 1.025).toFixed(0),
                    stopLoss: (low * 0.99).toFixed(0),
                    estimasiGain: '1.5-3%',
                    riskReward: '1:2',
                    supertrendBadge, rvolBadge, confidence, label
                }
            });

            // 5. BPJP (Beli Pagi Jual Pagi / Sore)
            // Strategy: oversold rebound or morning momentum recovery
            let bpjpScore = 0;
            let rsiStatus = 'Morning Momentum 🚀';
            if (rsi <= 45) {
                rsiStatus = rsi < 35 ? 'Deep Oversold ⚡' : 'Oversold Bounce 🔄';
                bpjpScore += (50 - rsi) * 2.5; // lower RSI = higher oversold bounce potential
                if (macdBullish || (trendData.macd_hist !== null && trendData.macd_hist >= -0.8)) bpjpScore += 20;
            } else {
                bpjpScore += (rvol * 15) + (changePct > 0 ? changePct * 2 : 0);
            }
            if (adx >= 20) bpjpScore += 10;
            bpjpScore += (confidence * 0.4);

            candidates.bpjp.push({
                score: bpjpScore,
                item: {
                    ticker, price, changePct: changePct.toFixed(2),
                    rsi: rsi.toFixed(1),
                    rsiStatus,
                    adx: adx.toFixed(1),
                    macd: trendData.macd_line ? trendData.macd_line.toFixed(2) : 'N/A',
                    entryPagi: `Opening (09:00-09:30) ≤ ${price}`,
                    target: (price * 1.028).toFixed(0),
                    stopLoss: (price * 0.985).toFixed(0),
                    jualSebelum: '12:00 WIB',
                    estimasiGain: '2-3.5%',
                    supertrendBadge, rvolBadge, confidence, label
                }
            });

            // 6. INVESTASI JANGKA PANJANG (Golden Alignment)
            let ltScore = 0;
            if (trendData.ema200 && trendData.ema50 && trendData.ema20) {
                if (trendData.ema20 > trendData.ema50) ltScore += 20;
                if (trendData.ema50 > trendData.ema200) ltScore += 25;
                if (price > trendData.ema200) ltScore += 25;
                if (rsi >= 42 && rsi <= 65) ltScore += 15;
            } else if (price > ema200) {
                ltScore += 30;
            }
            if (value >= 5000000000) ltScore += 15;
            if (isSupertrendBullish) ltScore += 15;
            ltScore += (confidence * 0.3);

            candidates.longterm.push({
                score: ltScore,
                item: {
                    ticker, price, changePct: changePct.toFixed(2),
                    rsi: rsi.toFixed(1),
                    ema200: ema200.toFixed(0),
                    support: (ema200 * 0.98).toFixed(0),
                    targetKonservatif: (price * 1.20).toFixed(0),
                    targetAgresif: (price * 1.40).toFixed(0),
                    cutLoss: (ema200 * 0.93).toFixed(0),
                    horizon: '6-12 Bulan',
                    sinyalEntri: isSupertrendBullish ? 'Golden Alignment + ST ✓' : 'Trend Support Rebound',
                    supertrendBadge, confidence, label
                }
            });
        } catch (e) {}
    };

    // Run parallel
    const CHUNK_SIZE = 25;
    for (let i = 0; i < WATCHLIST_UNIVERSE.length; i += CHUNK_SIZE) {
        const chunk = WATCHLIST_UNIVERSE.slice(i, i + CHUNK_SIZE);
        await Promise.allSettled(chunk.map(t => evaluateTicker(t)));
    }

    const rankAndPickTop3 = (list) => {
        return list
            .sort((a, b) => b.score - a.score)
            .slice(0, 3)
            .map((c, idx) => ({
                ...c.item,
                rank: idx + 1,
                rankBadge: idx === 0 ? '🥇 #1 REKOMENDASI' : idx === 1 ? '🥈 #2 REKOMENDASI' : '🥉 #3 REKOMENDASI'
            }));
    };

    const finalResults = {
        scalpingSesi1: rankAndPickTop3(candidates.scalpingSesi1),
        scalpingSesi2: rankAndPickTop3(candidates.scalpingSesi2),
        daytrade: rankAndPickTop3(candidates.daytrade),
        swing: rankAndPickTop3(candidates.swing),
        bsjp: rankAndPickTop3(candidates.bsjp),
        bpjp: rankAndPickTop3(candidates.bpjp),
        longterm: rankAndPickTop3(candidates.longterm),
    };

    console.log('=== RESULTS SUMMARY ===');
    for (const key of Object.keys(finalResults)) {
        console.log(`${key} (Count: ${finalResults[key].length}):`, finalResults[key].map(x => `${x.ticker} (#${x.rank} conf:${x.confidence}%)`).join(', '));
    }
}

testEngine();
