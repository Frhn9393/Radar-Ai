const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });
const { exec } = require('child_process');
const path = require('path');
const Parser = require('rss-parser');
const parser = new Parser();

// 1. MARKET DATA & FINANCIAL API
async function get_stock_price(ticker) {
    const symbol = `${ticker.toUpperCase()}.JK`;
    const quote = await yahooFinance.quote(symbol);
    if (!quote) {
        throw new Error(`Data realtime untuk ${ticker} tidak ditemukan atau gagal dimuat dari penyedia data.`);
    }
    
    // foreign flow isn't cleanly available via yfinance in real time for IDX, simulating/omitting cleanly
    return {
        lastPrice: quote.regularMarketPrice,
        high: quote.regularMarketDayHigh,
        low: quote.regularMarketDayLow,
        volume: quote.regularMarketVolume ? Math.floor(quote.regularMarketVolume / 100) : 0, // in Lot
        value: quote.regularMarketVolume && quote.regularMarketPrice ? quote.regularMarketVolume * quote.regularMarketPrice : 0,
        changePct: quote.regularMarketChangePercent,
        marketStatus: quote.marketState === 'REGULAR' ? 'OPEN' : 'CLOSED',
        timestamp: new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) + " WIB"
    };
}

async function get_financial_report(ticker) {
    const symbol = `${ticker.toUpperCase()}.JK`;

    // yahoo-finance2 v4: use quoteSummary for detailed fundamental data
    // Modules: financialData, defaultKeyStatistics, summaryDetail, incomeStatementHistory
    let summary, quote;
    try {
        [summary, quote] = await Promise.all([
            yahooFinance.quoteSummary(symbol, {
                modules: ['financialData', 'defaultKeyStatistics', 'summaryDetail', 'incomeStatementHistory']
            }),
            yahooFinance.quote(symbol)
        ]);
    } catch (e) {
        throw new Error(`Data fundamental untuk ${ticker} tidak ditemukan atau gagal dimuat dari penyedia data.`);
    }

    if (!summary || !quote) {
        throw new Error(`Data fundamental untuk ${ticker} tidak ditemukan.`);
    }

    const fd = summary.financialData || {};
    const ks = summary.defaultKeyStatistics || {};
    const sd = summary.summaryDetail || {};
    const price = quote.regularMarketPrice;

    // ── Valuation metrics ─────────────────────────────────
    const eps        = ks.trailingEps     || quote.epsTrailingTwelveMonths || null;
    const per        = sd.trailingPE      || quote.trailingPE              || null;
    const pbv        = ks.priceToBook     || quote.priceToBook             || null;
    const bookValue  = ks.bookValue       || quote.bookValue               || null;
    const forwardPE  = sd.forwardPE       || ks.forwardPE                  || null;
    const pegRatio   = ks.pegRatio                                         || null;

    // ── Financial health metrics ──────────────────────────
    const revenueGrowth    = fd.revenueGrowth?.raw    ?? fd.revenueGrowth    ?? null;
    const netProfitMargin  = fd.profitMargins?.raw     ?? fd.profitMargins    ?? null;
    const grossMargin      = fd.grossMargins?.raw      ?? fd.grossMargins     ?? null;
    const operatingMargin  = fd.operatingMargins?.raw  ?? fd.operatingMargins ?? null;
    const roe              = fd.returnOnEquity?.raw    ?? fd.returnOnEquity   ?? null;
    const roa              = fd.returnOnAssets?.raw    ?? fd.returnOnAssets   ?? null;
    const currentRatio     = fd.currentRatio?.raw      ?? fd.currentRatio     ?? null;
    const quickRatio       = fd.quickRatio?.raw        ?? fd.quickRatio       ?? null;
    const debtToEquity     = fd.debtToEquity?.raw      ?? fd.debtToEquity     ?? null;
    const totalRevenue     = fd.totalRevenue?.raw      ?? fd.totalRevenue     ?? null;
    const totalCash        = fd.totalCash?.raw         ?? fd.totalCash        ?? null;
    const totalDebt        = fd.totalDebt?.raw         ?? fd.totalDebt        ?? null;
    const freeCashflow     = fd.freeCashflow?.raw      ?? fd.freeCashflow     ?? null;
    const targetMeanPrice  = fd.targetMeanPrice?.raw   ?? fd.targetMeanPrice  ?? null;
    const recommendation   = fd.recommendationKey                            || null;
    const dividendYield    = sd.dividendYield?.raw     ?? sd.dividendYield    ?? null;
    const beta             = sd.beta?.raw              ?? sd.beta             ?? null;

    // ── Valuation Logic ───────────────────────────────────
    let valuationStatus = 'FAIRLY VALUED';
    let fairValue = null;
    if (eps && eps > 0) {
        fairValue = 15 * eps; // Graham Number baseline
        if (price < fairValue * 0.8) valuationStatus = 'UNDERVALUED';
        else if (price > fairValue * 1.2) valuationStatus = 'OVERVALUED';
    } else if (bookValue && pbv) {
        fairValue = bookValue * 1.5;
        if (price < bookValue) valuationStatus = 'UNDERVALUED';
        else if (price > fairValue * 1.2) valuationStatus = 'OVERVALUED';
    }
    // Analyst target price override
    if (targetMeanPrice) {
        const upside = ((targetMeanPrice - price) / price) * 100;
        if (upside > 20) valuationStatus = 'UNDERVALUED';
        else if (upside < -20) valuationStatus = 'OVERVALUED';
    }

    // ── AI Financial Summary ──────────────────────────────
    const roePct = roe ? (roe * 100).toFixed(1) : null;
    const derVal = debtToEquity ? debtToEquity.toFixed(2) : null;
    const npmPct = netProfitMargin ? (netProfitMargin * 100).toFixed(1) : null;
    const revPct = revenueGrowth ? (revenueGrowth * 100).toFixed(1) : null;

    let finSummary = 'Data laporan keuangan terbatas dari penyedia data.';
    
    // Bank stocks often don't have DER or current ratios on Yahoo Finance.
    // If we at least have ROE, we can provide a basic fundamental summary.
    if (roePct) {
        if (roe > 0.15) {
            finSummary = `📈 Fundamental kuat: ROE ${roePct}% di atas rata-rata industri.`;
            if (derVal) {
                finSummary += ` DER ${derVal}x (struktur modal sehat).`;
            } else {
                finSummary += ` (Data utang spesifik tidak tersedia, umum untuk sektor perbankan).`;
            }
            if (revPct) finSummary += ` Pertumbuhan revenue ${revPct}%.`;
            finSummary += ` Laba berpotensi terus bertumbuh.`;
        } else if (roe < 0) {
            finSummary = `⚠️ Perusahaan sedang mencatat kerugian (ROE ${roePct}%). Perlu kehati-hatian pada profitabilitas sebelum investasi.`;
        } else {
            finSummary = `📊 Fundamental moderat: ROE ${roePct}%.`;
            if (derVal) finSummary += ` DER ${derVal}x.`;
            if (npmPct) finSummary += ` Net profit margin ${npmPct}%.`;
            if (revPct) finSummary += ` Revenue growth ${revPct}%.`;
        }

        if (derVal && debtToEquity > 200) {
            finSummary = `⚠️ Utang tinggi (DER ${derVal}x). ROE ${roePct}%. Pantau kemampuan bayar bunga dan arus kas bebas sebelum masuk.`;
        }
        
        if (recommendation) {
            const recMap = { 'buy':'🟢 Analis: BUY', 'strong_buy':'🟢 Analis: STRONG BUY', 'hold':'🟡 Analis: HOLD', 'sell':'🔴 Analis: SELL', 'underperform':'🔴 Analis: UNDERPERFORM' };
            finSummary += ` | ${recMap[recommendation] || `Rekomendasi Analis: ${recommendation}`}.`;
        }
        if (targetMeanPrice) {
            const upside = ((targetMeanPrice - price) / price * 100).toFixed(1);
            finSummary += ` Target Konsensus Analis: ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(targetMeanPrice)} (${upside > 0 ? '+' : ''}${upside}% upside).`;
        }
    }

    return {
        valuation: {
            status:      valuationStatus,
            fairValue:   fairValue ? Math.round(fairValue) : null,
            eps,
            bvps:        bookValue || null,
            per:         per  ? parseFloat(per).toFixed(2)  : null,
            pbv:         pbv  ? parseFloat(pbv).toFixed(2)  : null,
            forwardPE:   forwardPE ? parseFloat(forwardPE).toFixed(2) : null,
            pegRatio:    pegRatio  ? parseFloat(pegRatio).toFixed(2)  : null,
            dividendYield,
            beta,
            targetMeanPrice,
            recommendation
        },
        financials: {
            revenueGrowth,
            netProfitMargin,
            grossMargin,
            operatingMargin,
            roe,
            roa,
            currentRatio,
            quickRatio,
            debtToEquity,
            totalRevenue,
            totalCash,
            totalDebt,
            freeCashflow,
            summary: finSummary
        }
    };
}

