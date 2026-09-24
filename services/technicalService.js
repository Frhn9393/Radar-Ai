const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });
const ti = require('technicalindicators');
const { exec } = require('child_process');
const path = require('path');
const { sanitizeTicker } = require('./utils');

// ═══════════════════════════════════════════════════════════════
//  1. SUPERTREND CALCULATION (ATR-Based 10, 3.0)
// ═══════════════════════════════════════════════════════════════
function calculateSupertrend(highs, lows, closes, length = 10, multiplier = 3.0) {
    if (!closes || closes.length < length) {
        return {
            value: null,
            direction: null,
            isBullish: false,
            support: null,
            resistance: null,
            label: 'N/A'
        };
    }

    const atrValues = ti.ATR.calculate({ high: highs, low: lows, close: closes, period: length });
    const offset = closes.length - atrValues.length;

    const upperBand = [];
    const lowerBand = [];
    const supertrend = [];
    const direction = []; // 1 = bullish, -1 = bearish

    for (let i = 0; i < closes.length; i++) {
        if (i < offset) {
            upperBand.push(null);
            lowerBand.push(null);
            supertrend.push(null);
            direction.push(null);
            continue;
        }

        const atr = atrValues[i - offset];
        const hl2 = (highs[i] + lows[i]) / 2;
        const basicUpper = hl2 + multiplier * atr;
        const basicLower = hl2 - multiplier * atr;

        const prevUpper = upperBand[i - 1];
        const prevLower = lowerBand[i - 1];
        const prevClose = closes[i - 1];

        const finalUpper = (prevUpper !== null && prevUpper !== undefined && (basicUpper < prevUpper || prevClose > prevUpper)) ? basicUpper : (prevUpper ?? basicUpper);
        const finalLower = (prevLower !== null && prevLower !== undefined && (basicLower > prevLower || prevClose < prevLower)) ? basicLower : (prevLower ?? basicLower);

        upperBand.push(finalUpper);
        lowerBand.push(finalLower);

        let currentDir = 1;
        let currentSt = finalLower;

        if (i === offset) {
            currentDir = closes[i] > finalUpper ? 1 : -1;
            currentSt = currentDir === 1 ? finalLower : finalUpper;
        } else {
            const prevSt = supertrend[i - 1];
            if (prevSt === prevUpper) {
                currentDir = closes[i] > finalUpper ? 1 : -1;
            } else {
                currentDir = closes[i] < finalLower ? -1 : 1;
            }
            currentSt = currentDir === 1 ? finalLower : finalUpper;
        }

        supertrend.push(currentSt);
        direction.push(currentDir);
    }

    const lastIdx = closes.length - 1;
    const isBullish = direction[lastIdx] === 1;
    const stVal = supertrend[lastIdx];

    return {
        value: stVal,
        direction: direction[lastIdx],
        isBullish,
        support: isBullish ? stVal : null,
        resistance: !isBullish ? stVal : null,
        label: isBullish ? 'BULLISH 🟢 (Trailing Support)' : 'BEARISH 🔴 (Resistance)'
    };
}

