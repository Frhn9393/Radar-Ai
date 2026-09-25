// ============================================================
//  RADAR-AI AUTOMATED QUANTITATIVE BACKTEST ENGINE
//  Battle-Tested Simulation Engine for IDX Equities
// ============================================================

const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });
const ti = require('technicalindicators');
const { sanitizeTicker } = require('./utils');
const { calculateSupertrend } = require('./technicalService');

// In-memory cache for historical OHLCV data to ensure super-fast re-runs
const historyCache = new Map();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

function calculateYahooRsi(closes, period = 14) {
    if (!Array.isArray(closes) || closes.length <= period) return null;
    const values = ti.RSI.calculate({ period, values: closes });
    return Number.isFinite(values[values.length - 1]) ? values[values.length - 1] : null;
}

function generateScreenerSignal(strategy, bars, index) {
    if (index < 5) return false;
    const bar = bars[index];
    const previous = bars[index - 1];
    const meanVolume = bars.slice(index - 5, index).reduce((sum, item) => sum + item.volume, 0) / 5;
    if (!meanVolume || !bar.volume) return false;
    if (strategy === 'BSJP') {
        const rsi = calculateYahooRsi(bars.slice(0, index + 1).map(item => item.close));
        const tick = bar.close < 200 ? 1 : bar.close < 500 ? 2 : bar.close < 2000 ? 5 : bar.close < 5000 ? 10 : 25;
        return bar.close >= bar.high - (2 * tick) && bar.volume > 1.5 * meanVolume && rsi >= 50 && rsi <= 70;
    }
    if (strategy === 'BPJS' || strategy === 'BPJP') {
        const gap = previous.close > 0 ? ((bar.open - previous.close) / previous.close) * 100 : 0;
        const change = previous.close > 0 ? ((bar.close - previous.close) / previous.close) * 100 : 0;
        return gap >= 1 && gap <= 3 && (bar.close > bar.open || change > 2);
    }
    if (strategy === 'DAYTRADE' || strategy === 'SCALPING') {
        const changePct = previous.close > 0 ? ((bar.close - previous.close) / previous.close) * 100 : Number.NEGATIVE_INFINITY;
        if (changePct <= 2) return false;
        const volatility = bar.low > 0 ? ((bar.high - bar.low) / bar.low) * 100 : 0;
        return volatility > 3 && bar.volume > 1.8 * meanVolume;
    }
    if (strategy === 'SWING') {
        const closes = bars.slice(0, index + 1).map(item => item.close);
        if (closes.length < 20) return false;
        const ma20 = closes.slice(-20).reduce((sum, value) => sum + value, 0) / 20;
        return bar.close > ma20 && bar.volume > 1.2 * meanVolume;
    }
    return false;
}