// 2. TECHNICAL INDICATOR ENGINE

function get_technical_indicators(ticker, timeframe = '1d') {
    return new Promise((resolve, reject) => {
        const symbol = `${ticker.toUpperCase()}.JK`;
        const scriptPath = path.join(__dirname, 'ta_engine.py');
        const command = `python "${scriptPath}" "${symbol}" "${timeframe}"`;
        
        exec(command, (error, stdout, stderr) => {
            if (error) {
                return reject(new Error(`Gagal menghitung indikator teknikal: ${error.message}`));
            }
            try {
                // Ignore any deprecation warnings from pandas by extracting only the JSON line
                const lines = stdout.split('\n');
                let jsonStr = '';
                for (let i = lines.length - 1; i >= 0; i--) {
                    if (lines[i].trim().startsWith('{')) {
                        jsonStr = lines[i];
                        break;
                    }
                }
                
                const data = JSON.parse(jsonStr);
                if (data.error) {
                    return reject(new Error(data.error));
                }

                // Determine trend based strictly on Python engine return values
                const currentPriceObj = data; // We don't have current price in python return directly, 
                                              // we will combine it later, but we can determine trend from EMAs
                let status = 'SIDEWAYS';
                if (data.ema20 > data.ema50 && data.ema50 > data.ema200) {
                    status = 'UPTREND';
                } else if (data.ema20 < data.ema50 && data.ema50 < data.ema200) {
                    status = 'DOWNTREND';
                }
                
                resolve({
                    ...data,
                    status
                });

            } catch (parseError) {
                reject(new Error(`Gagal parse output engine Python: ${stdout}`));
            }
        });
    });
}

