const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });
const { sanitizeTicker } = require('./utils');
const { ALL_IDX_STOCKS } = require('./searchService');

// Map stock sector for quick lookup
const STOCK_SECTOR_MAP = new Map();
if (Array.isArray(ALL_IDX_STOCKS)) {
    ALL_IDX_STOCKS.forEach(s => {
        if (s && s.ticker) {
            STOCK_SECTOR_MAP.set(s.ticker, s.sector || 'Emiten BEI');
        }
    });
}

// ── Watchlist Universe for Foreign Tracking ────────────────────────────────
// Focuses on high-liquidity big-caps, mid-caps, and active institutional targets
const FOREIGN_TRACKING_UNIVERSE = [
    'BBCA', 'BBRI', 'BMRI', 'BBNI', 'TLKM', 'ASII', 'AMMN', 'BREN', 'GOTO', 'BRPT',
    'UNVR', 'ICBP', 'INDF', 'KLBF', 'ADRO', 'PGAS', 'PTBA', 'UNTR', 'CPIN', 'MDKA',
    'ARTO', 'BRIS', 'EMTK', 'ESSA', 'EXCL', 'HRUM', 'INKP', 'INCO', 'ITMG', 'MAPI',
    'MBMA', 'MEDC', 'MTEL', 'TINS', 'TPIA', 'SMRA', 'BSDE', 'INDY', 'NCKL', 'ANTM',
    'AKRA', 'DSSA', 'CUAN', 'PANI', 'PTRO', 'BUMI', 'DEWA', 'ENRG', 'RAJA', 'BIPI',
    'FILM', 'SGER', 'ADMR', 'BBTN', 'BTPS', 'BJTM', 'BJBR', 'MYOR', 'SIDO', 'MIKA',
    'HEAL', 'SILO', 'CMRY', 'AMRT', 'MIDI', 'ERAA', 'AUTO', 'DRMA', 'SMSM', 'CTRA',
    'PWON', 'ASRI', 'SSIA', 'DMAS', 'WIKA', 'PTPP', 'ADHI', 'SMGR', 'INTP', 'TKIM',
    'AVIA', 'CLEO', 'JPFA', 'DSNG', 'TAPG', 'LSIP', 'AALI', 'SSMS', 'ELSA', 'BULL',
    'SMDR', 'TMAS', 'ASSA', 'BIRD', 'ISAT', 'TOWR', 'MAPA', 'BUKA', 'BRMS', 'PGEO',
    'ACES', 'AADI', 'DAAZ'
];

const UNIQUE_FOREIGN_UNIVERSE = Array.from(new Set(FOREIGN_TRACKING_UNIVERSE));

// In-Memory Cache
let foreignFlowCache = null;
let foreignFlowCacheTime = 0;
let foreignFlowInFlight = null;
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes
const YAHOO_REQUEST_TIMEOUT_MS = 3000;

// Estimated participation tiers used for a price/volume proxy, not reported foreign transactions.
const TIER_1_HEAVYWEIGHTS = new Set([
    'BBCA', 'BBRI', 'BMRI', 'BBNI', 'TLKM', 'ASII', 'AMMN', 'BREN'
]);

const TIER_2_CORE = new Set([
    'UNVR', 'ICBP', 'INDF', 'KLBF', 'ADRO', 'PGAS', 'PTBA', 'UNTR', 'MDKA', 'INKP',
    'INCO', 'ITMG', 'ISAT', 'TOWR', 'ANTM', 'BRIS', 'CPIN', 'SMGR', 'INTP', 'AKRA',
    'DSSA', 'EXCL', 'MBMA'
]);