async function runScreenerPortfolioBacktest({ tickers = [], period = '3m', initialCapital = 100000000 } = {}) {
    const cleanTickers = [...new Set((Array.isArray(tickers) ? tickers : []).map(sanitizeTicker).filter(ticker => /^[A-Z0-9]{2,5}$/.test(ticker)))].slice(0, 8);
    if (!cleanTickers.length) throw new Error('Masukkan minimal satu kode emiten yang valid.');
    if (!new Set(['1m', '2m', '3m']).has(period)) throw new Error('Periode backtest harus 1m, 2m, atau 3m.');
    const initialEquity = Number(initialCapital);
    if (!Number.isFinite(initialEquity) || initialEquity <= 0 || initialEquity > 1e12) throw new Error('Modal awal tidak valid.');
    const trades = [];
    const errors = [];
    const dataByTicker = await Promise.all(cleanTickers.map(async ticker => {
        try { return { ticker, bars: await fetchHistoricalData(ticker, period) }; }
        catch (error) { errors.push({ ticker, message: error.message }); return { ticker, bars: [] }; }
    }));
    const strategies = ['BSJP', 'BPJS', 'DAYTRADE', 'SWING'];
    const simulationTradingBars = period === '1m' ? 22 : period === '2m' ? 44 : 66;
    for (const { ticker, bars } of dataByTicker) {
        if (!Array.isArray(bars) || bars.length < 20) continue;
        for (const strategy of strategies) {
            let cooldownUntil = -1;
            const simulationStart = Math.max(20, bars.length - simulationTradingBars - 1);
            for (let index = simulationStart; index < bars.length - 1; index += 1) {
                if (index <= cooldownUntil || !generateScreenerSignal(strategy, bars, index)) continue;
                const entry = bars[index + 1];
                if (!entry || entry.open <= 0) continue;
                const riskPct = strategy === 'BSJP' ? 0.025 : strategy === 'BPJS' || strategy === 'DAYTRADE' ? 0.03 : 0.06;
                const targetPct = strategy === 'BSJP' ? 0.03 : strategy === 'BPJS' || strategy === 'DAYTRADE' ? 0.04 : 0.10;
                const maxHold = strategy === 'DAYTRADE' ? 1 : strategy === 'BPJS' ? 2 : strategy === 'BSJP' ? 3 : 10;
                let exitPrice = entry.close;
                let exitIndex = index + 1;
                let exitReason = 'Periode berakhir';
                for (let hold = 0; hold < maxHold && exitIndex < bars.length; hold += 1) {
                    const candle = bars[exitIndex];
                    const stop = entry.open * (1 - riskPct);
                    const target = entry.open * (1 + targetPct);
                    if (candle.low <= stop) { exitPrice = stop; exitReason = 'Stop Loss'; break; }
                    if (candle.high >= target) { exitPrice = target; exitReason = 'Target'; break; }
                    exitPrice = candle.close;
                    exitReason = 'Time Exit';
                    if (hold < maxHold - 1 && exitIndex + 1 < bars.length) exitIndex += 1;
                }
                const grossPct = ((exitPrice - entry.open) / entry.open) * 100;
                const netPct = grossPct - 0.30;
                trades.push({ ticker, strategy, entryDate: entry.date, exitDate: bars[exitIndex].date, entryPrice: entry.open, exitPrice: Math.round(exitPrice), gainPct: Number(netPct.toFixed(2)), exitReason });
                cooldownUntil = exitIndex;
            }
        }
    }
    trades.sort((a, b) => a.exitDate.localeCompare(b.exitDate) || a.entryDate.localeCompare(b.entryDate) || a.ticker.localeCompare(b.ticker) || a.strategy.localeCompare(b.strategy));
    let equity = initialEquity;
    const equityCurve = [];
    const positionWeight = 1 / (cleanTickers.length * strategies.length);
    for (const trade of trades) {
        trade.pnl = Math.round(equity * positionWeight * trade.gainPct / 100);
        equity += trade.pnl;
        equityCurve.push({ date: trade.exitDate, portfolioValue: Math.round(equity) });
    }
    if (!equityCurve.length) equityCurve.push({ date: new Date().toISOString().slice(0, 10), portfolioValue: initialEquity });
    let peak = initialEquity;
    let maxDrawdownPct = 0;
    for (const point of equityCurve) {
        peak = Math.max(peak, point.portfolioValue);
        maxDrawdownPct = Math.max(maxDrawdownPct, ((peak - point.portfolioValue) / peak) * 100);
    }
    const wins = trades.filter(trade => trade.gainPct > 0);
    const losses = trades.filter(trade => trade.gainPct <= 0);
    const average = items => items.length ? items.reduce((sum, trade) => sum + trade.gainPct, 0) / items.length : 0;
    return {
        tickerCount: cleanTickers.length, tickers: cleanTickers, strategies, period, initialCapital: initialEquity,
        finalEquity: Math.round(equity),
        metrics: {
            totalTrades: trades.length,
            winRate: trades.length ? Number((wins.length / trades.length * 100).toFixed(2)) : 0,
            totalReturnPct: Number(((equity / initialEquity - 1) * 100).toFixed(2)),
            avgGainPct: Number(average(wins).toFixed(2)),
            avgLossPct: Number(average(losses).toFixed(2)),
            maxDrawdownPct: Number(maxDrawdownPct.toFixed(2))
        },
        equityCurve, trades: trades.slice(-300), errors, dataSource: 'Yahoo Finance historical OHLCV',
        caveat: 'Historical simulation; estimated 0.30% round-trip fees, excludes slippage; ambiguous same-candle stop/target resolves to stop loss.'
    };
}

