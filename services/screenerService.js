const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'], queue: { concurrency: 40 } });

const { calcBullishConfidence, processTechnicalData } = require('./technicalService');
const { ALL_IDX_STOCKS } = require('./searchService');
const { getTickSize } = require('./utils');
const { formatJakartaDate } = require('./dateTime');
const { sendTelegramAlert } = require('./telegramService');
const { claimAlert, releaseAlert } = require('./alertDedupeStore');
const { isStrictBsjpEligible, isStrictBpjpEligible, isStrictIntradayEligible, isScalpingOpeningSurgeEligible, isBullishIntradaySurgeEligible } = require('./strictScreenerFilters');
const { analyzeCandlesticks } = require('./candlestickAiEngine');
const { formatScreenerAlertBatch } = require('./screenerAlertFormatter');

const STOCK_SECTOR_MAP = new Map();
if (Array.isArray(ALL_IDX_STOCKS)) {
    ALL_IDX_STOCKS.forEach(s => {
        if (s && s.ticker) {
            STOCK_SECTOR_MAP.set(s.ticker, s.sector || 'Emiten BEI');
        }
    });
}

// ═══════════════════════════════════════════════════════════════
//  ULTRA-FAST HIGH-LIQUIDITY SCREENER ENGINE (< 3s)
// ═══════════════════════════════════════════════════════════════
let screenerCache = null;
let screenerCacheTime = 0;
const SCREENER_CACHE_TTL = 3 * 60 * 1000; // 3 minutes
const YAHOO_SCREEN_TIMEOUT_MS = 3800;
const previousAlertSignals = new Set();
let screenerInFlight = null;

const WATCHLIST_UNIVERSE = [
    // ── Bluechip & Top Tier LQ45 / Kompas100 ─────────────────────────────
    'BBCA', 'BBRI', 'BMRI', 'BBNI', 'TLKM', 'ASII', 'AMMN', 'BREN', 'GOTO', 'BRPT',
    'UNVR', 'ICBP', 'INDF', 'KLBF', 'ADRO', 'PGAS', 'PTBA', 'UNTR', 'CPIN', 'MDKA',
    'ARTO', 'BRIS', 'EMTK', 'ESSA', 'EXCL', 'HRUM', 'INKP', 'INCO', 'ITMG', 'MAPI',
    'MBMA', 'MEDC', 'MTEL', 'TINS', 'TPIA', 'SMRA', 'BSDE', 'INDY', 'NCKL', 'ANTM', 'AKRA',

    // ── High Momentum & Super Liquid Active ──────────────────────────────
    'DSSA', 'CUAN', 'PANI', 'PTRO', 'BUMI', 'DEWA', 'ENRG', 'RAJA', 'BIPI', 'FILM',
    'SGER', 'ADMR', 'BBTN', 'BTPS', 'BJTM', 'BJBR', 'MYOR', 'SIDO', 'MIKA', 'HEAL',
    'SILO', 'CMRY', 'AMRT', 'MIDI', 'ERAA', 'AUTO', 'DRMA', 'SMSM', 'CTRA', 'PWON',
    'ASRI', 'SSIA', 'DMAS', 'KOTA', 'BSBK', 'WIKA', 'PTPP', 'ADHI', 'WEGE', 'SMGR',
    'INTP', 'TKIM', 'SPMA', 'MARK', 'PBID', 'AVIA', 'CLEO', 'ROTI', 'JPFA', 'MAIN',
    'CPRO', 'DSNG', 'TAPG', 'LSIP', 'AALI', 'SSMS', 'SGRO', 'BWPT', 'TBLA', 'ELSA',
    'HATM', 'LEAD', 'BULL', 'SMDR', 'TMAS', 'ASSA', 'BIRD', 'GIAA', 'IPCC', 'IPCM',
    'WIFI', 'WIRG', 'MTDL', 'MLPT', 'DCII', 'EDGE', 'DATA', 'AWAN', 'ELIT', 'CYBR',
    'BBHI', 'BBYB', 'BANK', 'AGRO', 'PNBN', 'BNGA', 'BDMN', 'NISP', 'SRTG', 'SMMA',
    'PNLF', 'BFIN', 'CFIN', 'HRTA', 'PSAB', 'ARCI', 'DKFT', 'NICL', 'TOTO', 'VKTR',
    'SLIS', 'DOID', 'BSSR', 'MBAP', 'GEMS', 'MYOH', 'RMKE', 'TOBA', 'ISAT', 'TOWR',
    'MAPA', 'BUKA', 'BRMS', 'PGEO', 'ACES', 'KIJA', 'APLN', 'LPKR', 'LPCK',
    'ALII', 'NEST', 'DAAZ', 'BOAT', 'AADI', 'LABA', 'UNTD', 'AREA', 'MSJA', 'BLES'
];