// ═══════════════════════════════════════════════════════════════
//  1.1 AI BANDARMOLOGY & SMART MONEY ACCUMULATION ENGINE
// ═══════════════════════════════════════════════════════════════
function calculateBandarmology(highs, lows, closes, volumes, opens) {
    if (!closes || closes.length < 5) {
        return {
            score: 50,
            status: 'NETRAL ⚪',
            badge: 'Smart Money: 50/100 (Netral)',
            clv: 0,
            rvol: 1.0,
            netFlow5: 0,
            description: 'Data tidak cukup untuk kalkulasi akumulasi.'
        };
    }

    const n = closes.length;
    const lastClose = closes[n - 1];
    const prevClose = closes[n - 2];
    const lastHigh = highs[n - 1];
    const lastLow = lows[n - 1];
    const lastVol = volumes[n - 1] || 1;

    // Close Location Value (CLV): -1.0 to +1.0
    const range = lastHigh - lastLow;
    const clv = range > 0 ? ((lastClose - lastLow) - (lastHigh - lastClose)) / range : 0;

    // 20-day Average Volume & RVol
    const volSlice20 = volumes.slice(Math.max(0, n - 20));
    const avgVol20 = volSlice20.reduce((a, b) => a + b, 0) / volSlice20.length || 1;
    const rvol = lastVol / avgVol20;

    // 5-day Net Volume Accumulation Trend
    let netFlow5 = 0;
    for (let i = Math.max(0, n - 5); i < n; i++) {
        const h = highs[i], l = lows[i], c = closes[i], v = volumes[i] || 0;
        const r = h - l;
        const dayClv = r > 0 ? ((c - l) - (h - c)) / r : 0;
        netFlow5 += (dayClv * v);
    }

    // Base Score: 50
    let score = 50;
    score += Math.round(clv * 25);

    const chgPct = prevClose > 0 ? ((lastClose - prevClose) / prevClose) * 100 : 0;
    if (chgPct > 0) score += Math.min(15, Math.round(chgPct * 2));
    else if (chgPct < 0) score += Math.max(-15, Math.round(chgPct * 2));

    // Volume surge vs price action
    if (rvol >= 2.0 && clv > 0.3) {
        score += 20; // Massive institutional mark up
    } else if (rvol >= 1.3 && clv > 0) {
        score += 12; // Steady accumulation
    } else if (rvol >= 1.5 && clv < -0.3) {
        score -= 20; // Distribution / dumping
    } else if (rvol < 0.8 && chgPct < 0 && clv > -0.2) {
        score += 8; // Healthy supply test / dry volume pullback
    }

    if (netFlow5 > 0) score += 5;
    else if (netFlow5 < 0) score -= 5;

    score = Math.max(5, Math.min(98, Math.round(score)));

    let status = 'NETRAL ⚪';
    let badge = `Smart Money: ${score}/100 (Netral)`;
    let description = 'Aliran transaksi seimbang antara penawaran dan permintaan.';

    if (score >= 85) {
        status = 'AKUMULASI MASIF 🔥';
        badge = `Smart Money: ${score}/100 (Akumulasi Masif)`;
        description = 'Terdeteksi akumulasi agresif dana institusi / big money dengan dominasi pembelian di fraksi atas.';
    } else if (score >= 70) {
        status = 'AKUMULASI HALUS 🚀';
        badge = `Smart Money: ${score}/100 (Akumulasi Terjaga)`;
        description = 'Pembelian bertahap oleh smart money; tekanan beli menguasai sesi tanpa membuat harga overbought.';
    } else if (score >= 55) {
        status = 'TEST SUPPLY / PULLBACK SEHAT 🟢';
        badge = `Smart Money: ${score}/100 (Pullback Sehat)`;
        description = 'Harga terkoreksi wajar dengan volume surut; indikasi pasokan jual kering dan siap memantul.';
    } else if (score <= 35) {
        status = 'DISTRIBUSI / WASPADA DUMPING 🔴';
        badge = `Smart Money: ${score}/100 (Distribusi)`;
        description = 'Tekanan jual institusi dominan atau volume tinggi namun harga gagal bertahan.';
    }

    return {
        score,
        status,
        badge,
        clv: parseFloat(clv.toFixed(2)),
        rvol: parseFloat(rvol.toFixed(2)),
        netFlow5: Math.round(netFlow5 / 100),
        description
    };
}