// ═══════════════════════════════════════════════════════════════
//  1. STRATEGY REGISTRY & SPECIFICATIONS
// ═══════════════════════════════════════════════════════════════
const STRATEGIES = {
    'COMPOSITE_QUANT': {
        key: 'COMPOSITE_QUANT',
        name: 'Radar-AI Multi-Factor Quant Model',
        category: 'Institutional Quant',
        description: 'Sinergi konfluensi Supertrend Bullish, posisi di atas EMA20, RSI Sweet Zone (45-68), dan konfirmasi lonjakan volume RVol > 1.2x.',
        defaultTp: 8.0,
        defaultSl: 3.5,
        defaultTrailing: 3.0,
        targetTimeframe: 'Swing / Position (3 - 15 Hari)'
    },
    'SUPERTREND_SWING': {
        key: 'SUPERTREND_SWING',
        name: 'Supertrend + EMA20 Breakout',
        category: 'Trend Following',
        description: 'Membeli saat harga menembus ke atas EMA20 dan Supertrend berbalik arah menjadi Bullish. Exit saat Supertrend berbalik Bearish atau target tercapai.',
        defaultTp: 7.0,
        defaultSl: 3.5,
        defaultTrailing: 2.5,
        targetTimeframe: 'Swing Trend (5 - 20 Hari)'
    },
    'RSI_DIP_BUYER': {
        key: 'RSI_DIP_BUYER',
        name: 'RSI Oversold Dip-Buyer (Mean Reversion)',
        category: 'Counter-Trend / Buy on Weakness',
        description: 'Membeli saat RSI(14) jatuh di bawah level oversold (< 35) yang disertai pola candle pembalikan arah bullish (close > open).',
        defaultTp: 5.0,
        defaultSl: 3.0,
        defaultTrailing: 2.0,
        targetTimeframe: 'Quick Bounce (2 - 7 Hari)'
    },
    'VOLUME_BREAKOUT': {
        key: 'VOLUME_BREAKOUT',
        name: 'Volume Surge & 5-Day High Breakout',
        category: 'Momentum / Daytrade',
        description: 'Menangkap ledakan harga dengan lonjakan Relative Volume (RVol >= 1.5x) yang menembus harga tertinggi 5 hari terakhir.',
        defaultTp: 4.0,
        defaultSl: 2.0,
        defaultTrailing: 1.5,
        targetTimeframe: 'Intraday / Short Swing (1 - 4 Hari)'
    },
    'FOREIGN_FLOW_STREAK': {
        key: 'FOREIGN_FLOW_STREAK',
        name: 'Smart Money Inflow Streak',
        category: 'Bandarmology & Flow',
        description: 'Mengikuti akumulasi dana besar yang melakukan net-buy berturut-turut dengan harga bertahan di atas moving average support.',
        defaultTp: 6.5,
        defaultSl: 3.0,
        defaultTrailing: 2.5,
        targetTimeframe: 'Accumulation Ride (3 - 10 Hari)'
    }
};

function getAvailableStrategies() {
    return Object.values(STRATEGIES);
}

// ═══════════════════════════════════════════════════════════════
//  2. HISTORICAL DATA FETCHER WITH SMART CACHE
// ═══════════════════════════════════════════════════════════════
async function fetchHistoricalData(ticker, period = '1y') {
    const cleanTicker = sanitizeTicker(ticker);
    const yahooSymbol = cleanTicker === 'IHSG' ? '^JKSE' : `${cleanTicker}.JK`;
    const cacheKey = `${yahooSymbol}_${period}`;

    const cached = historyCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
        return cached.data;
    }

    let days = 365;
    if (period === '1m') days = 30;
    else if (period === '2m') days = 60;
    else if (period === '3m') days = 90;
    else if (period === '6m') days = 180;
    else if (period === '1y') days = 365;
    else if (period === '2y') days = 730;
    else if (period === '3y') days = 1095;

    const period1 = new Date(Date.now() - (days + 60) * 24 * 3600 * 1000); // add buffer for indicator warmup

    try {
        const result = await yahooFinance.chart(yahooSymbol, {
            period1,
            interval: '1d'
        });

        if (!result || !result.quotes || result.quotes.length === 0) {
            throw new Error(`Data riwayat untuk ${cleanTicker} tidak tersedia`);
        }

        const validQuotes = result.quotes.filter(q =>
            q && q.date && q.close !== null && q.open !== null && q.high !== null && q.low !== null && q.volume !== null
        ).map(q => ({
            date: new Date(q.date).toISOString().split('T')[0],
            open: Math.round(q.open),
            high: Math.round(q.high),
            low: Math.round(q.low),
            close: Math.round(q.close),
            volume: q.volume
        }));

        historyCache.set(cacheKey, { timestamp: Date.now(), data: validQuotes });
        return validQuotes;
    } catch (err) {
        console.error(`Gagal mengambil data historis ${ticker}:`, err.message);
        throw err;
    }
}