const TIER_3_MIDCAPS = new Set([
    'MEDC', 'MTEL', 'TINS', 'TPIA', 'SMRA', 'BSDE', 'INDY', 'NCKL', 'PANI', 'PTRO',
    'FILM', 'SGER', 'ADMR', 'BBTN', 'BTPS', 'MYOR', 'SIDO', 'MIKA', 'HEAL', 'SILO',
    'CMRY', 'AMRT', 'MIDI', 'ERAA', 'AUTO', 'DRMA', 'SMSM', 'CTRA', 'PWON', 'ASRI',
    'SSIA', 'DMAS', 'WIKA', 'PTPP', 'ADHI', 'TKIM', 'AVIA', 'CLEO', 'JPFA', 'DSNG',
    'TAPG', 'LSIP', 'AALI', 'SSMS', 'ELSA', 'BULL', 'SMDR', 'TMAS', 'ASSA', 'BIRD',
    'MAPA', 'BUKA', 'BRMS', 'PGEO', 'ACES', 'AADI', 'DAAZ'
]);

const TIER_4_DOMESTIC = new Set([
    'BUMI', 'DEWA', 'ENRG', 'RAJA', 'BIPI', 'CUAN', 'BRPT', 'ARTO', 'EMTK', 'ESSA', 'HRUM'
]);

function getBaseForeignParticipation(ticker) {
    if (TIER_1_HEAVYWEIGHTS.has(ticker)) return 0.65; // Tier 1 (Heavyweights - 65% Base)
    if (TIER_2_CORE.has(ticker)) return 0.45;         // Tier 2 (Core Institutional - 45% Base)
    if (TIER_3_MIDCAPS.has(ticker)) return 0.30;      // Tier 3 (Active Mid-Caps - 30% Base)
    if (TIER_4_DOMESTIC.has(ticker)) return 0.15;     // Tier 4 (Domestic Speculative - 15% Base)
    return 0.15;                                      // Fallback for unlisted micro-caps (15% Base)
}