// ═══════════════════════════════════════════════════════════════
//  1.2 PIVOT POINTS (CLASSIC & FIBONACCI)
// ═══════════════════════════════════════════════════════════════
function calculatePivotPoints(high, low, close) {
    const pivot = (high + low + close) / 3;
    const r1 = (2 * pivot) - low;
    const s1 = (2 * pivot) - high;
    const r2 = pivot + (high - low);
    const s2 = pivot - (high - low);

    const range = high - low;
    const fibR1 = pivot + (0.382 * range);
    const fibR2 = pivot + (0.618 * range);
    const fibS1 = pivot - (0.382 * range);
    const fibS2 = pivot - (0.618 * range);

    return {
        classic: {
            pivot: Math.round(pivot),
            r1: Math.round(r1),
            r2: Math.round(r2),
            s1: Math.round(s1),
            s2: Math.round(s2)
        },
        fibonacci: {
            pivot: Math.round(pivot),
            r1: Math.round(fibR1),
            r2: Math.round(fibR2),
            s1: Math.round(fibS1),
            s2: Math.round(fibS2)
        }
    };
}

// ═══════════════════════════════════════════════════════════════
//  1.3 CANDLESTICK PATTERN RECOGNITION AI
// ═══════════════════════════════════════════════════════════════
function detectCandlestickPatterns(quotes) {
    if (!quotes || quotes.length < 2) {
        return { pattern: 'Netral', isBullish: false, desc: 'Pola pergerakan standar.' };
    }

    const n = quotes.length;
    const curr = quotes[n - 1];
    const prev = quotes[n - 2];
    const prevPrev = n > 2 ? quotes[n - 3] : prev;

    const cClose = curr.close;
    const cOpen = curr.open || prev.close;
    const cHigh = curr.high;
    const cLow = curr.low;

    const pClose = prev.close;
    const pOpen = prev.open || (prevPrev ? prevPrev.close : pClose);

    const body = Math.abs(cClose - cOpen);
    const range = cHigh - cLow;
    const upperShadow = cHigh - Math.max(cOpen, cClose);
    const lowerShadow = Math.min(cOpen, cClose) - cLow;
    const isGreen = cClose >= cOpen;
    const isPrevRed = pClose < pOpen;

    if (isGreen && isPrevRed && cOpen <= pClose && cClose >= pOpen && body > Math.abs(pClose - pOpen)) {
        return { pattern: 'Bullish Engulfing 🔥', isBullish: true, desc: 'Candle hijau membalut utuh candle merah sebelumnya; konfirmasi pembalikan arah kuat.' };
    }

    if (range > 0 && lowerShadow >= (2 * body) && upperShadow <= (0.25 * body) && cClose > (cLow + range * 0.5)) {
        return { pattern: 'Hammer (Palu Reversal) 🔨', isBullish: true, desc: 'Rejection tajam harga bawah; pembeli berhasil menarik harga kembali ke zona atas.' };
    }

    if (isPrevRed && Math.abs(pClose - pOpen) > (pClose * 0.01)) {
        const starBody = Math.abs(prev.close - (prev.open || prev.close));
        if (starBody < (range * 0.3) && isGreen && cClose > (pOpen + pClose) / 2) {
            return { pattern: 'Morning Star ⭐', isBullish: true, desc: 'Pola pembalikan bintang pagi 3-candle dengan probabilitas rebound tinggi.' };
        }
    }

    if (isGreen && range > 0 && body >= (range * 0.85) && (cClose > prev.close)) {
        return { pattern: 'Marubozu Bullish 🟢', isBullish: true, desc: 'Momentum beli absolut dari pembukaan hingga penutupan tanpa hambatan pasokan.' };
    }

    if (range > 0 && lowerShadow >= (range * 0.6)) {
        return { pattern: 'Bullish Pinbar 📍', isBullish: true, desc: 'Penolakan agresif di area support; ekor bawah panjang menunjukkan likuiditas serap.' };
    }

    if (range > 0 && upperShadow >= (2 * body) && lowerShadow <= (0.2 * body) && isGreen) {
        return { pattern: 'Inverted Hammer 🚀', isBullish: true, desc: 'Uji coba penembusan batas atas (breakout testing).' };
    }

    return { pattern: isGreen ? 'Bullish Continuation 📈' : 'Konsolidasi ⚪', isBullish: isGreen, desc: 'Pergerakan harga dalam fase wajar tren.' };
}