// ═══════════════════════════════════════════════════════════════
//  3. TECHNICAL INDICATORS PRE-CALCULATION
// ═══════════════════════════════════════════════════════════════
function enrichHistoricalIndicators(quotes) {
    const closes = quotes.map(q => q.close);
    const highs = quotes.map(q => q.high);
    const lows = quotes.map(q => q.low);
    const volumes = quotes.map(q => q.volume);

    // EMA 20, 50
    const ema20Values = ti.EMA.calculate({ period: 20, values: closes });
    const ema50Values = ti.EMA.calculate({ period: 50, values: closes });
    const offsetEma20 = quotes.length - ema20Values.length;
    const offsetEma50 = quotes.length - ema50Values.length;

    // RSI 14
    const rsiValues = ti.RSI.calculate({ period: 14, values: closes });
    const offsetRsi = quotes.length - rsiValues.length;

    // ATR 14
    const atrValues = ti.ATR.calculate({ high: highs, low: lows, close: closes, period: 14 });
    const offsetAtr = quotes.length - atrValues.length;

    // Volume SMA 20
    const volSmaValues = ti.SMA.calculate({ period: 20, values: volumes });
    const offsetVolSma = quotes.length - volSmaValues.length;

    // Supertrend (10, 3.0)
    const stLength = 10;
    const stMultiplier = 3.0;
    const stAtr = ti.ATR.calculate({ high: highs, low: lows, close: closes, period: stLength });
    const stOffset = quotes.length - stAtr.length;

    const supertrendArr = [];
    const stDirectionArr = [];
    const upperBand = [];
    const lowerBand = [];

    for (let i = 0; i < quotes.length; i++) {
        if (i < stOffset) {
            supertrendArr.push(null);
            stDirectionArr.push(null);
            upperBand.push(null);
            lowerBand.push(null);
            continue;
        }

        const atr = stAtr[i - stOffset];
        const hl2 = (highs[i] + lows[i]) / 2;
        const basicUpper = hl2 + stMultiplier * atr;
        const basicLower = hl2 - stMultiplier * atr;

        const prevUpper = upperBand[i - 1];
        const prevLower = lowerBand[i - 1];
        const prevClose = closes[i - 1];

        const finalUpper = (prevUpper !== null && prevUpper !== undefined && (basicUpper < prevUpper || prevClose > prevUpper)) ? basicUpper : (prevUpper ?? basicUpper);
        const finalLower = (prevLower !== null && prevLower !== undefined && (basicLower > prevLower || prevClose < prevLower)) ? basicLower : (prevLower ?? basicLower);

        upperBand.push(finalUpper);
        lowerBand.push(finalLower);

        let currentDir = 1;
        let currentSt = finalLower;

        if (i === stOffset) {
            currentDir = closes[i] > finalUpper ? 1 : -1;
            currentSt = currentDir === 1 ? finalLower : finalUpper;
        } else {
            const prevSt = supertrendArr[i - 1];
            if (prevSt === prevUpper) {
                currentDir = closes[i] > finalUpper ? 1 : -1;
            } else {
                currentDir = closes[i] < finalLower ? -1 : 1;
            }
            currentSt = currentDir === 1 ? finalLower : finalUpper;
        }

        supertrendArr.push(currentSt);
        stDirectionArr.push(currentDir);
    }

    // Attach enriched indicators to each bar
    return quotes.map((q, i) => {
        const ema20 = i >= offsetEma20 ? ema20Values[i - offsetEma20] : null;
        const ema50 = i >= offsetEma50 ? ema50Values[i - offsetEma50] : null;
        const rsi = i >= offsetRsi ? rsiValues[i - offsetRsi] : null;
        const atr = i >= offsetAtr ? atrValues[i - offsetAtr] : null;
        const volSma = i >= offsetVolSma ? volSmaValues[i - offsetVolSma] : null;
        const rvol = (volSma && volSma > 0) ? (q.volume / volSma) : 1.0;
        const st = supertrendArr[i];
        const stDir = stDirectionArr[i]; // 1 = Bullish, -1 = Bearish

        // 5-day rolling high
        let high5 = q.high;
        if (i >= 5) {
            high5 = Math.max(...highs.slice(i - 5, i));
        }

        return {
            ...q,
            ema20,
            ema50,
            rsi,
            atr,
            volSma,
            rvol,
            supertrend: st,
            supertrendDir: stDir,
            high5
        };
    });
}