// ═══════════════════════════════════════════════════════════════
//  CORE ALGORITHM: Estimated Price/Volume Participation Proxy & Streak Engine
// ═══════════════════════════════════════════════════════════════
function processQuotesForForeignFlow(ticker, quotes, liveQuote = null) {
    const valid = quotes.filter(q => q && q.close !== null && q.high !== null && q.low !== null && q.volume !== null && !isNaN(q.close));
    if (valid.length < 15) return null;

    const n = valid.length;
    const sector = STOCK_SECTOR_MAP.get(ticker) || 'Bursa Efek Indonesia';
    const baseWeight = getBaseForeignParticipation(ticker);

    // Calculate rolling 20-day Average Daily Volume (ADV20) for volume surge tracking
    const recent20 = valid.slice(Math.max(0, n - 20));
    const avgVol20 = recent20.reduce((acc, q) => acc + (q.volume || 0), 0) / Math.max(1, recent20.length);

    // Calculate daily metrics for all historical bars
    const dailyMetrics = [];
    for (let i = 0; i < n; i++) {
        const curr = valid[i];
        const prev = i > 0 ? valid[i - 1] : curr;

        const close = curr.close;
        const open = curr.open || close;
        const prevClose = prev.close;
        const high = curr.high || close;
        const low = curr.low || close;
        const volume = curr.volume || 0;
        const volumeLot = Math.floor(volume / 100);
        const turnoverRp = volume * close;

        const dayReturn = prevClose > 0 ? (close - prevClose) / prevClose : 0;
        const bodyReturn = open > 0 ? (close - open) / open : 0;
        const range = high - low;
        const clv = range > 0 ? ((close - low) - (high - close)) / range : 0;
        const changePct = dayReturn * 100;

        // Balanced Direction Flow Model:
        // - Interday Price Return (55%): Weight calculated from daily price change percentage ((Close - PrevClose) / PrevClose)
        // - Intraday Candlestick Return (30%): Weight calculated from ((Close - Open) / Open)
        // - Intraday CLV Range Position (15%): CLV = ((Close - Low) - (High - Close)) / (High - Low). If High == Low, CLV = 0.
        const normDayReturn = Math.max(-1, Math.min(1, Math.tanh(dayReturn * 30)));
        const normBodyReturn = Math.max(-1, Math.min(1, Math.tanh(bodyReturn * 35)));
        const normClv = Math.max(-1, Math.min(1, clv));

        let trendForce = (normDayReturn * 0.55) + (normBodyReturn * 0.30) + (normClv * 0.15);
        if (range === 0 && dayReturn !== 0) {
            trendForce = normDayReturn * 0.85;
        }
        trendForce = Math.max(-0.95, Math.min(0.95, trendForce));

        // Volume Spike Multiplier (RVol): If daily volume >= 1.5x of 20-day SMA volume, scale participation up by 1.35x
        let effectiveParticipation = baseWeight;
        if (avgVol20 > 0 && volume >= 1.5 * avgVol20) {
            effectiveParticipation = baseWeight * 1.35;
        }
        effectiveParticipation = Math.min(0.90, Math.max(0.05, effectiveParticipation));

        const foreignTurnover = turnoverRp * effectiveParticipation;
        const buyShare = Math.min(0.95, Math.max(0.05, 0.50 + (0.50 * trendForce)));
        const sellShare = 1.0 - buyShare;

        let foreignBuyVal = Math.round(foreignTurnover * buyShare);
        let foreignSellVal = Math.round(foreignTurnover * sellShare);

        // HARD SAFETY GUARD:
        // Ensure calculated foreignBuyVal + foreignSellVal <= totalTurnover and foreignBuyVal / foreignSellVal never exceed total turnover
        if (foreignBuyVal + foreignSellVal > turnoverRp) {
            const scaleFactor = turnoverRp / (foreignBuyVal + foreignSellVal);
            foreignBuyVal = Math.floor(foreignBuyVal * scaleFactor);
            foreignSellVal = Math.floor(foreignSellVal * scaleFactor);
        }
        if (foreignBuyVal > turnoverRp) foreignBuyVal = turnoverRp;
        if (foreignSellVal > turnoverRp) foreignSellVal = turnoverRp;
        if (foreignBuyVal < 0) foreignBuyVal = 0;
        if (foreignSellVal < 0) foreignSellVal = 0;

        const netForeignVal = foreignBuyVal - foreignSellVal;

        const foreignBuyVol = close > 0 ? Math.round(foreignBuyVal / close / 100) : 0;
        const foreignSellVol = close > 0 ? Math.round(foreignSellVal / close / 100) : 0;
        const netForeignVol = foreignBuyVol - foreignSellVol;

        // Foreign Flow Pressure Index (FFPI): -100 to +100
        const ffpi = Math.max(-100, Math.min(100, Math.round(trendForce * 100)));

        dailyMetrics.push({
            date: curr.date,
            close,
            open,
            high,
            low,
            volumeLot,
            turnoverRp,
            changePct,
            clv: parseFloat(clv.toFixed(2)),
            effectiveParticipation,
            foreignBuyVal,
            foreignSellVal,
            netForeignVal,
            foreignBuyVol,
            foreignSellVol,
            netForeignVol,
            ffpi,
            isNetBuy: netForeignVal > 0
        });
    }

    const latest = dailyMetrics[dailyMetrics.length - 1];

    // ── 1. Harian (Daily 1D) ──────────────────────────────────────────
    let dailyStatus = 'PROXY NETRAL ⚪';
    if (latest.ffpi >= 50) dailyStatus = 'PROXY BELI KUAT 🔥';
    else if (latest.ffpi >= 20) dailyStatus = 'PROXY BELI 🟢';
    else if (latest.ffpi <= -50) dailyStatus = 'PROXY JUAL KUAT 🔴';
    else if (latest.ffpi <= -20) dailyStatus = 'PROXY JUAL 🔻';

    const daily = {
        ticker,
        sector,
        price: latest.close,
        currentPrice: latest.close,
        changePct: parseFloat(latest.changePct.toFixed(2)),
        volumeLot: latest.volumeLot,
        turnoverRp: latest.turnoverRp,
        foreignBuyVal: latest.foreignBuyVal,
        foreignSellVal: latest.foreignSellVal,
        netForeignVal: latest.netForeignVal,
        foreignBuyVol: latest.foreignBuyVol,
        foreignSellVol: latest.foreignSellVol,
        netForeignVol: latest.netForeignVol,
        ffpi: latest.ffpi,
        clv: latest.clv,
        estimatedParticipationPct: Math.round(latest.effectiveParticipation * 100),
        status: dailyStatus
    };

    // ── 2. Mingguan (Weekly 5D) ───────────────────────────────────────
    const last5 = dailyMetrics.slice(Math.max(0, n - 5));
    const weeklyNetVal = last5.reduce((acc, d) => acc + d.netForeignVal, 0);
    const weeklyBuyVal = last5.reduce((acc, d) => acc + d.foreignBuyVal, 0);
    const weeklySellVal = last5.reduce((acc, d) => acc + d.foreignSellVal, 0);
    const weeklyNetVol = last5.reduce((acc, d) => acc + d.netForeignVol, 0);
    const weeklyTurnover = last5.reduce((acc, d) => acc + d.turnoverRp, 0);
    const price5dAgo = last5[0].close;
    const weeklyPriceChgPct = price5dAgo > 0 ? ((latest.close - price5dAgo) / price5dAgo) * 100 : 0;

    // Previous 5-day chunk for Flow Acceleration calculation
    const prev5 = dailyMetrics.slice(Math.max(0, n - 10), Math.max(0, n - 5));
    const prevWeeklyNetVal = prev5.length > 0 ? prev5.reduce((acc, d) => acc + d.netForeignVal, 0) : 0;
    const flowAcceleration = prevWeeklyNetVal !== 0 ? ((weeklyNetVal - prevWeeklyNetVal) / Math.abs(prevWeeklyNetVal)) : 1.0;

    // Institutional Phase determination (supports both 'Markup Phase' and 'Mark-Up')
    let weeklyPhase = 'Konsolidasi / Neutral ⚪';
    if (weeklyNetVal > 0 && weeklyPriceChgPct >= 2.5) {
        weeklyPhase = 'Markup Phase 🚀';
    } else if (weeklyNetVal > 0 && weeklyPriceChgPct >= -1.0) {
        weeklyPhase = 'Re-Accumulation 📈';
    } else if (weeklyNetVal > 0 && weeklyPriceChgPct < -1.0) {
        weeklyPhase = 'Absorption (Serap Bawah) 🛡️';
    } else if (weeklyNetVal < 0 && weeklyPriceChgPct <= -2.5) {
        weeklyPhase = 'Markdown 🔻';
    } else if (weeklyNetVal < 0) {
        weeklyPhase = 'Distribution ⚠️';
    }

    const weekly = {
        ticker,
        sector,
        price: latest.close,
        currentPrice: latest.close,
        weeklyPriceChgPct: parseFloat(weeklyPriceChgPct.toFixed(2)),
        weeklyReturnPct: parseFloat(weeklyPriceChgPct.toFixed(2)),
        weeklyNetVal,
        weeklyBuyVal,
        weeklySellVal,
        weeklyNetVol,
        weeklyTurnover,
        flowAcceleration: parseFloat(flowAcceleration.toFixed(2)),
        phase: weeklyPhase,
        institutionalPhase: weeklyPhase,
        daysNetBuy: last5.filter(d => d.isNetBuy).length
    };

    // ── 3. Bulanan (Monthly 20D) ──────────────────────────────────────
    const last20 = dailyMetrics.slice(Math.max(0, n - 20));
    const monthlyNetVal = last20.reduce((acc, d) => acc + d.netForeignVal, 0);
    const monthlyBuyVal = last20.reduce((acc, d) => acc + d.foreignBuyVal, 0);
    const monthlySellVal = last20.reduce((acc, d) => acc + d.foreignSellVal, 0);
    const monthlyNetVol = last20.reduce((acc, d) => acc + d.netForeignVol, 0);
    const monthlyTurnover = last20.reduce((acc, d) => acc + d.turnoverRp, 0);
    const price20dAgo = last20[0].close;
    const monthlyPriceChgPct = price20dAgo > 0 ? ((latest.close - price20dAgo) / price20dAgo) * 100 : 0;

    // Foreign VWAP on positive inflow days
    const buyDays = last20.filter(d => d.netForeignVal > 0);
    let foreignVWAP = latest.close;
    if (buyDays.length > 0) {
        const totalBuyVal = buyDays.reduce((acc, d) => acc + d.foreignBuyVal, 0);
        const totalBuyVol = buyDays.reduce((acc, d) => acc + (d.foreignBuyVol * 100), 0);
        if (totalBuyVol > 0) foreignVWAP = Math.round(totalBuyVal / totalBuyVol);
    }
    const foreignFloatingPL = foreignVWAP > 0 ? ((latest.close - foreignVWAP) / foreignVWAP) * 100 : 0;

    let monthlyBaseScore = 50;
    const netBuyDays = last20.filter(d => d.isNetBuy).length;
    if (monthlyNetVal > 0) monthlyBaseScore += Math.min(45, Math.round(netBuyDays * 2.25));
    else monthlyBaseScore -= Math.min(40, Math.round((20 - netBuyDays) * 2.0));
    monthlyBaseScore = Math.max(10, Math.min(98, monthlyBaseScore));

    const monthly = {
        ticker,
        sector,
        price: latest.close,
        currentPrice: latest.close,
        monthlyPriceChgPct: parseFloat(monthlyPriceChgPct.toFixed(2)),
        monthlyReturnPct: parseFloat(monthlyPriceChgPct.toFixed(2)),
        monthlyNetVal,
        monthlyBuyVal,
        monthlySellVal,
        monthlyNetVol,
        monthlyTurnover,
        foreignVWAP,
        foreignFloatingPL: parseFloat(foreignFloatingPL.toFixed(2)),
        floatingPnlPct: parseFloat(foreignFloatingPL.toFixed(2)),
        baseScore: monthlyBaseScore,
        baseBuildingScore: monthlyBaseScore,
        daysNetBuy: netBuyDays,
        netBuyDays: netBuyDays
    };

    // ── 4. Streak Pembelian Emiten (Consecutive Inflow Days) ───────────
    let streakDays = 0;
    let streakTotalVal = 0;
    let streakTotalVol = 0;
    for (let i = dailyMetrics.length - 1; i >= 0; i--) {
        const bar = dailyMetrics[i];
        if (bar.netForeignVal > 0) {
            streakDays++;
            streakTotalVal += bar.netForeignVal;
            streakTotalVol += bar.netForeignVol;
        } else {
            break;
        }
    }

    let streakItem = null;
    if (streakDays >= 2) {
        const streakStartClose = dailyMetrics[dailyMetrics.length - streakDays].close;
        const streakPriceGain = streakStartClose > 0 ? ((latest.close - streakStartClose) / streakStartClose) * 100 : 0;
        const avgDailyInflow = Math.round(streakTotalVal / streakDays);

        // Momentum scoring & conviction rating
        let convictionBadge = 'Proxy Harga/Volume (2-3 Hari)';
        let momentumScore = Math.min(96, 62 + streakDays * 5);

        if (streakDays >= 7) {
            convictionBadge = 'Proxy Harga/Volume (≥ 7 Hari)';
            momentumScore = 98;
        } else if (streakDays >= 4) {
            convictionBadge = 'Proxy Harga/Volume (4-6 Hari)';
            momentumScore = 88;
        }

        let calculatedTrailingStop = Math.round(foreignVWAP * 0.965);
        // Safety check: Trailing stop MUST be below current price for Long entries
        // If calculatedTrailingStop >= currentPrice, fallback to currentPrice * 0.97
        if (latest.close > 0 && calculatedTrailingStop >= latest.close) {
            calculatedTrailingStop = Math.round(latest.close * 0.97);
        }
        if (calculatedTrailingStop <= 0 && latest.close > 0) {
            calculatedTrailingStop = Math.round(latest.close * 0.97);
        }

        const vwapZoneStr = `Rp ${Math.round(foreignVWAP * 0.99)} - Rp ${Math.round(foreignVWAP * 1.01)}`;

        streakItem = {
            ticker,
            sector,
            price: latest.close,
            currentPrice: latest.close,
            streakDays,
            streakTotalVal,
            streakTotalVol,

            // Dual-aliased properties for Streak Table:
            avgDailyInflow,
            streakAvgDailyVal: avgDailyInflow,

            streakPriceGain: parseFloat(streakPriceGain.toFixed(2)),
            streakGainPct: parseFloat(streakPriceGain.toFixed(2)),

            convictionRating: convictionBadge,
            convictionBadge,

            entryArea: vwapZoneStr,
            entryZone: vwapZoneStr,

            trailingStop: calculatedTrailingStop,

            momentumScore,
            foreignVWAP,

            flowMethod: 'Estimated price/volume proxy; not actual foreign investor transaction data'
        };
    }

    return {
        daily,
        weekly,
        monthly,
        streak: streakItem
    };
}