// ═══════════════════════════════════════════════════════════════
//  1.4 POSITION SIZING & MONEY MANAGEMENT CALCULATOR
// ═══════════════════════════════════════════════════════════════
function calculatePositionSize(capital, riskTolerancePct, entryPrice, stopLossPrice) {
    const cleanCap = Number(capital) > 0 ? Number(capital) : 10000000;
    const cleanRiskPct = Number(riskTolerancePct) > 0 ? Number(riskTolerancePct) : 1.5;
    const entry = Number(entryPrice) > 0 ? Number(entryPrice) : 1000;
    const sl = Number(stopLossPrice) > 0 && Number(stopLossPrice) < entry ? Number(stopLossPrice) : Math.round(entry * 0.98);

    const maxRiskRp = Math.round(cleanCap * (cleanRiskPct / 100));
    const riskPerShare = entry - sl;
    let shares = Math.floor(maxRiskRp / riskPerShare);
    let lots = Math.floor(shares / 100);

    const maxLotsFromCap = Math.floor(cleanCap / (entry * 100));
    if (lots > maxLotsFromCap) lots = maxLotsFromCap;
    if (lots < 1) lots = 1;

    const totalCost = lots * 100 * entry;
    const actualRiskRp = lots * 100 * riskPerShare;
    const riskPctFromCap = parseFloat(((actualRiskRp / cleanCap) * 100).toFixed(2));

    return {
        capital: cleanCap,
        riskTolerancePct: cleanRiskPct,
        maxRiskRp,
        lots,
        totalShares: lots * 100,
        totalCost,
        actualRiskRp,
        riskPctFromCap
    };
}