// 3. WEB SEARCH & NEWS ENGINE
async function fetch_corporate_news(ticker) {
    try {
        const query = `"${ticker}" akuisisi OR merger OR tender offer site:kontan.co.id OR site:bisnis.com OR site:cnbcindonesia.com`;
        const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=id&gl=ID&ceid=ID:id`;
        
        const feed = await parser.parseURL(url);
        
        // Filter last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const recentNews = feed.items.filter(item => {
            const pubDate = new Date(item.pubDate);
            return pubDate >= thirtyDaysAgo;
        }).map(item => ({
            title: item.title,
            source: item.source || "Google News",
            link: item.link,
            date: new Date(item.pubDate).toLocaleString('id-ID'),
            impact: "Berpotensi mempengaruhi struktur modal, valuasi, atau likuiditas."
        }));

        return recentNews.slice(0, 5); // top 5
    } catch (e) {
        console.error("Gagal menarik berita:", e.message);
        return [];
    }
}

// 4. MARKET NEWS ENGINE — Dashboard Realtime News
async function fetch_market_news() {
    try {
        // Multiple queries to cover broad Indonesian market news
        const queries = [
            'IHSG hari ini site:kontan.co.id OR site:bisnis.com OR site:cnbcindonesia.com',
            'pasar saham Indonesia site:kontan.co.id OR site:bisnis.com OR site:cnbcindonesia.com',
            'bursa efek Indonesia saham site:kontan.co.id OR site:bisnis.com OR site:cnbcindonesia.com',
            'emiten IPO akuisisi dividen site:kontan.co.id OR site:bisnis.com OR site:cnbcindonesia.com'
        ];

        const allNews = [];
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        for (const query of queries) {
            try {
                const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=id&gl=ID&ceid=ID:id`;
                const feed = await parser.parseURL(url);

                const items = feed.items
                    .filter(item => {
                        const pubDate = new Date(item.pubDate);
                        return pubDate >= sevenDaysAgo;
                    })
                    .map(item => {
                        // Extract source from title (Google News format: "Title - Source")
                        const titleParts = item.title.split(' - ');
                        const source = titleParts.length > 1 ? titleParts.pop().trim() : 'Google News';
                        const title = titleParts.join(' - ').trim();

                        // Categorize news
                        const titleLower = title.toLowerCase();
                        let category = 'Market';
                        if (titleLower.includes('ihsg') || titleLower.includes('indeks')) category = 'IHSG';
                        else if (titleLower.includes('dividen')) category = 'Dividen';
                        else if (titleLower.includes('ipo')) category = 'IPO';
                        else if (titleLower.includes('akuisisi') || titleLower.includes('merger')) category = 'Aksi Korporasi';
                        else if (titleLower.includes('obligasi') || titleLower.includes('sbn')) category = 'Obligasi';
                        else if (titleLower.includes('rupiah') || titleLower.includes('kurs')) category = 'Valas';
                        else if (titleLower.includes('inflasi') || titleLower.includes('bi rate') || titleLower.includes('suku bunga')) category = 'Makro';

                        return {
                            title,
                            source,
                            link: item.link,
                            pubDate: new Date(item.pubDate).toISOString(),
                            category
                        };
                    });

                allNews.push(...items);
            } catch (feedErr) {
                console.error(`Gagal menarik feed: ${feedErr.message}`);
            }
        }

        // Deduplicate by title similarity and sort by date descending
        const seen = new Set();
        const unique = allNews.filter(n => {
            const key = n.title.substring(0, 50).toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        unique.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

        return {
            news: unique.slice(0, 15),
            lastUpdated: new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) + ' WIB'
        };
    } catch (e) {
        console.error('Gagal menarik berita pasar:', e.message);
        return { news: [], lastUpdated: null, error: 'Gagal memuat berita pasar.' };
    }
}