// ═══════════════════════════════════════════════════════════════
//  4. AUTOMATED BACKTEST SIMULATION ENGINE
// ═══════════════════════════════════════════════════════════════
async function runBacktest(options = {}) {
    const {
        ticker = 'BBCA',
        strategyKey = 'COMPOSITE_QUANT',
        period = '1y',
        initialCapital = 100000000, // Rp 100 juta default
        buyFeePct = 0.15, // 0.15% fee beli sekuritas IDX
        sellFeePct = 0.25, // 0.25% fee jual sekuritas + PPh final IDX
        customTp = null,
        customSl = null,
        customTrailing = null
    } = options;

    const cleanTicker = sanitizeTicker(ticker);
    const strategyConfig = STRATEGIES[strategyKey] || STRATEGIES.COMPOSITE_QUANT;

    const tpTargetPct = customTp !== null && customTp !== undefined ? parseFloat(customTp) : strategyConfig.defaultTp;
    const slTargetPct = customSl !== null && customSl !== undefined ? parseFloat(customSl) : strategyConfig.defaultSl;
    const trailingPct = customTrailing !== null && customTrailing !== undefined ? parseFloat(customTrailing) : strategyConfig.defaultTrailing;

    const rawQuotes = await fetchHistoricalData(cleanTicker, period);
    if (!rawQuotes || rawQuotes.length < 30) {
        throw new Error(`Data historis ${cleanTicker} terlalu sedikit untuk backtest (minimal 30 bar).`);
    }

    const bars = enrichHistoricalIndicators(rawQuotes);

    // Warm-up bars (skip first 25 bars to let EMA, RSI, Supertrend stabilize)
    const startIndex = Math.min(25, Math.floor(bars.length * 0.2));

    let cash = initialCapital;
    let position = null; // { entryDate, entryPrice, shares, lots, stopLoss, takeProfit, highestPriceSinceEntry }
    const trades = [];
    const equityCurve = [];

    // Buy and Hold Benchmark tracking
    const initialBarPrice = bars[startIndex].close;

    for (let i = startIndex; i < bars.length; i++) {
        const bar = bars[i];
        const prevBar = bars[i - 1];

        // 1. Manage Active Position (Check Stop Loss, Take Profit, Trailing Stop, Strategy Exit)
        if (position !== null) {
            let exitReason = null;
            let exitPrice = bar.close;

            // Track highest price for trailing stop
            if (bar.high > position.highestPriceSinceEntry) {
                position.highestPriceSinceEntry = bar.high;
                // Move trailing stop up
                const newTrailingStop = position.highestPriceSinceEntry * (1 - (trailingPct / 100));
                if (newTrailingStop > position.stopLoss) {
                    position.stopLoss = newTrailingStop;
                }
            }

            // Check Hard Take Profit hit intraday
            if (bar.high >= position.takeProfit) {
                exitReason = `TARGET PROFIT (+${tpTargetPct}%)`;
                exitPrice = position.takeProfit;
            }
            // Check Stop Loss / Trailing Stop hit intraday
            else if (bar.low <= position.stopLoss) {
                const lossPct = ((position.stopLoss - position.entryPrice) / position.entryPrice) * 100;
                exitReason = lossPct >= 0 ? `TRAILING STOP HIT (+${lossPct.toFixed(1)}%)` : `STOP LOSS (-${slTargetPct}%)`;
                exitPrice = position.stopLoss;
            }
            // Strategy Specific Dynamic Exits
            else if (strategyKey === 'SUPERTREND_SWING' && bar.supertrendDir === -1 && prevBar.supertrendDir === 1) {
                exitReason = 'SUPERTREND REVERSAL BEARISH';
                exitPrice = bar.close;
            }
            else if (strategyKey === 'RSI_DIP_BUYER' && bar.rsi && bar.rsi > 65) {
                exitReason = 'RSI OVERBOUGHT EXIT (>65)';
                exitPrice = bar.close;
            }
            else if (strategyKey === 'VOLUME_BREAKOUT' && (i - position.entryIndex) >= 4) {
                exitReason = 'MAX TIME-DECAY EXIT (4 Hari)';
                exitPrice = bar.close;
            }
            // Last Bar Forced Close
            else if (i === bars.length - 1) {
                exitReason = 'PERIODE BACKTEST SELESAI (MARK-TO-MARKET)';
                exitPrice = bar.close;
            }

            // Execute Exit Order
            if (exitReason) {
                const grossProceeds = position.shares * exitPrice;
                const sellFee = grossProceeds * (sellFeePct / 100);
                const netProceeds = grossProceeds - sellFee;
                const netPnl = netProceeds - position.costBasis;
                const gainPct = ((netProceeds - position.costBasis) / position.costBasis) * 100;
                const holdDays = Math.max(1, Math.round((new Date(bar.date) - new Date(position.entryDate)) / (1000 * 3600 * 24)));

                cash += netProceeds;

                trades.push({
                    tradeNumber: trades.length + 1,
                    ticker: cleanTicker,
                    entryDate: position.entryDate,
                    entryPrice: position.entryPrice,
                    lots: position.lots,
                    shares: position.shares,
                    exitDate: bar.date,
                    exitPrice: Math.round(exitPrice),
                    exitReason,
                    holdDays,
                    gainPct: parseFloat(gainPct.toFixed(2)),
                    netPnl: Math.round(netPnl),
                    status: gainPct > 0 ? 'WIN' : (gainPct < -0.2 ? 'LOSS' : 'BREAKEVEN')
                });

                position = null;
            }
        }

        // 2. Check Strategy Entry Conditions (Only if no active position)
        if (position === null && i < bars.length - 1) {
            let shouldEnter = false;
            let signalName = '';

            if (strategyKey === 'COMPOSITE_QUANT') {
                const isSupertrendBull = bar.supertrendDir === 1;
                const aboveEma20 = bar.ema20 && bar.close >= bar.ema20;
                const rsiSweet = bar.rsi && bar.rsi >= 45 && bar.rsi <= 68;
                const volSurge = bar.rvol >= 1.15;
                const isBullishCandle = bar.close > bar.open;

                if (isSupertrendBull && aboveEma20 && rsiSweet && volSurge && isBullishCandle) {
                    shouldEnter = true;
                    signalName = 'Radar Composite Confluence';
                }
            } else if (strategyKey === 'SUPERTREND_SWING') {
                const flipBullish = bar.supertrendDir === 1 && (prevBar.supertrendDir === -1 || (bar.close > bar.ema20 && prevBar.close <= prevBar.ema20));
                if (flipBullish && bar.close > bar.open) {
                    shouldEnter = true;
                    signalName = 'Supertrend Trend Following';
                }
            } else if (strategyKey === 'RSI_DIP_BUYER') {
                const prevOversold = prevBar.rsi && prevBar.rsi < 36;
                const candleBounce = bar.close > bar.open && bar.close > prevBar.close;
                if (prevOversold && candleBounce) {
                    shouldEnter = true;
                    signalName = 'RSI Oversold Dip-Bounce';
                }
            } else if (strategyKey === 'VOLUME_BREAKOUT') {
                const volBreak = bar.rvol >= 1.5;
                const highBreak = bar.close >= bar.high5 && bar.close > bar.open;
                const aboveEma = bar.ema20 && bar.close > bar.ema20;
                if (volBreak && highBreak && aboveEma) {
                    shouldEnter = true;
                    signalName = 'Volume Surge Breakout';
                }
            } else if (strategyKey === 'FOREIGN_FLOW_STREAK') {
                const streakVol = bar.rvol >= 1.25 && prevBar.rvol >= 1.1;
                const higherLow = bar.low >= prevBar.low && bar.close > bar.open;
                const aboveEma = bar.ema20 && bar.close > bar.ema20;
                if (streakVol && higherLow && aboveEma) {
                    shouldEnter = true;
                    signalName = 'Smart Money Accumulation';
                }
            }

            if (shouldEnter) {
                const entryPrice = bar.close;
                // Maximum allocate 95% of available cash
                const capitalToAllocate = cash * 0.95;
                const pricePerLot = entryPrice * 100;
                const lots = Math.floor(capitalToAllocate / pricePerLot);

                if (lots >= 1) {
                    const shares = lots * 100;
                    const grossCost = shares * entryPrice;
                    const buyFee = grossCost * (buyFeePct / 100);
                    const totalCostBasis = grossCost + buyFee;

                    cash -= totalCostBasis;

                    position = {
                        entryIndex: i,
                        entryDate: bar.date,
                        entryPrice,
                        shares,
                        lots,
                        costBasis: totalCostBasis,
                        takeProfit: Math.round(entryPrice * (1 + (tpTargetPct / 100))),
                        stopLoss: Math.round(entryPrice * (1 - (slTargetPct / 100))),
                        highestPriceSinceEntry: entryPrice,
                        signalName
                    };
                }
            }
        }

        // 3. Record Daily Portfolio Equity Curve
        const posValue = position ? position.shares * bar.close : 0;
        const totalEquity = Math.round(cash + posValue);
        const benchmarkValue = Math.round(initialCapital * (bar.close / initialBarPrice));

        equityCurve.push({
            date: bar.date,
            portfolioValue: totalEquity,
            cash: Math.round(cash),
            positionValue: posValue,
            closePrice: bar.close,
            benchmarkValue
        });
    }

    // ═══════════════════════════════════════════════════════════════
    //  5. COMPUTE COMPREHENSIVE PERFORMANCE & RISK METRICS
    // ═══════════════════════════════════════════════════════════════
    const finalEquity = equityCurve.length > 0 ? equityCurve[equityCurve.length - 1].portfolioValue : initialCapital;
    const finalBenchmark = equityCurve.length > 0 ? equityCurve[equityCurve.length - 1].benchmarkValue : initialCapital;

    const netReturnPct = ((finalEquity - initialCapital) / initialCapital) * 100;
    const benchmarkReturnPct = ((finalBenchmark - initialCapital) / initialCapital) * 100;
    const alphaPct = netReturnPct - benchmarkReturnPct;

    const totalTrades = trades.length;
    const winningTrades = trades.filter(t => t.status === 'WIN').length;
    const losingTrades = trades.filter(t => t.status === 'LOSS').length;
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

    const grossProfits = trades.filter(t => t.netPnl > 0).reduce((acc, t) => acc + t.netPnl, 0);
    const grossLosses = trades.filter(t => t.netPnl < 0).reduce((acc, t) => acc + Math.abs(t.netPnl), 0);
    const profitFactor = grossLosses > 0 ? (grossProfits / grossLosses) : (grossProfits > 0 ? 99.9 : 0);

    const winGains = trades.filter(t => t.gainPct > 0).map(t => t.gainPct);
    const lossGains = trades.filter(t => t.gainPct < 0).map(t => Math.abs(t.gainPct));
    const avgWinPct = winGains.length > 0 ? (winGains.reduce((a, b) => a + b, 0) / winGains.length) : 0;
    const avgLossPct = lossGains.length > 0 ? (lossGains.reduce((a, b) => a + b, 0) / lossGains.length) : 0;
    const riskRewardRatio = avgLossPct > 0 ? (avgWinPct / avgLossPct) : (avgWinPct > 0 ? 9.9 : 1.0);

    const avgHoldDays = totalTrades > 0 ? (trades.reduce((acc, t) => acc + t.holdDays, 0) / totalTrades) : 0;
    const bestTradePct = trades.length > 0 ? Math.max(...trades.map(t => t.gainPct)) : 0;
    const worstTradePct = trades.length > 0 ? Math.min(...trades.map(t => t.gainPct)) : 0;

    // Calculate Maximum Drawdown (MDD)
    let peakEquity = initialCapital;
    let maxDrawdownPct = 0;
    for (const point of equityCurve) {
        if (point.portfolioValue > peakEquity) {
            peakEquity = point.portfolioValue;
        }
        const dd = ((peakEquity - point.portfolioValue) / peakEquity) * 100;
        if (dd > maxDrawdownPct) {
            maxDrawdownPct = dd;
        }
        point.drawdownPct = parseFloat(dd.toFixed(2));
    }

    return {
        ticker: cleanTicker,
        strategy: strategyConfig,
        period,
        initialCapital,
        finalEquity,
        netPnl: finalEquity - initialCapital,
        metrics: {
            winRate: `${winRate.toFixed(1)}%`,
            winRateRaw: parseFloat(winRate.toFixed(1)),
            profitFactor: profitFactor >= 99 ? '99.0+' : profitFactor.toFixed(2),
            profitFactorRaw: parseFloat(profitFactor.toFixed(2)),
            netReturnPct: `${netReturnPct >= 0 ? '+' : ''}${netReturnPct.toFixed(2)}%`,
            netReturnRaw: parseFloat(netReturnPct.toFixed(2)),
            benchmarkReturnPct: `${benchmarkReturnPct >= 0 ? '+' : ''}${benchmarkReturnPct.toFixed(2)}%`,
            benchmarkReturnRaw: parseFloat(benchmarkReturnPct.toFixed(2)),
            alpha: `${alphaPct >= 0 ? '+' : ''}${alphaPct.toFixed(2)}%`,
            maxDrawdown: `-${maxDrawdownPct.toFixed(2)}%`,
            maxDrawdownRaw: parseFloat(maxDrawdownPct.toFixed(2)),
            riskRewardRatio: `1:${riskRewardRatio.toFixed(2)}`,
            avgWinPct: `+${avgWinPct.toFixed(2)}%`,
            avgLossPct: `-${avgLossPct.toFixed(2)}%`,
            avgHoldDays: `${avgHoldDays.toFixed(1)} Hari`,
            bestTrade: `${bestTradePct >= 0 ? '+' : ''}${bestTradePct.toFixed(2)}%`,
            worstTrade: `${worstTradePct.toFixed(2)}%`,
            totalTrades,
            winningTrades,
            losingTrades
        },
        tradeLog: trades,
        equityCurve: equityCurve.filter((_, idx) => idx % 2 === 0 || idx === equityCurve.length - 1) // optimized for frontend chart rendering
    };
}

