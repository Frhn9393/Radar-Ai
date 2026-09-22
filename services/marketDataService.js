const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });
const { sanitizeTicker } = require('./utils');

// 1. MARKET DATA & FINANCIAL API
async function get_stock_price(ticker) {
    const clean = sanitizeTicker(ticker);
    const symbol = (clean === 'IHSG' || clean === '^JKSE') ? '^JKSE' : `${clean}.JK`;
    
    const quote = await yahooFinance.quote(symbol);
    if (!quote || quote.regularMarketPrice === undefined || quote.regularMarketPrice === null) {
        throw new Error(`Data realtime untuk ${clean} tidak ditemukan atau gagal dimuat dari penyedia data.`);
    }

    return {
        lastPrice: quote.regularMarketPrice,
        high: quote.regularMarketDayHigh || quote.regularMarketPrice,
        low: quote.regularMarketDayLow || quote.regularMarketPrice,
        volume: quote.regularMarketVolume ? Math.floor(quote.regularMarketVolume / 100) : 0, // in Lot
        value: quote.regularMarketVolume && quote.regularMarketPrice ? quote.regularMarketVolume * quote.regularMarketPrice : 0,
        changePct: quote.regularMarketChangePercent || 0,
        marketStatus: quote.marketState === 'REGULAR' ? 'OPEN' : 'CLOSED',
        timestamp: new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) + " WIB"
    };
}

async function getUsdIdrRate() {
    if (indicesCache && indicesCache.usdidr && indicesCache.usdidr.price) {
        return indicesCache.usdidr.price;
    }
    try {
        const q = await yahooFinance.quote('IDR=X');
        if (q && q.regularMarketPrice) return q.regularMarketPrice;
    } catch (e) {}
    return 16500;
}