// Main Analyze Function
async function analyzeStock(ticker) {
    try {
        const realtime = await get_stock_price(ticker);
        const { valuation, financials } = await get_financial_report(ticker);
        const trend = await get_technical_indicators(ticker, '1d');
        const news = await fetch_corporate_news(ticker);

        // Adjust trend based on exact price vs EMA if we want more precision
        if (realtime.lastPrice > trend.ema20 && trend.ema20 > trend.ema50) trend.status = 'UPTREND';
        else if (realtime.lastPrice < trend.ema20 && trend.ema20 < trend.ema50) trend.status = 'DOWNTREND';

        return {
            ticker: ticker.toUpperCase(),
            realtime,
            valuation,
            financials,
            trend,
            news
        };
    } catch (error) {
        if (error.message.includes('tidak ditemukan')) {
            throw error;
        }
        throw new Error(`Data realtime untuk ${ticker} tidak ditemukan atau gagal dimuat dari penyedia data.`);
    }
}

async function runScreener() {
    // Watchlist diperluas mencakup saham likuid IHSG (LQ45, IDX80, Kompas100)
    // Saham akan difilter secara otomatis dari kriteria 'gorengan' di bawah
    const watchlist = [
        // ── LQ45 (Terbaru) ─────────────────────────────────────────
        // Masuk: INDY, NCKL, ANTM, AKRA. Keluar: SMGR, TOWR.
        'BBCA', 'BBRI', 'BMRI', 'BBNI', 'TLKM', 'ASII', 'AMMN', 'BREN', 'GOTO', 'BRPT',
        'UNVR', 'ICBP', 'INDF', 'KLBF', 'ADRO', 'PGAS', 'PTBA', 'UNTR', 'CPIN', 'MDKA',
        'ARTO', 'BRIS', 'EMTK', 'ESSA', 'EXCL', 'HRUM', 'INKP', 'INCO', 'ITMG', 'MAPI',
        'MBMA', 'MEDC', 'MTEL', 'TINS', 'TPIA', 'SMRA', 'BSDE', 'INDY', 'NCKL', 'ANTM', 'AKRA',
        
        // ── IHSG Komponen Tambahan (Likuid & Non-Gorengan) ───────
        'ACES', 'AUTO', 'BBTN', 'BJTM', 'BTPS', 'CTRA', 'DMAS', 'ERAA', 'GGRM', 'HMSP', 
        'JPFA', 'JSMR', 'LPPF', 'MIKA', 'MNCN', 'PNBN', 'PWON', 'SCMA', 'SRTG', 'SIDO', 
        'SMMA', 'SSIA', 'TKIM', 'WIKA', 'WSKT', 'PGEO', 'ISAT', 'HEAL', 'SMGR', 'TOWR',
        'SILO', 'MYOR', 'MAPA', 'MIDI', 'AVIA', 'BRMS', 'BUKA', 'AGRO', 'ASRI', 'BSBK'
    ];

    const results = {
        scalping: [],
        daytrade: [],
        swing: [],
        bsjp: [],      // Beli Sore Jual Pagi
        bpjp: [],      // Beli Pagi Jual Pagi
        longterm: []   // Investasi Jangka Panjang
    };

    // ═══════════════════════════════════════════════════════════════
    //  FUNGSI HITUNG CONFIDENCE BULLISH (0-100%)
    //  Menggabungkan beberapa indikator teknikal menjadi satu skor
    // ═══════════════════════════════════════════════════════════════
    function calcBullishConfidence(price, trendData, changePct, value, intraRange) {
        let score = 0;
        let maxScore = 0;

        // 1. Trend EMA Alignment (bobot: 25)
        maxScore += 25;
        if (trendData.ema20 && trendData.ema50 && trendData.ema200) {
            if (trendData.ema20 > trendData.ema50 && trendData.ema50 > trendData.ema200) score += 25; // Golden alignment
            else if (trendData.ema20 > trendData.ema50) score += 15;
            else if (price > trendData.ema200) score += 8;
        } else if (trendData.ema20 && trendData.ema50) {
            if (trendData.ema20 > trendData.ema50) score += 15;
        }

        // 2. RSI Zone (bobot: 20)
        maxScore += 20;
        const rsi = trendData.rsi14 || 50;
        if (rsi >= 45 && rsi <= 60) score += 20;       // Sweet spot — bullish tapi belum overbought
        else if (rsi >= 35 && rsi < 45) score += 15;   // Oversold recovery zone
        else if (rsi > 60 && rsi <= 70) score += 10;   // Masih oke
        else if (rsi < 35) score += 8;                 // Deep oversold (bounce potential)

        // 3. MACD Bullish (bobot: 20)
        maxScore += 20;
        if (trendData.macd_line && trendData.macd_signal) {
            const macdDiff = trendData.macd_line - trendData.macd_signal;
            if (macdDiff > 0 && trendData.macd_line > 0) score += 20;       // Strong bullish
            else if (macdDiff > 0) score += 14;                             // Bullish crossover
            else if (macdDiff > -0.5) score += 5;                           // Near crossover
        }

        // 4. ADX Trend Strength (bobot: 15)
        maxScore += 15;
        const adx = trendData.adx14 || 0;
        if (adx >= 25 && adx <= 50) score += 15;       // Strong trend tanpa over-extended
        else if (adx >= 20 && adx < 25) score += 10;
        else if (adx > 50) score += 5;                 // Terlalu kuat, mungkin exhaustion

        // 5. Perubahan Harga Positif (bobot: 10)
        maxScore += 10;
        if (changePct >= 2) score += 10;
        else if (changePct >= 1) score += 7;
        else if (changePct >= 0) score += 4;

        // 6. Likuiditas Value (bobot: 10)
        maxScore += 10;
        if (value > 50000000000) score += 10;           // > 50 Miliar — sangat likuid
        else if (value > 20000000000) score += 8;
        else if (value > 5000000000) score += 5;

        const pct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
        let label = 'Moderate Bullish';
        if (pct >= 75) label = 'Sangat Bullish 🔥';
        else if (pct >= 55) label = 'Bullish ✅';

        return { confidence: pct, label };
    }

    for (const ticker of watchlist) {
        try {
            const priceData = await get_stock_price(ticker);
            const trendData = await get_technical_indicators(ticker, '1d');
            const price = priceData.lastPrice;
            const changePct = priceData.changePct || 0;
            const value = priceData.value || 0;
            const volume = priceData.volume || 0;
            const high = priceData.high || price;
            const low = priceData.low || price;
            const intraRange = price > 0 ? ((high - low) / low) * 100 : 0;
            const rsi = trendData.rsi14 || 50;
            const adx = trendData.adx14 || 0;

            // ─── FILTER ANTI-GORENGAN (Safeguard) ─────────────────────
            if (value < 2000000000 || volume < 10000 || intraRange > 25) {
                continue;
            }

            // Hitung confidence untuk semua saham yang lolos filter
            const { confidence, label } = calcBullishConfidence(price, trendData, changePct, value, intraRange);

            // ─── 1. SCALPING — DIPERKETAT ────────────────────────────────
            // Harus: Value >10M, perubahan >2%, range intraday >1.5%, RSI 35-70, ADX >20
            if (
                value > 10000000000 &&
                Math.abs(changePct) > 2 &&
                intraRange > 1.5 &&
                rsi > 35 && rsi < 70 &&
                adx > 20 &&
                confidence >= 50
            ) {
                results.scalping.push({
                    ticker, price, changePct: changePct.toFixed(2),
                    range: intraRange.toFixed(2),
                    targetProfit: (price * 1.015).toFixed(0),
                    stopLoss: (price * 0.99).toFixed(0),
                    confidence, label
                });
            }

            // ─── 2. DAYTRADE — DIPERKETAT ─────────────────────────────────
            // Harus: changePct >1.5%, EMA20 > EMA50, MACD bullish, ADX >22, value >8M
            const macdBullish = trendData.macd_line && trendData.macd_signal &&
                                trendData.macd_line > trendData.macd_signal;
            if (
                changePct > 1.5 &&
                trendData.ema20 && trendData.ema50 &&
                trendData.ema20 > trendData.ema50 &&
                macdBullish &&
                adx > 22 &&
                value > 8000000000 &&
                confidence >= 55
            ) {
                results.daytrade.push({
                    ticker, price, changePct: changePct.toFixed(2),
                    entryZone: `${(price * 0.995).toFixed(0)} - ${price}`,
                    targetProfit: (price * 1.03).toFixed(0),
                    stopLoss: (price * 0.985).toFixed(0),
                    confidence, label
                });
            }

            // ─── 3. SWING TRADE — DIPERKETAT ──────────────────────────────
            // Harus: UPTREND, harga dekat EMA50 (<3%), RSI 40-62, EMA20>EMA50, value >5M
            if (
                trendData.status === 'UPTREND' &&
                trendData.ema50 && trendData.ema20 &&
                trendData.ema20 > trendData.ema50 &&
                rsi >= 40 && rsi <= 62
            ) {
                const distFromEma50 = Math.abs(price - trendData.ema50) / trendData.ema50;
                if (distFromEma50 < 0.03 && value > 5000000000 && confidence >= 55) {
                    results.swing.push({
                        ticker, price, changePct: changePct.toFixed(2),
                        areaBuy: `${(trendData.ema50 * 0.98).toFixed(0)} - ${(trendData.ema50 * 1.01).toFixed(0)}`,
                        targetPrice1: (price * 1.08).toFixed(0),
                        targetPrice2: (price * 1.15).toFixed(0),
                        cutLoss: (trendData.ema50 * 0.95).toFixed(0),
                        riskReward: "1:3",
                        confidence, label
                    });
                }
            }

            // ─── 4. BSJP — DIPERKETAT ────────────────────────────────────
            // Harus: RSI 42-62, pullback 1-4%, value >8M, di atas EMA20, EMA20>EMA50, MACD bullish
            const pullbackFromHigh = high > 0 ? ((high - price) / high) * 100 : 0;
            if (
                rsi > 42 && rsi < 62 &&
                pullbackFromHigh > 1 && pullbackFromHigh < 4 &&
                value > 8000000000 &&
                trendData.ema20 && trendData.ema50 &&
                price > trendData.ema20 &&
                trendData.ema20 > trendData.ema50 &&
                macdBullish &&
                confidence >= 55
            ) {
                results.bsjp.push({
                    ticker, price, changePct: changePct.toFixed(2),
                    rsi: rsi.toFixed(1),
                    pullbackFromHigh: pullbackFromHigh.toFixed(2),
                    beliSore: `Sesi II (14:30-15:00) ≤ ${price}`,
                    targetPagi: (price * 1.02).toFixed(0),
                    stopLoss: (low * 0.995).toFixed(0),
                    estimasiGain: '1-3%',
                    riskReward: '1:2',
                    confidence, label
                });
            }

            // ─── 5. BPJP — DIPERKETAT ────────────────────────────────────
            // Harus: RSI <38 (sangat oversold), ADX >25, MACD bullish, value >5M, EMA alignment
            if (
                rsi < 38 &&
                adx > 25 &&
                macdBullish &&
                value > 5000000000 &&
                trendData.ema20 && trendData.ema50 &&
                confidence >= 45
            ) {
                results.bpjp.push({
                    ticker, price, changePct: changePct.toFixed(2),
                    rsi: rsi.toFixed(1),
                    adx: adx.toFixed(1),
                    macd: trendData.macd_line ? trendData.macd_line.toFixed(2) : 'N/A',
                    entryPagi: `Opening (09:00-09:30) ≤ ${price}`,
                    target: (price * 1.025).toFixed(0),
                    stopLoss: (price * 0.988).toFixed(0),
                    jualSebelum: '12:00 WIB',
                    estimasiGain: '1.5-3%',
                    confidence, label
                });
            }

            // ─── 6. JANGKA PANJANG — DIPERKETAT ──────────────────────────
            // Harus: Golden Alignment (EMA20>50>200), RSI 40-58, dekat EMA200 (<7%), value >8M
            if (trendData.ema200 && trendData.ema50 && trendData.ema20) {
                const emaGoldenAlignment = trendData.ema20 > trendData.ema50 && trendData.ema50 > trendData.ema200;
                const aboveEma200 = price > trendData.ema200;
                const nearEma200 = Math.abs(price - trendData.ema200) / trendData.ema200 < 0.07;
                if (
                    aboveEma200 &&
                    emaGoldenAlignment &&
                    rsi >= 40 && rsi <= 58 &&
                    nearEma200 &&
                    value > 8000000000 &&
                    confidence >= 60
                ) {
                    results.longterm.push({
                        ticker, price, changePct: changePct.toFixed(2),
                        rsi: rsi.toFixed(1),
                        ema200: trendData.ema200.toFixed(0),
                        support: (trendData.ema200 * 0.97).toFixed(0),
                        targetKonservatif: (price * 1.20).toFixed(0),
                        targetAgresif: (price * 1.40).toFixed(0),
                        cutLoss: (trendData.ema200 * 0.93).toFixed(0),
                        horizon: '6-12 Bulan',
                        sinyalEntri: 'Golden Alignment ✓',
                        confidence, label
                    });
                }
            }
        } catch (e) {
            console.error(`Screener error for ${ticker}:`, e.message);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //  SORT berdasarkan CONFIDENCE (tertinggi di atas)
    //  dan LIMIT hasil agar tidak kebanyakan
    // ═══════════════════════════════════════════════════════════════
    results.scalping.sort((a, b) => b.confidence - a.confidence);
    results.daytrade.sort((a, b) => b.confidence - a.confidence);
    results.swing.sort((a, b) => b.confidence - a.confidence);
    results.bsjp.sort((a, b) => b.confidence - a.confidence);
    results.bpjp.sort((a, b) => b.confidence - a.confidence);
    results.longterm.sort((a, b) => b.confidence - a.confidence);

    // Cap maksimum per kategori agar tidak overwhelming
    results.scalping = results.scalping.slice(0, 5);
    results.daytrade = results.daytrade.slice(0, 5);
    results.swing = results.swing.slice(0, 8);
    results.bsjp = results.bsjp.slice(0, 5);
    results.bpjp = results.bpjp.slice(0, 5);
    results.longterm = results.longterm.slice(0, 8);

    return results;
}


module.exports = {
    get_stock_price,
    get_financial_report,
    get_technical_indicators,
    analyzeStock,
    runScreener,
    fetch_market_news
};