// ═══════════════════════════════════════════════════════════════
//  6. INSTANT QUICK AUDIT (FOR MODALS & CARDS)
// ═══════════════════════════════════════════════════════════════
async function quickAudit(ticker) {
    try {
        const cleanTicker = sanitizeTicker(ticker);
        const result = await runBacktest({
            ticker: cleanTicker,
            strategyKey: 'COMPOSITE_QUANT',
            period: '1y'
        });

        return {
            ticker: cleanTicker,
            strategy: result.strategy.name,
            winRate: result.metrics.winRate,
            profitFactor: result.metrics.profitFactor,
            netReturn: result.metrics.netReturnPct,
            benchmarkReturn: result.metrics.benchmarkReturnPct,
            totalTrades: result.metrics.totalTrades,
            maxDrawdown: result.metrics.maxDrawdown,
            riskReward: result.metrics.riskRewardRatio
        };
    } catch (err) {
        return {
            ticker: sanitizeTicker(ticker),
            strategy: 'Radar-AI Multi-Factor Quant Model',
            unavailable: true,
            error: 'Data historis belum tersedia untuk menghitung metrik backtest.'
        };
    }
}

module.exports = {
    STRATEGIES,
    getAvailableStrategies,
    fetchHistoricalData,
    runBacktest,
    quickAudit,
    runScreenerPortfolioBacktest,
    generateScreenerSignal
};