// ═══════════════════════════════════════════════════════════════
//  2. FULL TECHNICAL INDICATOR PROCESSOR (NODE.JS ENGINE)
// ═══════════════════════════════════════════════════════════════
function processTechnicalData(quotes) {
    const validQuotes = quotes.filter(q => q && q.close !== null && q.high !== null && q.low !== null && !isNaN(q.close));
    if (validQuotes.length < 20) {
        throw new Error('Data riwayat tidak cukup untuk analisis teknikal (minimal 20 candle).');
    }

    const closes = validQuotes.map(q => q.close);
    const highs = validQuotes.map(q => q.high);
    const lows = validQuotes.map(q => q.low);
    const volumes = validQuotes.map(q => q.volume || 0);

    const latest = validQuotes[validQuotes.length - 1];
    const prev = validQuotes.length > 1 ? validQuotes[validQuotes.length - 2] : latest;

    // 1. Moving Averages
    const ema20Arr = ti.EMA.calculate({ period: 20, values: closes });
    const ema50Arr = closes.length >= 50 ? ti.EMA.calculate({ period: 50, values: closes }) : [];
    const ema200Arr = closes.length >= 200 ? ti.EMA.calculate({ period: 200, values: closes }) : [];
    const sma20Arr = ti.SMA.calculate({ period: 20, values: closes });
    const sma50Arr = closes.length >= 50 ? ti.SMA.calculate({ period: 50, values: closes }) : [];

    const ema20 = ema20Arr.length > 0 ? ema20Arr[ema20Arr.length - 1] : null;
    const ema50 = ema50Arr.length > 0 ? ema50Arr[ema50Arr.length - 1] : null;
    const ema200 = ema200Arr.length > 0 ? ema200Arr[ema200Arr.length - 1] : null;
    const sma20 = sma20Arr.length > 0 ? sma20Arr[sma20Arr.length - 1] : null;
    const sma50 = sma50Arr.length > 0 ? sma50Arr[sma50Arr.length - 1] : null;

    // 2. RSI (14)
    const rsiArr = ti.RSI.calculate({ period: 14, values: closes });
    const rsi14 = rsiArr.length > 0 ? rsiArr[rsiArr.length - 1] : 50;

    // 3. MACD (12, 26, 9)
    let macdLine = null;
    let macdSignal = null;
    let macdHist = null;
    if (closes.length >= 26) {
        const macdArr = ti.MACD.calculate({ values: closes, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 });
        if (macdArr.length > 0) {
            const lastMacd = macdArr[macdArr.length - 1];
            macdLine = lastMacd.MACD ?? null;
            macdSignal = lastMacd.signal ?? null;
            macdHist = lastMacd.histogram ?? null;
        }
    }

    // 4. ADX (14)
    let adx14 = null;
    if (closes.length >= 14) {
        const adxArr = ti.ADX.calculate({ high: highs, low: lows, close: closes, period: 14 });
        if (adxArr.length > 0) {
            adx14 = adxArr[adxArr.length - 1].adx ?? null;
        }
    }

    // 5. ATR (14)
    let atr14 = null;
    if (closes.length >= 14) {
        const atrArr = ti.ATR.calculate({ high: highs, low: lows, close: closes, period: 14 });
        if (atrArr.length > 0) {
            atr14 = atrArr[atrArr.length - 1] ?? null;
        }
    }

    // 6. Supertrend (10, 3.0)
    const supertrend = calculateSupertrend(highs, lows, closes, 10, 3.0);

    // 7. Volume SMA 20 & RVol
    const volSmaArr = ti.SMA.calculate({ period: 20, values: volumes });
    const volSma20 = volSmaArr.length > 0 ? volSmaArr[volSmaArr.length - 1] : volumes[volumes.length - 1];
    const rvol = volSma20 > 0 ? (latest.volume / volSma20) : 1.0;

    // Trend status determination
    let status = 'SIDEWAYS';
    const isSupertrendBullish = supertrend.isBullish;

    if (ema20 && ema50 && ema20 > ema50 && isSupertrendBullish) {
        status = 'UPTREND';
    } else if (ema20 && ema50 && ema20 < ema50 && !isSupertrendBullish) {
        status = 'DOWNTREND';
    } else if (ema20 && ema50 && ema20 > ema50) {
        status = 'UPTREND';
    } else if (ema20 && ema50 && ema20 < ema50) {
        status = 'DOWNTREND';
    }

    // MA Alignment Status
    let maAlignment = 'Netral';
    if (ema20 && ema50 && ema200) {
        if (latest.close > ema20 && ema20 > ema50 && ema50 > ema200) maAlignment = 'Golden Alignment (Bullish) 🔥';
        else if (ema20 > ema50) maAlignment = 'Bullish Cross (MA20 > MA50) 🟢';
        else if (ema20 < ema50 && ema50 < ema200) maAlignment = 'Death Alignment (Bearish) 🔴';
        else if (ema20 < ema50) maAlignment = 'Bearish Cross (MA20 < MA50) 🔻';
    }

    // Volume Spike Status
    let volumeStatus = 'Volume Normal';
    if (rvol >= 2.0) volumeStatus = 'Volume Spike Ekstrem (2.0x+) 🔥';
    else if (rvol >= 1.3) volumeStatus = 'Volume Akumulasi Kuat (1.3x+) 🚀';
    else if (rvol >= 1.0) volumeStatus = 'Volume Seimbang (1.0x)';
    else volumeStatus = 'Volume Rendah (< 1.0x)';

    // AI Smart Money & Bandarmology Accumulation Index
    const opens = validQuotes.map(q => q.open || q.close);
    const smartMoney = calculateBandarmology(highs, lows, closes, volumes, opens);

    // Pivot Points (Classic Standard & Fibonacci)
    const pivots = calculatePivotPoints(latest.high || latest.close, latest.low || latest.close, latest.close);

    // Candlestick Pattern AI
    const candlestick = detectCandlestickPatterns(validQuotes);

    return {
        close: latest.close,
        prev_close: prev.close,
        volume: latest.volume,
        vol_sma20: volSma20,
        rvol,
        ema20,
        ema50,
        ema200,
        sma20,
        sma50,
        rsi14,
        macd_line: macdLine,
        macd_signal: macdSignal,
        macd_hist: macdHist,
        adx14,
        atr14,
        supertrend,
        status,
        maAlignment,
        volumeStatus,
        smartMoney,
        pivots,
        candlestick,
        engine: 'nodejs'
    };
}