const UNIQUE_WATCHLIST = Array.from(new Set(WATCHLIST_UNIVERSE));

function isTodayInJakarta(value, now = new Date()) {
    const timestamp = value instanceof Date ? value : new Date(value);
    return Number.isFinite(timestamp.getTime()) && formatJakartaDate(timestamp) === formatJakartaDate(now);
}

function roundToTick(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    const tick = getTickSize(numeric);
    return Math.round(numeric / tick) * tick;
}

function calculateSwingRiskReward(areaBuyLow, areaBuyHigh, targetPrice1, cutLoss) {
    const low = Number(areaBuyLow);
    const high = Number(areaBuyHigh);
    const target = Number(targetPrice1);
    const stop = Number(cutLoss);
    const avgEntry = (low + high) / 2;
    const risk = avgEntry - stop;
    const reward = target - avgEntry;
    const ratio = risk > 0 ? reward / risk : 0;
    return {
        avgEntry,
        risk,
        reward,
        ratio,
        valid: Number.isFinite(ratio) && risk > 0 && reward > 0 && ratio >= 1,
        label: `1:${Number.isFinite(ratio) ? ratio.toFixed(2) : '0.00'}`
    };
}

function getTechnicalStatus(isSupertrendBullish, rsi, fallbackLabel) {
    if (!isSupertrendBullish && Number(rsi) < 35) return 'Technical Rebound Setup';
    return fallbackLabel;
}

async function runScreener(options = {}) {
    if (screenerCache && Date.now() - screenerCacheTime < SCREENER_CACHE_TTL) {
        if (screenerInFlight) {
            return screenerInFlight;
        }
        if (options.sendAlerts !== false) triggerScreenerAlerts(screenerCache);
        return screenerCache;
    }
    if (screenerInFlight) {
        return screenerInFlight;
    }

    const task = runScreenerFresh({ ...options, sendAlerts: false });
    screenerInFlight = task;
    try {
        const results = await task;
        if (options.sendAlerts !== false) triggerScreenerAlerts(results);
        return results;
    } finally {
        if (screenerInFlight === task) screenerInFlight = null;
    }
}

function triggerScreenerAlerts(results) {
    if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_ADMIN_CHAT_ID) return;
    const alertCategories = [
        ['BSJP', results.allCandidates?.bsjp], ['BPJS', results.allCandidates?.bpjs],
        ['SCALPING', results.allCandidates?.scalpingSesi1], ['DAYTRADE', results.allCandidates?.daytrade]
    ];
    const currentSignals = new Set();
    const newlyQualified = [];
    for (const [strategy, rows] of alertCategories) {
        for (const row of Array.isArray(rows) ? rows : []) {
            const key = `${formatJakartaDate()}|${strategy}|${row.ticker}`;
            currentSignals.add(key);
            if (!previousAlertSignals.has(key)) newlyQualified.push({ key, strategy, row });
        }
    }
    previousAlertSignals.clear();
    currentSignals.forEach(key => previousAlertSignals.add(key));
    if (!newlyQualified.length) return;
    const alertTask = (async () => {
        const claimedSignals = [];
        for (const signal of newlyQualified) {
            const dedupeKey = `signal:${signal.key}`;
            if (await claimAlert(dedupeKey)) claimedSignals.push({ ...signal, dedupeKey });
        }
        if (!claimedSignals.length) return;
        try {
            const delivered = await sendTelegramAlert(formatScreenerAlertBatch(claimedSignals));
            if (!delivered) {
                for (const { key, dedupeKey } of claimedSignals) {
                    previousAlertSignals.delete(key);
                    await releaseAlert(dedupeKey);
                }
            }
        } catch (error) {
            for (const { key, dedupeKey } of claimedSignals) {
                previousAlertSignals.delete(key);
                await releaseAlert(dedupeKey).catch(() => {});
            }
            throw error;
        }
    })().catch(error => console.error('[screener-alert] Telegram delivery failed:', error.message || error));
    try { require('@vercel/functions').waitUntil(alertTask); } catch { alertTask.catch(() => {}); }
}