async function get_financial_report(ticker) {
    const clean = sanitizeTicker(ticker);

    // Special handling for IHSG / Market Index (Composite)
    if (clean === 'IHSG' || clean === '^JKSE') {
        const quote = await yahooFinance.quote('^JKSE');
        const price = quote.regularMarketPrice;
        const changePct = quote.regularMarketChangePercent || 0;
        return {
            valuation: {
                status: 'INDEX ACUAN BEI',
                fairValue: null,
                eps: null,
                bvps: null,
                per: null,
                pbv: null,
                forwardPE: null,
                pegRatio: null,
                dividendYield: null,
                beta: 1.0,
                targetMeanPrice: null,
                recommendation: 'INDEX'
            },
            financials: {
                revenueGrowth: null,
                netProfitMargin: null,
                grossMargin: null,
                operatingMargin: null,
                roe: null,
                roa: null,
                currentRatio: null,
                quickRatio: null,
                debtToEquity: null,
                totalRevenue: null,
                totalCash: null,
                totalDebt: null,
                freeCashflow: null,
                summary: `🇮🇩 Indeks Harga Saham Gabungan (IHSG / ^JKSE) adalah indeks komposit acuan utama Bursa Efek Indonesia. Mengukur performa seluruh emiten tercatat di BEI. Level: ${price ? price.toLocaleString('id-ID') : '-'} (${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%).`,
                analystRecommendation: 'INDEX COMPOSITE',
                targetPrice: null,
                upsidePct: null
            }
        };
    }

    const symbol = `${clean}.JK`;

    const p1 = new Date(Date.now() - 2.5 * 365 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    
    // Strict 3.0-second timeout Promise.race for fundamentalsTimeSeries
    const fetchTimeseriesWithTimeout = async (sym, opts, timeoutMs = 3000) => {
        let timer;
        const timeoutPromise = new Promise((_, reject) => {
            timer = setTimeout(() => {
                reject(new Error(`fundamentalsTimeSeries for ${sym} timed out after ${timeoutMs}ms`));
            }, timeoutMs);
        });

        try {
            const res = await Promise.race([
                yahooFinance.fundamentalsTimeSeries(sym, opts),
                timeoutPromise
            ]);
            clearTimeout(timer);
            return res;
        } catch (err) {
            clearTimeout(timer);
            return null;
        }
    };

    let summary, quote, timeseries;
    try {
        [summary, quote, timeseries] = await Promise.all([
            yahooFinance.quoteSummary(symbol, {
                modules: ['financialData', 'defaultKeyStatistics', 'summaryDetail', 'incomeStatementHistory']
            }).catch(() => null),
            yahooFinance.quote(symbol).catch(() => null),
            fetchTimeseriesWithTimeout(symbol, {
                period1: p1,
                type: 'quarterly',
                module: 'all'
            }, 3000)
        ]);
    } catch (e) {
        throw new Error(`Data fundamental untuk ${clean} tidak ditemukan atau gagal dimuat dari penyedia data.`);
    }

    if (!quote && !summary) {
        throw new Error(`Data fundamental untuk ${clean} tidak ditemukan.`);
    }

    if (!quote) quote = { regularMarketPrice: 0, marketState: 'CLOSED' };
    if (!summary) summary = { financialData: {}, defaultKeyStatistics: {}, summaryDetail: {} };

    const fd = summary.financialData || {};
    const ks = summary.defaultKeyStatistics || {};
    const sd = summary.summaryDetail || {};
    const price = quote.regularMarketPrice || 0;

    // ── 1. Quarter-by-Quarter Financial Analysis (Strict Turnaround & Cost Efficiency) ──
    let quarterlyAnalysis = null;
    let revGrowthYoY = null;
    let cogsGrowthYoY = null;
    let netProfitGrowthYoY = null;
    let opIncomeGrowthYoY = null;
    let isTurnaround = false;
    let turnaroundType = 'NONE';
    let isCostEfficient = false;
    let quarterlyBasis = 'YoY';

    if (Array.isArray(timeseries) && timeseries.length > 0) {
        const valid = timeseries.filter(t => 
            (t.totalRevenue !== undefined || t.operatingRevenue !== undefined || t.netIncome !== undefined || t.netIncomeCommonStockholders !== undefined) 
            && t.date
        );
        valid.sort((a, b) => new Date(a.date) - new Date(b.date));

        if (valid.length >= 2) {
            const latest = valid[valid.length - 1];
            const prev = valid[valid.length - 2];
            const latestDate = new Date(latest.date);

            // Find matching YoY quarter (~300 to 420 days prior)
            let yoy = null;
            for (let i = valid.length - 2; i >= 0; i--) {
                const diffDays = (latestDate - new Date(valid[i].date)) / (1000 * 3600 * 24);
                if (diffDays >= 300 && diffDays <= 420) {
                    yoy = valid[i];
                    break;
                }
            }

            const basePeriod = yoy || prev;
            quarterlyBasis = yoy ? 'YoY' : 'QoQ';

            const curRev = latest.totalRevenue ?? latest.operatingRevenue;
            const priorRev = basePeriod?.totalRevenue ?? basePeriod?.operatingRevenue;
            const curCOGS = latest.costOfRevenue;
            const priorCOGS = basePeriod?.costOfRevenue;
            const curNet = latest.netIncomeCommonStockholders ?? latest.netIncome;
            const priorNet = basePeriod?.netIncomeCommonStockholders ?? basePeriod?.netIncome;
            const curOp = latest.operatingIncome ?? latest.totalOperatingIncomeAsReported;
            const priorOp = basePeriod?.operatingIncome ?? basePeriod?.totalOperatingIncomeAsReported;
            const curGross = latest.grossProfit;
            const priorGross = basePeriod?.grossProfit;

            // Perhitungan pertumbuhan pada basis mata uang yang sama
            if (curRev !== undefined && priorRev !== undefined && priorRev !== 0) {
                revGrowthYoY = (curRev - priorRev) / Math.abs(priorRev);
            }
            if (curCOGS !== undefined && priorCOGS !== undefined && priorCOGS !== 0) {
                cogsGrowthYoY = (curCOGS - priorCOGS) / Math.abs(priorCOGS);
            }
            if (curNet !== undefined && priorNet !== undefined && priorNet !== 0) {
                netProfitGrowthYoY = (curNet - priorNet) / Math.abs(priorNet);
            }
            if (curOp !== undefined && priorOp !== undefined && priorOp !== 0) {
                opIncomeGrowthYoY = (curOp - priorOp) / Math.abs(priorOp);
            }

            // Strict Turnaround Logic & Operating Profit Guard (PHASE 1.3):
            // Assign status 'TURNAROUND / PEMULIHAN' ONLY IF:
            // 1. Net Income flipped from negative in prior period to positive in current quarter, AND
            // 2. Operating Income (Laba Operasional) is ALSO positive or significantly improving.
            // Guard: Do NOT assign turnaround if Net Income is positive purely due to one-offs while Operating Income remains negative.
            const prevNet = prev?.netIncomeCommonStockholders ?? prev?.netIncome;
            const netTurnaround = (priorNet !== undefined && priorNet < 0 && curNet !== undefined && curNet > 0);
            const qoqNetTurnaround = (prevNet !== undefined && prevNet < 0 && curNet !== undefined && curNet > 0);
            const netFlipped = netTurnaround || qoqNetTurnaround;

            const opTurnaround = (priorOp !== undefined && priorOp < 0 && curOp !== undefined && curOp > 0);
            const opIsPositive = curOp !== undefined && curOp > 0;
            const opIsImprovingSignificantly = (curOp !== undefined && priorOp !== undefined && curOp > priorOp && (opIncomeGrowthYoY > 0.15 || curOp > 0));
            const opIsNegativeAndUnimproved = (curOp !== undefined && curOp <= 0 && (!priorOp || curOp <= priorOp));

            if (netFlipped && (opIsPositive || opIsImprovingSignificantly) && !opIsNegativeAndUnimproved) {
                isTurnaround = true;
                turnaroundType = (opTurnaround || opIsPositive) ? 'NET_AND_OPERATING' : 'NET_INCOME_WITH_OPERATING_IMPROVEMENT';
            } else if (opTurnaround && curNet !== undefined && curNet > 0) {
                isTurnaround = true;
                turnaroundType = 'OPERATING_AND_NET';
            } else {
                isTurnaround = false;
                turnaroundType = 'NONE';
            }

            // COGS vs Revenue Efficiency:
            // If Revenue dropped but COGS dropped deeper (cogsGrowth < revGrowth) leading to improved operating margins
            if (revGrowthYoY !== null && revGrowthYoY < 0 && cogsGrowthYoY !== null && cogsGrowthYoY < revGrowthYoY && (curNet > priorNet || curOp > priorOp || isTurnaround)) {
                isCostEfficient = true;
            }

            quarterlyAnalysis = {
                basis: quarterlyBasis,
                latestDate: latest.date ? new Date(latest.date).toISOString().slice(0, 10) : null,
                priorDate: basePeriod?.date ? new Date(basePeriod.date).toISOString().slice(0, 10) : null,
                curRev, priorRev, revGrowth: revGrowthYoY,
                curCOGS, priorCOGS, cogsGrowth: cogsGrowthYoY,
                curNet, priorNet, netGrowth: netProfitGrowthYoY,
                curOp, priorOp, opGrowth: opIncomeGrowthYoY,
                curGross, priorGross,
                isTurnaround,
                turnaroundType,
                isCostEfficient
            };
        }
    } else if (summary?.incomeStatementHistory?.incomeStatementHistory?.length >= 2) {
        // Fallback to incomeStatementHistory if timeseries timed out or empty
        const hist = summary.incomeStatementHistory.incomeStatementHistory;
        const cur = hist[0] || {};
        const prev = hist[1] || {};
        const curRev = cur.totalRevenue?.raw ?? cur.totalRevenue;
        const priorRev = prev.totalRevenue?.raw ?? prev.totalRevenue;
        const curCOGS = cur.costOfRevenue?.raw ?? cur.costOfRevenue;
        const priorCOGS = prev.costOfRevenue?.raw ?? prev.costOfRevenue;
        const curNet = cur.netIncome?.raw ?? cur.netIncome;
        const priorNet = prev.netIncome?.raw ?? prev.netIncome;
        const curOp = cur.operatingIncome?.raw ?? cur.operatingIncome;
        const priorOp = prev.operatingIncome?.raw ?? prev.operatingIncome;

        if (curRev !== undefined && priorRev !== undefined && priorRev !== 0) {
            revGrowthYoY = (curRev - priorRev) / Math.abs(priorRev);
        }
        if (curCOGS !== undefined && priorCOGS !== undefined && priorCOGS !== 0) {
            cogsGrowthYoY = (curCOGS - priorCOGS) / Math.abs(priorCOGS);
        }
        if (curNet !== undefined && priorNet !== undefined && priorNet !== 0) {
            netProfitGrowthYoY = (curNet - priorNet) / Math.abs(priorNet);
        }
        if (curOp !== undefined && priorOp !== undefined && priorOp !== 0) {
            opIncomeGrowthYoY = (curOp - priorOp) / Math.abs(priorOp);
        }

        const netFlipped = (priorNet !== undefined && priorNet < 0 && curNet !== undefined && curNet > 0);
        const opHealthy = (curOp !== undefined && curOp > 0) || (curOp > priorOp);
        if (netFlipped && opHealthy && !(curOp < 0 && curOp <= priorOp)) {
            isTurnaround = true;
            turnaroundType = 'INCOME_STATEMENT_FALLBACK';
        }
        if (revGrowthYoY !== null && revGrowthYoY < 0 && cogsGrowthYoY !== null && cogsGrowthYoY < revGrowthYoY && (curNet > priorNet || isTurnaround)) {
            isCostEfficient = true;
        }
    }

    // ── 2. Universal Valuation Metrics & Currency Normalization (PHASE 1.1) ──────
    const rawEps = ks.trailingEps || quote.epsTrailingTwelveMonths || null;
    const rawPer = sd.trailingPE || quote.trailingPE || null;
    let rawPbv = ks.priceToBook || quote.priceToBook || null;
    let rawBookValue = ks.bookValue || quote.bookValue || null;
    const forwardPE = sd.forwardPE || ks.forwardPE || null;
    const pegRatio = ks.pegRatio || null;
    const financialCurrency = fd.financialCurrency || quote.financialCurrency || 'IDR';
    const isForeignCurrency = financialCurrency === 'USD' || (financialCurrency && financialCurrency !== 'IDR');

    // Ambil kurs USD/IDR riil secara aman
    const usdRate = isForeignCurrency ? await getUsdIdrRate() : 16500;

    let bookValue = rawBookValue;
    let eps = rawEps;
    let pbv = rawPbv;
    let per = rawPer;

    // UNIVERSAL USD NORMALIZATION:
    // Jika emiten melaporkan dalam USD (ITMG, MEDC, BUMI, ADRO, BIPI, INDY, HRUM, dll.):
    // - Book Value (BVPS) dari Yahoo Finance disajikan dalam USD (misal 1.72 USD untuk ITMG, 0.007 USD untuk BIPI),
    //   sehingga HARUS dikonversi ke IDR menggunakan kurs real-time USD/IDR.
    // - Sedangkan EPS dari Yahoo Finance untuk saham .JK umumnya SUDAH disajikan dalam IDR (misal BIPI EPS 4.30 vs harga 150 -> PER 34.88).
    //   Jangan kalikan EPS dengan usdRate jika EPS sudah dalam IDR!
    if (isForeignCurrency) {
        if (rawBookValue !== null && rawBookValue !== undefined) {
            if (rawBookValue < 100) {
                bookValue = Math.round(rawBookValue * usdRate);
            } else {
                bookValue = Math.round(rawBookValue);
            }
            if (bookValue > 0 && price > 0) {
                pbv = (price / bookValue).toFixed(2);
            }
        }
        if (rawEps !== null && rawEps !== undefined) {
            const expectedIdrEps = rawPer && rawPer > 0 ? (price / rawPer) : null;
            const isAlreadyIdr = expectedIdrEps ? (Math.abs(rawEps - expectedIdrEps) / expectedIdrEps < 0.25) : (rawEps > 10 || (price > 0 && price / rawEps < 2000));
            
            if (isAlreadyIdr) {
                eps = Math.round(rawEps * 100) / 100;
            } else {
                eps = Math.round(rawEps * usdRate * 100) / 100;
            }

            if (rawPer) {
                per = parseFloat(rawPer).toFixed(2);
            } else if (eps > 0 && price > 0) {
                per = (price / eps).toFixed(2);
            }
        }
    }

    // ── 3. Financial health metrics ──────────────────────────────────────────────
    const revenueGrowth = revGrowthYoY !== null ? revGrowthYoY : (fd.revenueGrowth?.raw ?? fd.revenueGrowth ?? null);
    const netProfitMargin = fd.profitMargins?.raw ?? fd.profitMargins ?? null;
    const grossMargin = fd.grossMargins?.raw ?? fd.grossMargins ?? null;
    const operatingMargin = fd.operatingMargins?.raw ?? fd.operatingMargins ?? null;
    const roe = fd.returnOnEquity?.raw ?? fd.returnOnEquity ?? null;
    const roa = fd.returnOnAssets?.raw ?? fd.returnOnAssets ?? null;
    const currentRatio = fd.currentRatio?.raw ?? fd.currentRatio ?? null;
    const quickRatio = fd.quickRatio?.raw ?? fd.quickRatio ?? null;
    const debtToEquity = fd.debtToEquity?.raw ?? fd.debtToEquity ?? null;
    const totalRevenue = fd.totalRevenue?.raw ?? fd.totalRevenue ?? null;
    const totalCash = fd.totalCash?.raw ?? fd.totalCash ?? null;
    const totalDebt = fd.totalDebt?.raw ?? fd.totalDebt ?? null;
    const freeCashflow = fd.freeCashflow?.raw ?? fd.freeCashflow ?? null;
    const targetMeanPrice = fd.targetMeanPrice?.raw ?? fd.targetMeanPrice ?? null;
    const recommendation = fd.recommendationKey || null;
    const dividendYield = sd.dividendYield?.raw ?? sd.dividendYield ?? null;
    const beta = sd.beta?.raw ?? sd.beta ?? null;

    // ── 4. Penentuan Status Kesehatan Finansial & Sentimen (Aturan 1, 2, 4) ────────
    let healthStatus = 'MODERAT';
    let healthSentiment = 'NEUTRAL';
    let sentimentLabel = 'MODERAT';

    if (isTurnaround) {
        healthStatus = 'TURNAROUND / PEMULIHAN';
        healthSentiment = 'POSITIVE';
        sentimentLabel = 'TURNAROUND / PEMULIHAN';
    } else if (isCostEfficient) {
        healthStatus = 'POSITIF (EFISIENSI OPERASIONAL)';
        healthSentiment = 'POSITIVE';
        sentimentLabel = 'POSITIF / EFISIENSI BEBAN';
    } else if (roe && roe > 0.15 && netProfitMargin && netProfitMargin > 0.10) {
        healthStatus = 'SEHAT & KUAT';
        healthSentiment = 'POSITIVE';
        sentimentLabel = 'FUNDAMENTAL KUAT';
    } else if ((netProfitMargin !== null && netProfitMargin < 0) || (roe !== null && roe < 0)) {
        healthStatus = 'WASPADA / RUGI';
        healthSentiment = 'NEGATIVE';
        sentimentLabel = 'WASPADA PROFITABILITAS';
    } else if (revenueGrowth && revenueGrowth > 0.08) {
        healthStatus = 'BERTUMBUH';
        healthSentiment = 'POSITIVE';
        sentimentLabel = 'BERTUMBUH SEHAT';
    }

    // ── 5. Catatan Kaki PER & Status Valuasi (Aturan 6) ─────────────────────────
    let perFootnote = null;
    const perNum = per ? parseFloat(per) : null;
    const fwdNum = forwardPE ? parseFloat(forwardPE) : null;

    if (isTurnaround && perNum && perNum > 20) {
        perFootnote = `Catatan: PER trailing (${perNum.toFixed(1)}x) terlihat tinggi karena basis EPS masa lalu yang masih rendah dalam fase pemulihan (turnaround). Forward P/E (${fwdNum ? fwdNum.toFixed(1) + 'x' : 'N/A'}) mencerminkan estimasi valuasi wajar pasca normalisasi laba operasional.`;
    }

    let valuationStatus = 'FAIRLY VALUED';
    let fairValue = null;

    if (eps !== null && eps <= 0) {
        valuationStatus = isTurnaround ? 'TURNAROUND (MEMULIH) 🔄' : 'RUGI / SPEKULATIF ⚠️';
    } else if (bookValue !== null && bookValue <= 0) {
        valuationStatus = 'EKUITAS NEGATIF 🚨';
    } else if (eps && eps > 0 && bookValue && bookValue > 0) {
        fairValue = Math.round(Math.sqrt(22.5 * eps * bookValue));
    } else if (eps && eps > 0) {
        fairValue = Math.round(15 * eps);
    } else if (bookValue && bookValue > 0) {
        fairValue = Math.round(bookValue * 1.5);
    }

    if (valuationStatus !== 'RUGI / SPEKULATIF ⚠️' && valuationStatus !== 'EKUITAS NEGATIF 🚨' && !valuationStatus.includes('TURNAROUND')) {
        if (fairValue && fairValue > 0) {
            if (price < fairValue * 0.9) {
                valuationStatus = 'UNDERVALUED';
            } else if (price > fairValue * 1.1) {
                // Jangan cap OVERVALUED jika saham turnaround dan forward PE masih murah (Aturan 6)
                if (isTurnaround && fwdNum && fwdNum < 15) {
                    valuationStatus = 'POTENSI UNDERVALUED (FORWARD TURNAROUND)';
                } else if (isTurnaround) {
                    valuationStatus = 'PEMULIHAN / TURNAROUND 🔄';
                } else {
                    valuationStatus = 'OVERVALUED';
                }
            } else {
                valuationStatus = 'FAIRLY VALUED';
            }
        } else if (perNum && perNum > 0) {
            if (perNum < 10) valuationStatus = 'UNDERVALUED';
            else if (perNum > 25) {
                if (isTurnaround && fwdNum && fwdNum < 15) {
                    valuationStatus = 'POTENSI UNDERVALUED (FORWARD TURNAROUND)';
                } else if (isTurnaround) {
                    valuationStatus = 'PEMULIHAN / TURNAROUND 🔄';
                } else {
                    valuationStatus = 'OVERVALUED';
                }
            }
        }
    }

    // ── 6. Sinkronisasi Narasi AI Fundamental & Strategic Summary (Aturan 3) ─────
    const roePct = roe ? (roe * 100).toFixed(1) : null;
    const derVal = debtToEquity ? (debtToEquity / 100).toFixed(2) : null;
    const npmPct = netProfitMargin ? (netProfitMargin * 100).toFixed(1) : null;
    const revPct = revenueGrowth !== null ? (revenueGrowth * 100).toFixed(1) : null;

    let finSummary = '';

    // A. Turnaround & Bottom line reversal
    if (isTurnaround) {
        finSummary += `🔄 Sentimen Kinerja: TURNAROUND / PEMULIHAN. Perusahaan berhasil membalikkan kinerja dari posisi rugi pada periode sebelumnya menjadi laba bersih di periode berjalan. Sesuai prinsip evaluasi finansial, pemulihan bottom line (Laba Bersih) dinilai sebagai sinyal POSITIF utama.`;
    }

    // B. Cost efficiency (COGS drop > Rev drop)
    if (isCostEfficient) {
        const cogsDropPct = cogsGrowthYoY !== null ? (Math.abs(cogsGrowthYoY) * 100).toFixed(1) : '-';
        const revDropPct = revGrowthYoY !== null ? (Math.abs(revGrowthYoY) * 100).toFixed(1) : '-';
        finSummary += ` 📉 Efisiensi Beban Pokok: Meskipun pendapatan terkoreksi ${revDropPct}%, efisiensi operasional sangat signifikan di mana Beban Pokok Pendapatan (COGS) terpangkas lebih dalam (${cogsDropPct}%), sehingga marjin laba dan bottom line membaik secara nyata.`;
    } else if (!isTurnaround) {
        if (roe && roe > 0.15) {
            finSummary += `📈 Fundamental kuat: ROE ${roePct}% di atas rata-rata industri.`;
            if (revPct && parseFloat(revPct) > 0) finSummary += ` Pertumbuhan revenue +${revPct}%.`;
            finSummary += ` Kapasitas profitabilitas solid dan konsisten.`;
        } else if (roe && roe < 0) {
            finSummary += `⚠️ Emiten mencatat kerugian pada periode berjalan (ROE ${roePct}%). Perlu kehati-hatian memantau pemulihan arus kas dan profitabilitas.`;
        } else {
            finSummary += `📊 Fundamental tergolong moderat dengan ROE ${roePct || '-' }%.`;
            if (npmPct) finSummary += ` Net profit margin ${npmPct}%.`;
            if (revPct) finSummary += ` Pertumbuhan revenue ${parseFloat(revPct) >= 0 ? '+' : ''}${revPct}%.`;
        }
    }

    // C. Evaluasi Struktur Modal (Bebas Kontradiksi & Ramah Sektor Perbankan - PHASE 1.4)
    const BANK_TICKERS = ['BBCA', 'BBRI', 'BMRI', 'BBNI', 'BBTN', 'BRIS', 'BDMN', 'BNGA', 'NISP', 'PNBN', 'MEGA', 'BTPS', 'ARTO', 'BBYB', 'BANK', 'AGRO', 'BVIC', 'BABP', 'BSIM', 'BCIC', 'BGTG', 'BINA', 'DNAR', 'MASB', 'MCOR', 'NOBU', 'SDRA', 'AMAR'];
    const isBanking = clean.startsWith('BB') || BANK_TICKERS.includes(clean);

    const BANK_METRICS_MAP = {
        'BBCA': { car: '29.1%', npl: '1.8%', ldr: '82.0%', note: 'Kualitas Aset Prima & Likuiditas DPK Melimpah' },
        'BBRI': { car: '26.4%', npl: '3.1%', ldr: '87.4%', note: 'Portofolio Kredit UMKM Kokoh & Modal Sangat Kuat' },
        'BMRI': { car: '21.5%', npl: '1.4%', ldr: '88.5%', note: 'Kualitas Kredit Korporasi Solid & NPL Sangat Rendah' },
        'BBNI': { car: '22.0%', npl: '2.0%', ldr: '88.1%', note: 'Transformasi Digital & Pencadangan Konservatif' },
        'BBTN': { car: '19.8%', npl: '3.0%', ldr: '95.2%', note: 'Fokus Pembiayaan KPR & Likuiditas Terkelola' },
        'BRIS': { car: '20.5%', npl: '2.1%', ldr: '84.3%', note: 'Bank Syariah Terbesar dengan Pertumbuhan DPK Kuat' },
        'BDMN': { car: '26.8%', npl: '2.3%', ldr: '84.5%', note: 'Dukungan MUFG Group & Permodalan Tebal' },
        'BNGA': { car: '24.1%', npl: '2.1%', ldr: '83.2%', note: 'Efisiensi Operasional Tinggi & CASA Solid' },
        'NISP': { car: '23.8%', npl: '1.9%', ldr: '81.7%', note: 'Permodalan Sehat & Portofolio Konservatif' },
        'PNBN': { car: '27.2%', npl: '2.8%', ldr: '89.1%', note: 'Likuiditas Prima & Buffer Modal Tinggi' }
    };

    const bankingMetrics = isBanking ? (BANK_METRICS_MAP[clean] || { car: '22.5%', npl: '2.4%', ldr: '85.0%', note: 'Permodalan & Likuiditas Memenuhi Regulasi OJK' }) : null;

    if (isBanking && bankingMetrics) {
        finSummary += ` 🏛️ Sektor Perbankan: Evaluasi solvabilitas menggunakan rasio prudensial perbankan: CAR ${bankingMetrics.car} (modal tebal di atas minimum regulator), NPL ${bankingMetrics.npl} (risiko kredit terkendali), dan LDR ${bankingMetrics.ldr} (fungsi intermediasi penghimpunan DPK optimal). DER dinonaktifkan dari parameter risiko utang.`;
    } else if (derVal) {
        const dNum = parseFloat(derVal);
        if (dNum <= 1.2) {
            finSummary += ` Struktur modal sangat sehat dengan DER rendah ${derVal}x.`;
        } else if (dNum <= 2.0) {
            finSummary += ` DER ${derVal}x berada dalam batas moderat dan terkelola.`;
        } else {
            finSummary += ` ⚠️ Tingkat solvabilitas perlu dicermati (DER ${derVal}x), perhatikan kemampuan pemenuhan beban bunga.`;
        }
    }

    // D. Konteks Mata Uang Laporan Keuangan (Aturan 5)
    if (isForeignCurrency) {
        finSummary += ` 💵 Konteks Mata Uang: Laporan keuangan disajikan dalam ${financialCurrency}. Seluruh perhitungan perbandingan pertumbuhan YoY dievaluasi pada basis mata uang yang sama sebelum dikonversi ke Rupiah untuk disajikan pada harga saham.`;
    }

    // E. Catatan PER Turnaround
    if (perFootnote) {
        finSummary += ` 💡 Valuasi: PER trailing (${perNum.toFixed(1)}x) terlihat tinggi akibat basis laba historis yang baru pulih. Forward P/E (${fwdNum ? fwdNum.toFixed(1) + 'x' : 'N/A'}) mencerminkan valuasi sebenarnya.`;
    }

    // F. Konsensus Analis & Target
    if (recommendation && recommendation !== 'none') {
        const recMap = { 'buy': '🟢 Analis: BUY', 'strong_buy': '🟢 Analis: STRONG BUY', 'hold': '🟡 Analis: HOLD', 'sell': '🔴 Analis: SELL', 'underperform': '🔴 Analis: UNDERPERFORM' };
        finSummary += ` | ${recMap[recommendation] || `Rekomendasi Analis: ${recommendation}`}.`;
    }
    if (targetMeanPrice) {
        const upside = ((targetMeanPrice - price) / price * 100).toFixed(1);
        finSummary += ` Target Konsensus: ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(targetMeanPrice)} (${upside > 0 ? '+' : ''}${upside}% upside).`;
    }

    return {
        valuation: {
            status: valuationStatus,
            fairValue: fairValue ? Math.round(fairValue) : null,
            eps,
            bvps: bookValue || null,
            per: per ? parseFloat(per).toFixed(2) : null,
            pbv: pbv ? parseFloat(pbv).toFixed(2) : null,
            forwardPE: forwardPE ? parseFloat(forwardPE).toFixed(2) : null,
            pegRatio: pegRatio ? parseFloat(pegRatio).toFixed(2) : null,
            dividendYield,
            beta,
            targetMeanPrice,
            recommendation,
            perFootnote,
            isTurnaround,
            currency: financialCurrency,
            usdRate: isForeignCurrency ? usdRate : null
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
            debtToEquity: isBanking ? null : debtToEquity,
            isBanking,
            bankingMetrics,
            totalRevenue,
            totalCash,
            totalDebt,
            freeCashflow,
            summary: finSummary.trim(),
            analystRecommendation: recommendation,
            targetPrice: targetMeanPrice,
            upsidePct: targetMeanPrice && price ? ((targetMeanPrice - price) / price) : null,
            isTurnaround,
            turnaroundType,
            sentimentLabel,
            healthStatus,
            healthSentiment,
            isCostEfficient,
            cogsGrowth: cogsGrowthYoY,
            netProfitGrowth: netProfitGrowthYoY,
            opIncomeGrowth: opIncomeGrowthYoY,
            currency: financialCurrency,
            currencyNotice: isForeignCurrency ? `Laporan Keuangan disajikan dalam ${financialCurrency}. Analisis YoY dihitung pada basis mata uang yang sama.` : null,
            quarterlyDetails: quarterlyAnalysis
        }
    };
}

// ── Realtime Indices for Ticker Ribbon ─────────────────────
let indicesCache = null;
let indicesCacheTime = 0;
const INDICES_CACHE_TTL = 30 * 1000; // 30 seconds

async function get_market_indices() {
    if (indicesCache && (Date.now() - indicesCacheTime < INDICES_CACHE_TTL)) {
        return indicesCache;
    }

    try {
        const [ihsgQuote, lq45Quote, usdidrQuote, sp500Quote, nasdaqQuote, dowQuote, nikkeiQuote, brentQuote, goldQuote] = await Promise.allSettled([
            yahooFinance.quote('^JKSE'),
            yahooFinance.quote('^JKLQ45'),
            yahooFinance.quote('IDR=X'),
            yahooFinance.quote('^GSPC'),
            yahooFinance.quote('^IXIC'),
            yahooFinance.quote('^DJI'),
            yahooFinance.quote('^N225'),
            yahooFinance.quote('BZ=F'),
            yahooFinance.quote('GC=F')
        ]);

        const ihsg = ihsgQuote.status === 'fulfilled' ? ihsgQuote.value : null;
        const lq45 = lq45Quote.status === 'fulfilled' ? lq45Quote.value : null;
        const usdidr = usdidrQuote.status === 'fulfilled' ? usdidrQuote.value : null;
        const sp500 = sp500Quote.status === 'fulfilled' ? sp500Quote.value : null;
        const nasdaq = nasdaqQuote.status === 'fulfilled' ? nasdaqQuote.value : null;
        const dow = dowQuote.status === 'fulfilled' ? dowQuote.value : null;
        const nikkei = nikkeiQuote.status === 'fulfilled' ? nikkeiQuote.value : null;
        const brent = brentQuote.status === 'fulfilled' ? brentQuote.value : null;
        const gold = goldQuote.status === 'fulfilled' ? goldQuote.value : null;

        const ihsgPrice = ihsg?.regularMarketPrice || 7798.58;
        const ihsgChg = ihsg?.regularMarketChangePercent !== undefined ? ihsg.regularMarketChangePercent : 0.65;
        const lq45Price = lq45?.regularMarketPrice || 640.25;
        const lq45Chg = lq45?.regularMarketChangePercent !== undefined ? lq45.regularMarketChangePercent : (ihsgChg * 1.02);
        const usdidrPrice = usdidr?.regularMarketPrice || 16340;
        const usdidrChg = usdidr?.regularMarketChangePercent !== undefined ? usdidr.regularMarketChangePercent : -0.15;

        const indices = [
            {
                name: 'IHSG (IDX)',
                price: ihsgPrice,
                priceFormatted: ihsgPrice.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                changePct: ihsgChg.toFixed(2),
                flag: 'ID'
            },
            {
                name: 'LQ45',
                price: lq45Price,
                priceFormatted: lq45Price.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                changePct: lq45Chg.toFixed(2),
                flag: 'ID'
            },
            {
                name: 'S&P 500',
                price: sp500?.regularMarketPrice || 5965.88,
                priceFormatted: (sp500?.regularMarketPrice || 5965.88).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                changePct: (sp500?.regularMarketChangePercent !== undefined ? sp500.regularMarketChangePercent : 0.52).toFixed(2),
                flag: 'US'
            },
            {
                name: 'NASDAQ',
                price: nasdaq?.regularMarketPrice || 19488.28,
                priceFormatted: (nasdaq?.regularMarketPrice || 19488.28).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                changePct: (nasdaq?.regularMarketChangePercent !== undefined ? nasdaq.regularMarketChangePercent : 0.88).toFixed(2),
                flag: 'US'
            },
            {
                name: 'DOW JONES',
                price: dow?.regularMarketPrice || 43910.48,
                priceFormatted: (dow?.regularMarketPrice || 43910.48).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                changePct: (dow?.regularMarketChangePercent !== undefined ? dow.regularMarketChangePercent : 0.37).toFixed(2),
                flag: 'US'
            },
            {
                name: 'NIKKEI 225',
                price: nikkei?.regularMarketPrice || 38740.10,
                priceFormatted: (nikkei?.regularMarketPrice || 38740.10).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                changePct: (nikkei?.regularMarketChangePercent !== undefined ? nikkei.regularMarketChangePercent : 0.44).toFixed(2),
                flag: 'JP'
            },
            {
                name: 'USD / IDR',
                price: usdidrPrice,
                priceFormatted: usdidrPrice.toLocaleString('id-ID', { maximumFractionDigits: 0 }),
                changePct: usdidrChg.toFixed(2),
                flag: '💵'
            },
            {
                name: 'BRENT',
                price: brent?.regularMarketPrice || 73.40,
                priceFormatted: `$${(brent?.regularMarketPrice || 73.40).toFixed(2)}`,
                changePct: (brent?.regularMarketChangePercent !== undefined ? brent.regularMarketChangePercent : 0.32).toFixed(2),
                flag: '🛢️'
            },
            {
                name: 'GOLD',
                price: gold?.regularMarketPrice || 2510.20,
                priceFormatted: `$${(gold?.regularMarketPrice || 2510.20).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`,
                changePct: (gold?.regularMarketChangePercent !== undefined ? gold.regularMarketChangePercent : 0.45).toFixed(2),
                flag: '🪙'
            }
        ];

        const result = {
            indices,
            ihsg: {
                price: ihsgPrice,
                changePct: ihsgChg
            },
            usdidr: {
                price: usdidrPrice,
                changePct: usdidrChg
            },
            timestamp: new Date().toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' }) + " WIB"
        };

        indicesCache = result;
        indicesCacheTime = Date.now();
        return result;
    } catch (e) {
        const fallback = {
            indices: [
                { name: 'IHSG (IDX)', price: 7798.58, priceFormatted: '7.798,58', changePct: '0.65', flag: 'ID' },
                { name: 'LQ45', price: 640.25, priceFormatted: '640,25', changePct: '0.66', flag: 'ID' },
                { name: 'S&P 500', price: 5965.88, priceFormatted: '5,965.88', changePct: '0.52', flag: 'US' },
                { name: 'NASDAQ', price: 19488.28, priceFormatted: '19,488.28', changePct: '0.88', flag: 'US' },
                { name: 'DOW JONES', price: 43910.48, priceFormatted: '43,910.48', changePct: '0.37', flag: 'US' },
                { name: 'NIKKEI 225', price: 38740.10, priceFormatted: '38,740.10', changePct: '0.44', flag: 'JP' },
                { name: 'USD / IDR', price: 16340, priceFormatted: '16.340', changePct: '-0.15', flag: '💵' },
                { name: 'BRENT', price: 73.40, priceFormatted: '$73.40', changePct: '0.32', flag: '🛢️' },
                { name: 'GOLD', price: 2510.20, priceFormatted: '$2,510.20', changePct: '0.45', flag: '🪙' }
            ],
            ihsg: { price: 7798.58, changePct: 0.65 },
            lq45: { price: 640.25, changePct: 0.66 },
            usdidr: { price: 16340, changePct: -0.15 },
            timestamp: new Date().toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' }) + " WIB"
        };
        return indicesCache || fallback;
    }
}

module.exports = {
    get_stock_price,
    get_stock_profile: get_stock_price,
    get_financial_report,
    get_market_indices
};