// ═══════════════════════════════════════════════════════════════
//  3. TECHNICAL INDICATORS API (FAST NODE ENGINE WITH PYTHON FALLBACK)
// ═══════════════════════════════════════════════════════════════
async function get_technical_indicators(ticker, timeframe = '1d') {
    const clean = sanitizeTicker(ticker);
    const symbol = (clean === 'IHSG' || clean === '^JKSE') ? '^JKSE' : `${clean}.JK`;

    try {
        // Blazing-fast Node Engine (100-200ms)
        const period1 = new Date(Date.now() - 365 * 24 * 3600 * 1000);
        const chart = await yahooFinance.chart(symbol, { period1, interval: timeframe });
        if (!chart || !chart.quotes || chart.quotes.length === 0) {
            throw new Error(`Data grafik history untuk ${clean} tidak ditemukan.`);
        }
        return processTechnicalData(chart.quotes);
    } catch (nodeErr) {
        // Fallback to Python engine if needed
        return get_technical_indicators_python(clean, timeframe);
    }
}

// Python engine fallback
function get_technical_indicators_python(ticker, timeframe = '1d') {
    return new Promise((resolve, reject) => {
        const clean = sanitizeTicker(ticker);
        const symbol = (clean === 'IHSG' || clean === '^JKSE') ? '^JKSE' : `${clean}.JK`;
        const scriptPath = path.join(__dirname, 'ta_engine.py');
        const command = `python "${scriptPath}" "${symbol}" "${timeframe}"`;

        exec(command, { timeout: 8000 }, (error, stdout) => {
            if (error) {
                return reject(new Error(`Gagal menghitung indikator teknikal: ${error.message}`));
            }
            try {
                const lines = stdout.split('\n');
                let jsonStr = '';
                for (let i = lines.length - 1; i >= 0; i--) {
                    if (lines[i].trim().startsWith('{')) {
                        jsonStr = lines[i];
                        break;
                    }
                }

                const data = JSON.parse(jsonStr);
                if (data.error) return reject(new Error(data.error));

                let status = 'SIDEWAYS';
                const isSupertrendBullish = data.supertrend && data.supertrend.isBullish;
                if (data.ema20 && data.ema50 && data.ema20 > data.ema50 && isSupertrendBullish) {
                    status = 'UPTREND';
                } else if (data.ema20 && data.ema50 && data.ema20 < data.ema50 && !isSupertrendBullish) {
                    status = 'DOWNTREND';
                } else if (data.ema20 && data.ema50 && data.ema20 > data.ema50) {
                    status = 'UPTREND';
                } else if (data.ema20 && data.ema50 && data.ema20 < data.ema50) {
                    status = 'DOWNTREND';
                }

                let maAlignment = 'Netral';
                if (data.ema20 && data.ema50 && data.ema200) {
                    if (data.close > data.ema20 && data.ema20 > data.ema50 && data.ema50 > data.ema200) maAlignment = 'Golden Alignment (Bullish) 🔥';
                    else if (data.ema20 > data.ema50) maAlignment = 'Bullish Cross (MA20 > MA50) 🟢';
                    else if (data.ema20 < data.ema50 && data.ema50 < data.ema200) maAlignment = 'Death Alignment (Bearish) 🔴';
                    else if (data.ema20 < data.ema50) maAlignment = 'Bearish Cross (MA20 < MA50) 🔻';
                }

                let volumeStatus = 'Volume Normal';
                const rvol = data.rvol || 1.0;
                if (rvol >= 2.0) volumeStatus = 'Volume Spike Ekstrem (2.0x+) 🔥';
                else if (rvol >= 1.3) volumeStatus = 'Volume Akumulasi Kuat (1.3x+) 🚀';
                else if (rvol >= 1.0) volumeStatus = 'Volume Seimbang (1.0x)';
                else volumeStatus = 'Volume Rendah (< 1.0x)';

                resolve({
                    ...data,
                    status,
                    maAlignment,
                    volumeStatus,
                    engine: 'python'
                });
            } catch (parseError) {
                reject(new Error(`Gagal parse output engine Python: ${stdout}`));
            }
        });
    });
}