async function runScreenerFresh(options = {}) {
    const candidates = {
        scalpingSesi1: [],
        scalpingSesi2: [],
        daytrade: [],
        candlestickAi: [],
        swing: [],
        bsjp: [],
        bpjp: [],
        bpjs: [],
        longterm: []
    };

    const period1 = new Date(Date.now() - 365 * 24 * 3600 * 1000);

    let successfulTickerFetches = 0;
    async function evaluateTicker(ticker, signal) {
        try {
            const symbol = `${ticker}.JK`;
            const chart = await yahooFinance.chart(symbol, { period1, interval: '1d' }, { fetchOptions: { signal } });
            if (!chart || !chart.quotes || chart.quotes.length < 20) return;
            successfulTickerFetches++;

            const trendData = processTechnicalData(chart.quotes);
            const validQuotes = chart.quotes.filter(q => q && q.close !== null);
            const candlestickAi = analyzeCandlesticks(validQuotes);
            const latest = validQuotes[validQuotes.length - 1];
            const prev = validQuotes.length > 1 ? validQuotes[validQuotes.length - 2] : latest;
            const priorFiveVolumes = validQuotes.slice(-6, -1).map(quote => Number(quote.volume)).filter(volumeValue => Number.isFinite(volumeValue) && volumeValue > 0);
            const ma5Volume = priorFiveVolumes.length === 5
                ? priorFiveVolumes.reduce((sum, volumeValue) => sum + volumeValue, 0) / 5
                : null;
            const price = latest.close;
            const prevClose = prev.close;
            const openPrice = latest.open;
            const high = latest.high || price;
            const low = latest.low || price;
            const volume = latest.volume ? Math.floor(latest.volume / 100) : 0; // Lot
            const value = latest.volume && price ? (latest.volume * price) : 0;
            const changePct = prevClose > 0 ? (((price - prevClose) / prevClose) * 100) : 0;
            const intraRange = low > 0 ? (((high - low) / low) * 100) : 0;

            // ─── FILTER LIKUIDITAS & HARGA ──────────────────────────────
            if (value < 1000000000 || price < 50 || intraRange > 35) {
                return;
            }

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

            const sector = STOCK_SECTOR_MAP.get(ticker) || 'Bursa Efek Indonesia';
            if (candlestickAi.patterns.length) {
                candidates.candlestickAi.push({
                    score: candlestickAi.confidencePct || 0,
                    item: { ticker, price, candlestickAi, candlestick: trendData.candlestick?.pattern || 'Netral' }
                });
            }
            const smartMoney = trendData.smartMoney || { score: 0, status: 'DATA TIDAK TERSEDIA', badge: 'Smart Money: N/A' };
            const pivots = trendData.pivots?.classic || null;
            const candlestick = trendData.candlestick?.pattern || 'N/A';
            const technicalStatus = getTechnicalStatus(isSupertrendBullish, rsi, label);
            const strictQuoteToday = isTodayInJakarta(latest.date);
            const bpjpGapPct = prevClose > 0 ? ((openPrice - prevClose) / prevClose) * 100 : null;
            const strictIntradayMetrics = {
                isCurrentJakartaDay: strictQuoteToday,
                high,
                low,
                volumeToday: latest.volume,
                ma5Volume
            };
            const strictIntradayEligible = isStrictIntradayEligible(strictIntradayMetrics);

            // 1. SCALPING CANDIDATES (Sesi 1 & Sesi 2)
            let scalpScore = (intraRange * 3) + (rvol * 15) + (changePct > 0 ? changePct * 2 : -5) + (confidence * 0.5);
            if (value >= 5000000000) scalpScore += 10;
            if (isSupertrendBullish) scalpScore += 8;
            if (smartMoney.score >= 70) scalpScore += 10;

            const antreanBeliSesi1 = `Antre Bid Rp ${(price - tick).toLocaleString('id-ID')} - Rp ${price.toLocaleString('id-ID')} (Bid 1-2)`;
            const tpSesi1 = Math.round(price + Math.max(2 * tick, Math.round(price * 0.02)));
            const slSesi1 = Math.round(price - Math.max(2 * tick, Math.round(price * 0.012)));

            if (isScalpingOpeningSurgeEligible(strictIntradayMetrics, changePct)) candidates.scalpingSesi1.push({
                score: scalpScore,
                item: {
                    ticker, sector, price, changePct: changePct.toFixed(2),
                    range: intraRange.toFixed(2),
                    antreanBeli: antreanBeliSesi1,
                    jamEksekusi: '09:00 - 09:30 WIB',
                    targetProfit: tpSesi1,
                    stopLoss: slSesi1,
                    supertrendBadge, rvolBadge, confidence, label,
                    smartMoney, pivots, candlestick,
                    }
            });

            if (pullbackFromHigh <= 5.0) {
                const antreanBeliSesi2 = `Antre Bid Rp ${(price - 2 * tick).toLocaleString('id-ID')} - Rp ${(price - tick).toLocaleString('id-ID')} (Bid 2-3)`;
                const tpSesi2 = Math.round(price + Math.max(3 * tick, Math.round(price * 0.025)));
                const slSesi2 = Math.round(price - Math.max(2 * tick, Math.round(price * 0.015)));

                if (isBullishIntradaySurgeEligible(strictIntradayMetrics, changePct)) candidates.scalpingSesi2.push({
                    score: scalpScore - (pullbackFromHigh * 2),
                    item: {
                        ticker, sector, price, changePct: changePct.toFixed(2),
                        range: intraRange.toFixed(2),
                        antreanBeli: antreanBeliSesi2,
                        jamEksekusi: '13:30 - 14:15 WIB',
                        targetProfit: tpSesi2,
                        stopLoss: slSesi2,
                        supertrendBadge, rvolBadge, confidence, label,
                        smartMoney, pivots, candlestick,
                        }
                });
            }

            // 2. DAYTRADE CANDIDATES (Momentum Bullish)
            let dayScore = (confidence * 0.8) + (rvol * 12) + (changePct * 2);
            if (isSupertrendBullish) dayScore += 15;
            if (price >= ema20) dayScore += 10;
            if (macdBullish) dayScore += 8;
            if (rsi >= 45 && rsi <= 72) dayScore += 10;
            if (smartMoney.score >= 70) dayScore += 10;

            const dayEntryLow = Math.round(price * 0.992);
            const dayEntryHigh = Math.round(price);
            const dayTarget = Math.round(price * 1.035);
            const dayStop = Math.round(price * 0.985);
            const dayTradePricesValid = dayStop < dayEntryLow && dayTarget > dayEntryHigh;

            if (isBullishIntradaySurgeEligible(strictIntradayMetrics, changePct) && dayTradePricesValid) candidates.daytrade.push({
                score: dayScore,
                item: {
                    ticker, sector, price, changePct: changePct.toFixed(2),
                    entryZoneLow: dayEntryLow, entryZoneHigh: dayEntryHigh,
                    entryZone: `${dayEntryLow} - ${dayEntryHigh}`,
                    targetProfit: dayTarget,
                    stopLoss: dayStop,
                    supertrendBadge, rvolBadge, confidence, label: technicalStatus,
                    smartMoney, pivots, candlestick,
                    }
            });

            // 3. SWING TRADE CANDIDATES (Multi-Day Breakout / Trend Pullback)
            const distEma20 = (price - ema20) / ema20;
            let swingScore = (confidence * 0.6) + (adx * 1.2);
            if (ema20 >= ema50) swingScore += 15;
            if (price >= ema20) swingScore += 12;
            if (distEma20 >= -0.02 && distEma20 <= 0.06) swingScore += 15;
            if (rsi >= 42 && rsi <= 65) swingScore += 12;
            if (isSupertrendBullish) swingScore += 10;
            if (smartMoney.score >= 65) swingScore += 10;

            const swingAreaLow = Math.round(ema20 * 0.985);
            const swingAreaHigh = Math.round(ema20 * 1.015);
            const swingTarget1 = Math.round(price * 1.08);
            const swingTarget2 = Math.round(price * 1.15);
            const swingCutLoss = Math.round(ema50 * 0.96);
            const swingRR = calculateSwingRiskReward(swingAreaLow, swingAreaHigh, swingTarget1, swingCutLoss);

            // Do not recommend setups where the defined reward does not cover the risk.
            if (swingRR.valid && swingAreaLow > swingCutLoss && swingAreaHigh >= price * 0.95 && swingAreaLow <= price * 1.05) {
                candidates.swing.push({
                score: swingScore,
                item: {
                    ticker, sector, price, changePct: changePct.toFixed(2),
                    areaBuyLow: swingAreaLow, areaBuyHigh: swingAreaHigh,
                    areaBuy: `${swingAreaLow} - ${swingAreaHigh}`,
                    targetPrice1: swingTarget1,
                    targetPrice2: swingTarget2,
                    cutLoss: swingCutLoss,
                    risk: swingRR.risk, reward: swingRR.reward,
                    riskReward: swingRR.label,
                    supertrendBadge, rvolBadge, confidence, label: technicalStatus,
                    smartMoney, pivots, candlestick,
                    }
                });
            }

            // 4. BSJP (Beli Sore Jual Pagi)
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
            if (smartMoney.score >= 70) bsjpScore += 15;
            bsjpScore += (confidence * 0.3);

            if (isStrictBsjpEligible({
                isCurrentJakartaDay: strictQuoteToday,
                close: latest.close,
                high: latest.high,
                tickSize: getTickSize(latest.high),
                volumeToday: latest.volume,
                ma5Volume,
                rsi
            })) candidates.bsjp.push({
                score: bsjpScore,
                item: {
                    ticker, sector, price, changePct: changePct.toFixed(2),
                    rsi: rsi.toFixed(1),
                    pullbackFromHigh: pullbackFromHigh.toFixed(2),
                    beliSore: `Sesi II (14:30-15:00) ≤ ${Math.round(price).toLocaleString('id-ID')}`,
                    targetPagi: Math.round(price * 1.025),
                    stopLoss: Math.round(low * 0.99),
                    estimasiGain: '1.5-3%',
                    riskReward: '1:2',
                    supertrendBadge, rvolBadge, confidence, label: technicalStatus,
                    smartMoney, pivots, candlestick,
                    }
            });

            // 5. BPJP (Beli Pagi Jual Pagi / Sore)
            let bpjpScore = 0;
            let rsiStatus = 'Morning Momentum 🚀';
            if (rsi <= 45) {
                rsiStatus = rsi < 35 ? 'Deep Oversold ⚡' : 'Oversold Bounce 🔄';
                bpjpScore += (50 - rsi) * 2.5;
                if (macdBullish || (trendData.macd_hist !== null && trendData.macd_hist >= -0.8)) bpjpScore += 20;
            } else {
                bpjpScore += (rvol * 15) + (changePct > 0 ? changePct * 2 : 0);
            }
            if (adx >= 20) bpjpScore += 10;
            if (smartMoney.score >= 60) bpjpScore += 10;
            bpjpScore += (confidence * 0.4);

            if (isStrictBpjpEligible({
                isCurrentJakartaDay: strictQuoteToday,
                open: openPrice,
                previousClose: prevClose,
                close: price
            })) candidates.bpjp.push({
                score: bpjpScore,
                item: {
                    ticker, sector, price, changePct: changePct.toFixed(2),
                    rsi: rsi.toFixed(1),
                    rsiStatus,
                    adx: adx.toFixed(1),
                    macd: trendData.macd_line ? trendData.macd_line.toFixed(2) : 'N/A',
                    entryPagi: `Opening (09:00-09:30) ≤ ${Math.round(price).toLocaleString('id-ID')}`,
                    target: Math.round(price * 1.028),
                    stopLoss: Math.round(price * 0.985),
                    jualSebelum: '12:00 WIB',
                    estimasiGain: '2-3.5%',
                    supertrendBadge, rvolBadge, confidence, label: technicalStatus,
                    smartMoney, pivots, candlestick,
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
            if (smartMoney.score >= 70) ltScore += 10;
            ltScore += (confidence * 0.3);

            candidates.longterm.push({
                score: ltScore,
                item: {
                    ticker, sector, price, changePct: changePct.toFixed(2),
                    rsi: rsi.toFixed(1),
                    ema200: ema200.toFixed(0),
                    support: (ema200 * 0.98).toFixed(0),
                    targetKonservatif: roundToTick(price * 1.20),
                    targetAgresif: roundToTick(price * 1.40),
                    cutLoss: roundToTick(ema200 * 0.93),
                    horizon: '6-12 Bulan',
                    sinyalEntri: isSupertrendBullish ? 'Golden Alignment + ST ✓' : 'Trend Support Rebound',
                    supertrendBadge, confidence, label,
                    smartMoney, pivots, candlestick,
                    }
            });
        } catch (e) {
            // gracefully skip individual error
        }
    }

    // Run Yahoo chart requests concurrently and abort the batch before the webhook's serverless budget expires.
    const yahooController = new AbortController();
    const yahooTimeout = setTimeout(() => yahooController.abort(), YAHOO_SCREEN_TIMEOUT_MS);
    try {
        await Promise.allSettled(UNIQUE_WATCHLIST.map(ticker => evaluateTicker(ticker, yahooController.signal)));
    } finally {
        clearTimeout(yahooTimeout);
    }
    if (yahooController.signal.aborted) throw new Error(`Yahoo Finance screener batch timed out after ${YAHOO_SCREEN_TIMEOUT_MS}ms`);
    if (!successfulTickerFetches) throw new Error('Yahoo Finance returned no usable ticker data');

    const rankAndPick = (list, limit = 3) => {
        return list
            .sort((a, b) => b.score - a.score)
            .slice(0, limit)
            .map((c, idx) => ({
                ...c.item,
                rank: idx + 1,
                rankBadge: idx === 0 ? '🥇 #1 REKOMENDASI' : idx === 1 ? '🥈 #2 REKOMENDASI' : idx === 2 ? '🥉 #3 REKOMENDASI' : `#${idx + 1}`
            }));
    };

    const results = {
        scalping: rankAndPick(candidates.scalpingSesi1, 3),
        scalpingSesi1: rankAndPick(candidates.scalpingSesi1, 3),
        scalpingSesi2: rankAndPick(candidates.scalpingSesi2, 3),
        daytrade: rankAndPick(candidates.daytrade, 3),
        intraday: rankAndPick(candidates.daytrade, 3),
        swing: rankAndPick(candidates.swing, 3),
        bsjp: rankAndPick(candidates.bsjp, 3),
        bpjp: rankAndPick(candidates.bpjp, 3),
        bpjs: rankAndPick(candidates.bpjp, 3),
        longterm: rankAndPick(candidates.longterm, 3),
        candlestickAi: rankAndPick(candidates.candlestickAi, 5),
        allCandidates: {
            scalpingSesi1: rankAndPick(candidates.scalpingSesi1, 10),
            scalpingSesi2: rankAndPick(candidates.scalpingSesi2, 10),
            daytrade: rankAndPick(candidates.daytrade, 10),
            intraday: rankAndPick(candidates.daytrade, 10),
            swing: rankAndPick(candidates.swing, 10),
            bsjp: rankAndPick(candidates.bsjp, 10),
            bpjp: rankAndPick(candidates.bpjp, 10),
            bpjs: rankAndPick(candidates.bpjp, 10),
            longterm: rankAndPick(candidates.longterm, 10)
        },
        backtestMetadata: {
            methodology: "Live screener scan; per-strategy historical backtest metrics are not calculated here.",
            auditStatus: "BACKTEST_METRICS_NOT_COMPUTED",
            timestamp: new Date().toISOString()
        },
        dataSources: { prices: 'Yahoo Finance', indicators: 'Yahoo Finance OHLCV' }
    };

    screenerCache = results;
    screenerCacheTime = Date.now();
    return results;
}

module.exports = {
    runScreener,
    calculateSwingRiskReward,
    getTechnicalStatus,
    roundToTick,
    isTodayInJakarta,
    WATCHLIST_UNIVERSE,
    UNIQUE_WATCHLIST
};