// ═══════════════════════════════════════════════════════════════
//  FETCH & AGGREGATE ALL FOREIGN FLOW DATA
// ═══════════════════════════════════════════════════════════════
async function computeAllForeignFlow(forceRefresh = false) {
    if (!forceRefresh && foreignFlowCache && (Date.now() - foreignFlowCacheTime < CACHE_TTL_MS)) {
        return foreignFlowCache;
    }
    if (foreignFlowInFlight) return foreignFlowInFlight;
    foreignFlowInFlight = computeForeignFlowSnapshot();
    try {
        return await foreignFlowInFlight;
    } finally {
        foreignFlowInFlight = null;
    }
}

async function computeForeignFlowSnapshot() {
    const dailyList = [];
    const weeklyList = [];
    const monthlyList = [];
    const streakList = [];

    const period1 = new Date(Date.now() - 60 * 24 * 3600 * 1000); // 60 days of historical data

    async function evaluateTicker(ticker) {
        try {
            const symbol = `${ticker}.JK`;
            const chart = await withTimeout(yahooFinance.chart(symbol, { period1, interval: '1d' }), YAHOO_REQUEST_TIMEOUT_MS, `Yahoo ${symbol}`);
            if (!chart || !chart.quotes || chart.quotes.length === 0) return;

            const res = processQuotesForForeignFlow(ticker, chart.quotes);
            if (res) {
                dailyList.push(res.daily);
                weeklyList.push(res.weekly);
                monthlyList.push(res.monthly);
                if (res.streak) streakList.push(res.streak);
            }
        } catch (e) {
            // gracefully skip individual errors to ensure resilience
        }
    }

    // Process in concurrency chunks of 25 for rapid processing
    const CHUNK_SIZE = 25;
    for (let i = 0; i < UNIQUE_FOREIGN_UNIVERSE.length; i += CHUNK_SIZE) {
        const chunk = UNIQUE_FOREIGN_UNIVERSE.slice(i, i + CHUNK_SIZE);
        await Promise.allSettled(chunk.map(t => evaluateTicker(t)));
    }

    // Sort Daily: Top Buy (positive NFF descending) & Top Sell (negative NFF ascending)
    const topBuyDaily = [...dailyList]
        .filter(d => d.netForeignVal > 0)
        .sort((a, b) => b.netForeignVal - a.netForeignVal)
        .slice(0, 15);

    const topSellDaily = [...dailyList]
        .filter(d => d.netForeignVal < 0)
        .sort((a, b) => a.netForeignVal - b.netForeignVal)
        .slice(0, 15);

    // Sort Weekly: Top Buy & Top Sell
    const topBuyWeekly = [...weeklyList]
        .filter(w => w.weeklyNetVal > 0)
        .sort((a, b) => b.weeklyNetVal - a.weeklyNetVal)
        .slice(0, 15);

    const topSellWeekly = [...weeklyList]
        .filter(w => w.weeklyNetVal < 0)
        .sort((a, b) => a.weeklyNetVal - b.weeklyNetVal)
        .slice(0, 15);

    // Sort Monthly: Top Buy & Top Sell
    const topBuyMonthly = [...monthlyList]
        .filter(m => m.monthlyNetVal > 0)
        .sort((a, b) => b.monthlyNetVal - a.monthlyNetVal)
        .slice(0, 15);

    const topSellMonthly = [...monthlyList]
        .filter(m => m.monthlyNetVal < 0)
        .sort((a, b) => a.monthlyNetVal - b.monthlyNetVal)
        .slice(0, 15);

    // Sort Streak: By longest streak days, then highest streak value
    const sortedStreak = [...streakList]
        .sort((a, b) => {
            if (b.streakDays !== a.streakDays) return b.streakDays - a.streakDays;
            return b.streakTotalVal - a.streakTotalVal;
        })
        .slice(0, 20);

    // Macro IHSG Foreign Flow Summary
    const totalDailyNetVal = dailyList.reduce((acc, d) => acc + d.netForeignVal, 0);
    const totalDailyBuyVal = dailyList.reduce((acc, d) => acc + (d.foreignBuyVal || 0), 0);
    const totalDailySellVal = dailyList.reduce((acc, d) => acc + (d.foreignSellVal || 0), 0);
    const totalDailyTurnover = dailyList.reduce((acc, d) => acc + d.turnoverRp, 0);

    const avgEstimatedParticipation = totalDailyTurnover > 0
        ? Math.round(((totalDailyBuyVal + totalDailySellVal) / (totalDailyTurnover * 2)) * 100)
        : 38;

    let macroSentiment = 'PROXY HARGA/VOLUME NETRAL ⚪';
    if (totalDailyNetVal > 250000000000) macroSentiment = 'PROXY AKUMULASI KUAT 🔥';
    else if (totalDailyNetVal > 40000000000) macroSentiment = 'PROXY NET BUY 🟢';
    else if (totalDailyNetVal < -250000000000) macroSentiment = 'PROXY DISTRIBUSI KUAT 🔴';
    else if (totalDailyNetVal < -40000000000) macroSentiment = 'PROXY NET SELL 🔻';

    const results = {
        macro: {
            totalNetForeignVal: totalDailyNetVal,
            totalForeignBuyVal: totalDailyBuyVal,
            totalForeignSellVal: totalDailySellVal,
            totalTurnover: totalDailyTurnover,
            estimatedParticipationPct: Math.min(65, Math.max(20, avgEstimatedParticipation)),
            dataDisclaimer: 'Estimasi proxy berbasis harga, volume, dan bobot partisipasi; bukan data transaksi atau kepemilikan investor asing aktual.',
            sentiment: macroSentiment,
            totalEmitenTracked: dailyList.length,
            timestamp: new Date().toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' }) + ' WIB'
        },
        daily: {
            topBuy: topBuyDaily,
            topSell: topSellDaily,
            all: dailyList
        },
        weekly: {
            topBuy: topBuyWeekly,
            topSell: topSellWeekly,
            all: weeklyList
        },
        monthly: {
            topBuy: topBuyMonthly,
            topSell: topSellMonthly,
            all: monthlyList
        },
        streak: {
            streaks: sortedStreak,
            totalActiveStreaks: sortedStreak.length
        },
        methodologyMetadata: {
            auditStatus: 'ESTIMATED_PROXY',
            model: 'Estimated Price/Volume Participation Proxy',
            dataDisclaimer: 'Estimasi, bukan data transaksi aktual investor asing.',
            timestamp: new Date().toISOString()
        }
    };

    foreignFlowCache = results;
    foreignFlowCacheTime = Date.now();
    return results;
}

function withTimeout(promise, timeoutMs, label) {
    let timer;
    return Promise.race([
        promise,
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs); })
    ]).finally(() => clearTimeout(timer));
}

// Single Ticker Foreign Flow Analytics for Modal & Detail Inspection
async function getTickerForeignFlow(ticker) {
    const clean = sanitizeTicker(ticker);
    try {
        const symbol = `${clean}.JK`;
        const period1 = new Date(Date.now() - 60 * 24 * 3600 * 1000);
        const chart = await withTimeout(yahooFinance.chart(symbol, { period1, interval: '1d' }), YAHOO_REQUEST_TIMEOUT_MS, `Yahoo ${symbol}`);
        if (!chart || !chart.quotes || chart.quotes.length === 0) return null;
        return processQuotesForForeignFlow(clean, chart.quotes);
    } catch (e) {
        return null;
    }
}

module.exports = {
    computeAllForeignFlow,
    getForeignFlowData: computeAllForeignFlow,
    getTickerForeignFlow,
    processQuotesForForeignFlow
};