// ═══════════════════════════════════════════════════════════════
//  4. MULTI-FACTOR BULLISH SCORING ENGINE (0-100%)
// ═══════════════════════════════════════════════════════════════
function calcBullishConfidence(price, trendData, changePct, value, intraRange) {
    let score = 0;
    let maxScore = 0;

    // 1. Supertrend Bullish Confirmation (Bobot: 20)
    maxScore += 20;
    const st = trendData.supertrend;
    if (st && st.isBullish) {
        score += 20;
    } else if (st && st.value && price > st.value) {
        score += 15;
    }

    // 2. MA 20 & MA 50 Golden Alignment / Crossover (Bobot: 25)
    maxScore += 25;
    const ema20 = trendData.ema20 || trendData.sma20;
    const ema50 = trendData.ema50 || trendData.sma50;
    const ema200 = trendData.ema200;

    if (ema20 && ema50 && ema200) {
        if (price > ema20 && ema20 > ema50 && ema50 > ema200) score += 25; // Perfect Golden Alignment
        else if (ema20 > ema50 && price > ema50) score += 18;
        else if (price > ema20 && price > ema50) score += 14;
        else if (price > ema200) score += 8;
    } else if (ema20 && ema50) {
        if (price > ema20 && ema20 > ema50) score += 18;
        else if (ema20 > ema50) score += 12;
    }

    // 3. Volume Surge / Relative Volume (RVol) (Bobot: 20)
    maxScore += 20;
    const rvol = trendData.rvol || 1.0;
    if (rvol >= 2.0) score += 20;       // Volume Spike Luar Biasa
    else if (rvol >= 1.4) score += 16;  // Akumulasi Kuat
    else if (rvol >= 1.1) score += 12;  // Minat Beli Meningkat
    else if (rvol >= 0.8) score += 6;

    // 4. RSI Momentum Zone (Bobot: 15)
    maxScore += 15;
    const rsi = trendData.rsi14 || 50;
    if (rsi >= 48 && rsi <= 65) score += 15; // Sweet Spot Momentum
    else if (rsi >= 40 && rsi < 48) score += 12; // Rebound Stage
    else if (rsi > 65 && rsi <= 72) score += 10; // Strong Momentum (near overbought)
    else if (rsi > 72) score += 5; // Danger of exhaustion
    else if (rsi < 35) score += 6; // Oversold

    // 5. MACD Histogram Expansion (Bobot: 10)
    maxScore += 10;
    const macdHist = trendData.macd_hist;
    const macdLine = trendData.macd_line;
    const macdSignal = trendData.macd_signal;
    if (macdHist !== null && macdHist > 0) {
        score += 10;
    } else if (macdLine && macdSignal && macdLine > macdSignal) {
        score += 8;
    }

    // 6. ADX Trend Strength (Bobot: 10)
    maxScore += 10;
    const adx = trendData.adx14 || 0;
    if (adx >= 25 && adx <= 55) score += 10;
    else if (adx >= 20 && adx < 25) score += 7;
    else if (adx > 55) score += 5;

    const pct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
    let label = 'Moderate Bullish';
    if (pct >= 80) label = 'Super Bullish 🔥🚀';
    else if (pct >= 65) label = 'Strong Bullish 🟢';
    else if (pct >= 50) label = 'Bullish Setup ✅';

    return { confidence: pct, label };
}

module.exports = {
    get_technical_indicators,
    calculate_technical_indicators: get_technical_indicators,
    get_technical_indicators_python,
    processTechnicalData,
    calculateSupertrend,
    calcBullishConfidence,
    calculateBandarmology,
    calculatePivotPoints,
    detectCandlestickPatterns,
    calculatePositionSize
};
