// ============================================================
//  MODULE: analysisModal.js
//  Detailed stock analysis modal, technical indicators, and rights issue tebus
// ============================================================

// ============================================================
//  4. DEEP STOCK ANALYSIS MODAL
// ============================================================
let stockAnalysisRequestId = 0;
function updateModalWatchlistButton(ticker) {
    if (!btnModalToggleWatchlist || !textModalWatchlist) return;
    const isSaved = savedWatchlist.includes(ticker);
    if (isSaved) {
        textModalWatchlist.textContent = '✓ Tersimpan';
        btnModalToggleWatchlist.className = 'bg-purple-900/70 text-purple-200 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-sm';
    } else {
        textModalWatchlist.textContent = '+ Watchlist';
        btnModalToggleWatchlist.className = 'bg-[#121c2e] hover:bg-[#1a273f] shadow-sm text-purple-300 hover:text-white px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition';
    }
}

if (btnModalToggleWatchlist) {
    btnModalToggleWatchlist.addEventListener('click', () => {
        if (!currentActiveTicker) return;
        const idx = savedWatchlist.indexOf(currentActiveTicker);
        if (idx >= 0) {
            savedWatchlist.splice(idx, 1);
        } else {
            savedWatchlist.unshift(currentActiveTicker);
        }
        saveWatchlistToStorage();
        updateModalWatchlistButton(currentActiveTicker);
    });
}

async function executeStockAnalysis(ticker) {
    if (!ticker) return;
    const cleanTicker = ticker.trim().toUpperCase().replace(/^[\$#]/, '').replace(/\.JK$/i, '');
    const requestId = ++stockAnalysisRequestId;
    currentActiveTicker = cleanTicker;
    const rightsIssueContainer = document.getElementById('modal-rights-issue-container');
    rightsIssueContainer?.classList.add('hidden');

    // Open modal with loading placeholders
    modalAnalysis.classList.remove('hidden');
    modalAnalysis.classList.add('flex');
    document.body.style.overflow = 'hidden';

    document.getElementById('modal-stock-ticker').textContent = cleanTicker;
    document.getElementById('modal-ticker-icon').textContent = cleanTicker.charAt(0);
    document.getElementById('modal-price').textContent = 'Memuat...';
    document.getElementById('modal-change').textContent = '...';
    document.getElementById('modal-fin-summary').textContent = `Menghubungi bursa dan menganalisa indikator fundamental & teknikal untuk ${cleanTicker}...`;
    updateModalWatchlistButton(cleanTicker);

    try {
        const res = await fetch(`/api/analyze/${cleanTicker}`);
        const data = await res.json().catch(() => null);
        if (requestId !== stockAnalysisRequestId || currentActiveTicker !== cleanTicker) return;
        if (!res.ok || !data || !data.realtime || !Number.isFinite(Number(data.realtime.lastPrice)) || Number(data.realtime.lastPrice) <= 0) {
            throw new Error('Data unavailable');
        }

        populateAnalysisModal(data);
    } catch {
        if (requestId !== stockAnalysisRequestId || currentActiveTicker !== cleanTicker) return;
        document.getElementById('modal-price').textContent = 'N/A';
        document.getElementById('modal-change').textContent = '-';
        document.getElementById('modal-high-low').textContent = '-';
        document.getElementById('modal-volume').textContent = '-';
        document.getElementById('modal-turnover').textContent = '-';
        document.getElementById('modal-fin-summary').textContent = 'Data realtime/historis emiten ini tidak tersedia di bursa saat ini.';
        rightsIssueContainer?.classList.add('hidden');
    }
}
window.executeStockAnalysis = executeStockAnalysis;

function populateAnalysisModal(data) {
    const rt = data.realtime;
    const val = data.valuation;
    const trend = data.trend;
    const fin = data.financials;
    if (!rt || !Number.isFinite(Number(rt.lastPrice)) || Number(rt.lastPrice) <= 0 || !val || !trend || !fin) {
        throw new Error('Data unavailable');
    }

    // Header info
    document.getElementById('modal-stock-ticker').textContent = data.ticker;
    document.getElementById('modal-stock-timestamp').textContent = `Waktu Akses: ${rt.timestamp || 'Realtime'}`;

    const mktStat = document.getElementById('modal-market-status');
    mktStat.textContent = rt.marketStatus || 'OPEN';
    mktStat.className = rt.marketStatus === 'OPEN' ? 'px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 shadow-sm' : 'px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-800 text-slate-300 shadow-sm';

    // Price ribbon
    document.getElementById('modal-price').textContent = fmtRp.format(rt.lastPrice);
    const chgEl = document.getElementById('modal-change');
    chgEl.textContent = `${rt.changePct >= 0 ? '+' : ''}${rt.changePct.toFixed(2)}%`;
    chgEl.className = `text-2xl font-bold font-mono ${rt.changePct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`;

    document.getElementById('modal-high-low').textContent = `${fmtRp.format(rt.high)} / ${fmtRp.format(rt.low)}`;
    document.getElementById('modal-volume').textContent = fmtNum.format(rt.volume);
    document.getElementById('modal-turnover').textContent = fmtRp.format(rt.value);

    // Valuasi & Harga Wajar
    // Valuasi & Harga Wajar
    const valStatusEl = document.getElementById('modal-val-status');
    valStatusEl.textContent = val.status;
    if (val.status === 'UNDERVALUED' || val.status.includes('UNDERVALUED')) {
        valStatusEl.className = 'px-2 py-0.5 rounded text-[11px] font-extrabold bg-emerald-500/20 text-emerald-400 shadow-sm';
    } else if (val.status === 'OVERVALUED') {
        valStatusEl.className = 'px-2 py-0.5 rounded text-[11px] font-extrabold bg-rose-500/20 text-rose-400 shadow-sm';
    } else if (val.status.includes('TURNAROUND')) {
        valStatusEl.className = 'px-2 py-0.5 rounded text-[11px] font-extrabold bg-cyan-500/20 text-cyan-300 shadow-sm shadow-sm';
    } else {
        valStatusEl.className = 'px-2 py-0.5 rounded text-[11px] font-extrabold bg-amber-500/20 text-amber-400 shadow-sm';
    }

    document.getElementById('modal-val-fair').textContent = val.fairValue ? fmtRp.format(val.fairValue) : 'N/A';
    document.getElementById('modal-val-per').textContent = val.per ? `${val.per}x` : 'N/A';

    // PER Footnote (Aturan 6: Penjelasan jika PER tinggi akibat basis laba rendah masa turnaround)
    const footnoteEl = document.getElementById('modal-val-per-footnote');
    if (footnoteEl) {
        if (val.perFootnote) {
            footnoteEl.textContent = val.perFootnote;
            footnoteEl.classList.remove('hidden');
        } else {
            footnoteEl.classList.add('hidden');
        }
    }

    document.getElementById('modal-val-pbv').textContent = val.pbv ? `${val.pbv}x` : 'N/A';
    document.getElementById('modal-val-eps').textContent = val.eps ? fmtRp.format(val.eps) : 'N/A';
    document.getElementById('modal-val-bvps').textContent = val.bvps ? fmtRp.format(val.bvps) : 'N/A';

    // Analisa Teknikal
    const trendStatEl = document.getElementById('modal-trend-status');
    trendStatEl.textContent = trend.status || 'NEUTRAL';
    if (trend.status === 'UPTREND') {
        trendStatEl.className = 'px-2 py-0.5 rounded text-[11px] font-extrabold bg-emerald-500/20 text-emerald-400 shadow-sm';
    } else if (trend.status === 'DOWNTREND') {
        trendStatEl.className = 'px-2 py-0.5 rounded text-[11px] font-extrabold bg-rose-500/20 text-rose-400 shadow-sm';
    } else {
        trendStatEl.className = 'px-2 py-0.5 rounded text-[11px] font-extrabold bg-amber-500/20 text-amber-400 shadow-sm';
    }

    const stEl = document.getElementById('modal-trend-supertrend');
    if (stEl) {
        if (trend.supertrend) {
            const isB = trend.supertrend.isBullish;
            const suppVal = trend.supertrend.value || trend.supertrend.support || trend.supertrend.resistance;
            stEl.innerHTML = isB
                ? `<span class="text-emerald-400 font-bold">BULLISH 🟢</span> <span class="text-slate-400 text-[10px]">(Supp: ${suppVal ? fmtRp.format(suppVal) : '-'})</span>`
                : `<span class="text-rose-400 font-bold">BEARISH 🔴</span> <span class="text-slate-400 text-[10px]">(Res: ${suppVal ? fmtRp.format(suppVal) : '-'})</span>`;
        } else {
            stEl.textContent = 'N/A';
        }
    }

    const maEl = document.getElementById('modal-trend-ma20-50');
    if (maEl) {
        const ma20 = trend.ema20 || trend.sma20;
        const ma50 = trend.ema50 || trend.sma50;
        if (ma20 && ma50) {
            const isGolden = ma20 > ma50;
            maEl.innerHTML = `<span class="${isGolden ? 'text-cyan-300' : 'text-slate-300'} font-bold">${isGolden ? 'Golden Alignment 🟢' : 'Bearish / Netral ⚪'}</span> <span class="text-slate-400 text-[10px]">(${fmtRp.format(ma20)} / ${fmtRp.format(ma50)})</span>`;
        } else {
            maEl.textContent = 'N/A';
        }
    }

    const rvolEl = document.getElementById('modal-trend-rvol');
    if (rvolEl) {
        const rvol = trend.rvol || 1.0;
        const color = rvol >= 1.5 ? 'text-amber-400' : rvol >= 1.1 ? 'text-emerald-400' : 'text-slate-300';
        rvolEl.innerHTML = `<span class="${color} font-bold font-mono">${rvol.toFixed(2)}x</span> <span class="text-[10px] text-slate-400">(${trend.volumeStatus || 'Normal'})</span>`;
    }

    const rsiEl = document.getElementById('modal-trend-rsi');
    if (rsiEl) {
        const rsiVal = trend.rsi14 ? trend.rsi14.toFixed(1) : '50.0';
        const rsiNum = parseFloat(rsiVal);
        const rsiColor = rsiNum >= 70 ? 'text-rose-400' : rsiNum >= 50 ? 'text-emerald-400' : 'text-amber-400';
        rsiEl.innerHTML = `<span class="${rsiColor} font-bold font-mono">${rsiVal}</span> <span class="text-slate-400 text-[10px]">(${rsiNum > 70 ? 'Overbought' : rsiNum < 35 ? 'Oversold' : 'Sweet Zone'})</span>`;
    }

    const macdAdxEl = document.getElementById('modal-trend-macd-adx');
    if (macdAdxEl) {
        let macdTxt = 'Neutral';
        if (trend.macd_line && trend.macd_signal) {
            macdTxt = trend.macd_line > trend.macd_signal ? 'Bullish 🟢' : 'Bearish 🔴';
        }
        const adxTxt = trend.adx14 ? `${trend.adx14.toFixed(1)}` : '-';
        macdAdxEl.innerHTML = `<span class="text-white font-mono">${macdTxt}</span> | <span class="text-cyan-300 font-mono">ADX ${adxTxt}</span>`;
    }

    // Kesehatan Finansial (Aturan 1, 2, 4, 5)
    const finBadgeEl = document.getElementById('modal-fin-badge');
    if (finBadgeEl) {
        const label = fin.sentimentLabel || fin.healthStatus || 'Q-Report';
        finBadgeEl.textContent = label;
        if (label.includes('TURNAROUND') || label.includes('PEMULIHAN')) {
            finBadgeEl.className = 'px-2.5 py-0.5 rounded text-[11px] font-black bg-emerald-500/25 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.25)]';
        } else if (label.includes('KUAT') || label.includes('POSITIF') || label.includes('SEHAT')) {
            finBadgeEl.className = 'px-2 py-0.5 rounded text-[11px] font-extrabold bg-emerald-500/20 text-emerald-400 shadow-sm';
        } else if (label.includes('WASPADA') || label.includes('RUGI')) {
            finBadgeEl.className = 'px-2 py-0.5 rounded text-[11px] font-extrabold bg-rose-500/20 text-rose-400 shadow-sm';
        } else {
            finBadgeEl.className = 'px-2 py-0.5 rounded text-[11px] font-extrabold bg-amber-500/20 text-amber-400 shadow-sm';
        }
    }

    document.getElementById('modal-fin-roe').textContent = fin.roe ? `${(fin.roe * 100).toFixed(2)}%` : 'N/A';
    document.getElementById('modal-fin-npm').textContent = fin.netProfitMargin ? `${(fin.netProfitMargin * 100).toFixed(2)}%` : 'N/A';

    // Pertumbuhan Laba Bersih (Aturan 2 & 4: Prioritas Laba Bersih > Pendapatan)
    const netGrowthEl = document.getElementById('modal-fin-net-growth');
    if (netGrowthEl) {
        if (fin.isTurnaround) {
            const pct = fin.netProfitGrowth !== null && fin.netProfitGrowth !== undefined ? ` (+${(fin.netProfitGrowth * 100).toFixed(1)}%)` : '';
            netGrowthEl.innerHTML = `<span class="text-emerald-400 font-bold">Turnaround (Rugi ➔ Laba) 🚀</span><span class="text-[10px] text-emerald-300 font-mono">${pct}</span>`;
        } else if (fin.netProfitGrowth !== null && fin.netProfitGrowth !== undefined) {
            const netVal = (fin.netProfitGrowth * 100).toFixed(2);
            const isPos = fin.netProfitGrowth >= 0;
            netGrowthEl.textContent = `${isPos ? '+' : ''}${netVal}%`;
            netGrowthEl.className = `font-mono font-bold ${isPos ? 'text-emerald-400' : 'text-rose-400'}`;
        } else {
            netGrowthEl.textContent = 'Data Terbatas';
            netGrowthEl.className = 'font-mono text-slate-400 font-semibold';
        }
    }

    // Revenue Growth
    const revEl = document.getElementById('modal-fin-rev');
    if (revEl) {
        if (fin.revenueGrowth !== null && fin.revenueGrowth !== undefined) {
            const revVal = (fin.revenueGrowth * 100).toFixed(2);
            revEl.textContent = `${fin.revenueGrowth >= 0 ? '+' : ''}${revVal}%`;
            revEl.className = `font-mono font-semibold ${fin.revenueGrowth >= 0 ? 'text-white' : 'text-amber-300'}`;
        } else {
            revEl.textContent = 'N/A';
            revEl.className = 'font-mono text-slate-400';
        }
    }

    // Beban Pokok (COGS) YoY (Aturan 1: Analisis Efisiensi Biaya)
    const cogsEl = document.getElementById('modal-fin-cogs');
    if (cogsEl) {
        if (fin.cogsGrowth !== null && fin.cogsGrowth !== undefined) {
            const cogsVal = (fin.cogsGrowth * 100).toFixed(2);
            const isDrop = fin.cogsGrowth < 0;
            if (fin.isCostEfficient) {
                cogsEl.innerHTML = `<span class="text-cyan-300 font-bold">${cogsVal}%</span> <span class="text-[10px] text-cyan-400 font-normal">(Efisiensi Beban ✓)</span>`;
            } else {
                cogsEl.textContent = `${fin.cogsGrowth >= 0 ? '+' : ''}${cogsVal}%`;
                cogsEl.className = `font-mono font-semibold ${isDrop ? 'text-emerald-400' : 'text-slate-300'}`;
            }
        } else {
            cogsEl.textContent = 'N/A (Sektor Jasa/Bank)';
            cogsEl.className = 'font-mono text-slate-400 font-semibold';
        }
    }

    // Sektor Perbankan Override vs DER
    const rowDer = document.getElementById('row-fin-der');
    const rowBank = document.getElementById('row-fin-banking');
    const bankRatiosEl = document.getElementById('modal-fin-banking-ratios');
    const derEl = document.getElementById('modal-fin-der');

    if (fin.isBanking && fin.bankingMetrics) {
        if (rowDer) rowDer.classList.add('hidden');
        if (rowBank) {
            rowBank.classList.remove('hidden');
            if (bankRatiosEl) {
                bankRatiosEl.textContent = `${fin.bankingMetrics.npl} (NPL) | ${fin.bankingMetrics.car} (CAR) | ${fin.bankingMetrics.ldr} (LDR)`;
            }
        }
    } else {
        if (rowBank) rowBank.classList.add('hidden');
        if (rowDer) {
            rowDer.classList.remove('hidden');
            if (derEl) {
                derEl.textContent = fin.debtToEquity ? `${(fin.debtToEquity / 100).toFixed(2)}x` : 'Sektor Finansial / Bank';
            }
        }
    }

    // Mata Uang Lapkeu (Aturan 5)
    const currEl = document.getElementById('modal-fin-currency');
    if (currEl) {
        if (fin.currency === 'USD') {
            currEl.innerHTML = `<span class="text-amber-300 font-bold font-mono">USD 💵</span> <span class="text-[10px] text-slate-400">(Dikonversi ke Rp)</span>`;
        } else {
            currEl.textContent = fin.currency || 'IDR';
            currEl.className = 'font-mono text-white font-semibold';
        }
    }

    // AI Summary & Sentiment Badge (Aturan 3: Sinkronisasi Narasi)
    document.getElementById('modal-fin-summary').textContent = fin.summary || 'Data fundamental lengkap tersedia di modul laporan keuangan.';
    const sumBadgeEl = document.getElementById('modal-fin-summary-badge');
    if (sumBadgeEl) {
        if (fin.isTurnaround) {
            sumBadgeEl.textContent = 'TURNAROUND / PEMULIHAN';
            sumBadgeEl.className = 'px-2 py-0.5 rounded text-[10px] font-black bg-emerald-500/20 text-emerald-300 shadow-sm shadow-sm';
            sumBadgeEl.classList.remove('hidden');
        } else if (fin.isCostEfficient) {
            sumBadgeEl.textContent = 'EFISIENSI BIAYA (MARGIN NAIK)';
            sumBadgeEl.className = 'px-2 py-0.5 rounded text-[10px] font-black bg-cyan-500/20 text-cyan-300 shadow-sm shadow-sm';
            sumBadgeEl.classList.remove('hidden');
        } else if (fin.healthStatus && fin.healthStatus !== 'MODERAT') {
            sumBadgeEl.textContent = fin.sentimentLabel || fin.healthStatus;
            sumBadgeEl.className = 'px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 shadow-sm';
            sumBadgeEl.classList.remove('hidden');
        } else {
            sumBadgeEl.classList.add('hidden');
        }
    }

    // Konsensus Analis (BUG FIXED: always displayed properly!)
    const recEl = document.getElementById('modal-analyst-rec');
    const targetEl = document.getElementById('modal-analyst-target');
    const upsideEl = document.getElementById('modal-analyst-upside');

    const rec = fin.analystRecommendation || val.recommendation;
    if (!rec || rec.toLowerCase() === 'none') {
        recEl.textContent = 'NEUTRAL / KONSENSUS MINIM';
        recEl.className = 'bg-slate-800 text-slate-300 shadow-sm px-3 py-1 rounded-full text-xs font-bold uppercase';
    } else if (rec.toLowerCase().includes('buy')) {
        recEl.textContent = rec.toUpperCase();
        recEl.className = 'bg-emerald-500/20 text-emerald-400 shadow-sm px-3 py-1 rounded-full text-xs font-black uppercase';
    } else if (rec.toLowerCase().includes('sell')) {
        recEl.textContent = rec.toUpperCase();
        recEl.className = 'bg-rose-500/20 text-rose-400 shadow-sm px-3 py-1 rounded-full text-xs font-black uppercase';
    } else {
        recEl.textContent = rec.toUpperCase();
        recEl.className = 'bg-amber-500/20 text-amber-400 shadow-sm px-3 py-1 rounded-full text-xs font-black uppercase';
    }

    const targetPrice = fin.targetPrice || val.targetMeanPrice;
    if (targetPrice) {
        targetEl.textContent = fmtRp.format(targetPrice);
        const upside = fin.upsidePct !== null && fin.upsidePct !== undefined
            ? (fin.upsidePct * 100).toFixed(1)
            : (((targetPrice - rt.lastPrice) / rt.lastPrice) * 100).toFixed(1);
        upsideEl.textContent = `(${upside > 0 ? '+' : ''}${upside}% Upside)`;
        upsideEl.className = `text-xs font-bold font-mono ml-1.5 ${upside > 0 ? 'text-emerald-400' : 'text-rose-400'}`;
    } else {
        targetEl.textContent = fmtRp.format(rt.lastPrice * 1.15);
        upsideEl.textContent = '(Estimasi +15%)';
    }

    // Card 4: Aliran Asing & Flow
    const ff = data.foreignFlow;
    const ffStatusEl = document.getElementById('modal-foreign-status');
    const ffNet1dEl = document.getElementById('modal-foreign-net1d');
    const ffNet5dEl = document.getElementById('modal-foreign-net5d');
    const ffVwapEl = document.getElementById('modal-foreign-vwap');
    const ffFfpiEl = document.getElementById('modal-foreign-ffpi');
    const ffStreakEl = document.getElementById('modal-foreign-streak');

    if (ff) {
        if (ffStatusEl) {
            const st = ff.daily?.status || ff.weekly?.phase || 'NETRAL ⚪';
            ffStatusEl.textContent = st;
            if (st.includes('AKUMULASI') || st.includes('Mark-Up')) {
                ffStatusEl.className = 'px-2 py-0.5 rounded text-[11px] font-extrabold bg-emerald-500/20 text-emerald-400 shadow-sm';
            } else if (st.includes('DISTRIBUSI') || st.includes('Distribution')) {
                ffStatusEl.className = 'px-2 py-0.5 rounded text-[11px] font-extrabold bg-rose-500/20 text-rose-400 shadow-sm';
            } else {
                ffStatusEl.className = 'px-2 py-0.5 rounded text-[11px] font-extrabold bg-cyan-500/20 text-cyan-300 shadow-sm';
            }
        }
        if (ffNet1dEl) {
            const net1d = ff.daily?.netForeignVal || 0;
            ffNet1dEl.textContent = fmtRpMiliar(net1d);
            ffNet1dEl.className = `font-mono font-bold ${net1d >= 0 ? 'text-emerald-400' : 'text-rose-400'}`;
        }
        if (ffNet5dEl) {
            const net5d = ff.weekly?.weeklyNetVal || 0;
            ffNet5dEl.textContent = fmtRpMiliar(net5d);
            ffNet5dEl.className = `font-mono font-semibold ${net5d >= 0 ? 'text-emerald-400' : 'text-rose-400'}`;
        }
        if (ffVwapEl) {
            const vwap = ff.monthly?.foreignVWAP || ff.weekly?.vwap;
            ffVwapEl.textContent = vwap ? fmtRp.format(vwap) : 'Rp -';
        }
        if (ffFfpiEl) {
            const ffpi = ff.daily?.ffpi !== undefined ? ff.daily.ffpi : 0;
            ffFfpiEl.textContent = `${ffpi > 0 ? '+' : ''}${ffpi} / 100`;
            ffFfpiEl.className = `font-mono font-semibold ${ffpi >= 30 ? 'text-emerald-400' : ffpi <= -30 ? 'text-rose-400' : 'text-cyan-300'}`;
        }
        if (ffStreakEl) {
            if (ff.streak && ff.streak.streakDays >= 2) {
                ffStreakEl.innerHTML = `<span class="text-amber-400 font-bold">${ff.streak.streakDays} Hari 🔥</span> <span class="text-slate-400 text-[10px]">(${fmtRpMiliar(ff.streak.streakTotalVal)})</span>`;
            } else {
                ffStreakEl.textContent = 'Netral / 0 Hari';
                ffStreakEl.className = 'font-mono text-slate-400 font-semibold';
            }
        }
    } else {
        if (ffStatusEl) ffStatusEl.textContent = 'NETRAL';
        if (ffNet1dEl) ffNet1dEl.textContent = 'Rp 0 M';
        if (ffNet5dEl) ffNet5dEl.textContent = 'Rp 0 M';
        if (ffVwapEl) ffVwapEl.textContent = 'Rp -';
        if (ffFfpiEl) ffFfpiEl.textContent = '0 / 100';
        if (ffStreakEl) ffStreakEl.textContent = '-';
    }

    // Associated Corporate News List
    const newsContainer = document.getElementById('modal-news-list');
    newsContainer.innerHTML = '';
    if (data.news && data.news.length > 0) {
        data.news.forEach(n => {
            const item = document.createElement('div');
            item.className = 'bg-[#070b13] hover:bg-[#111827] shadow-sm p-3 rounded-lg flex flex-col justify-between transition group gap-2';
            item.innerHTML = `
                <div>
                    <div class="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                        <span class="text-cyan-400 font-bold">${n.source}</span>
                        <span class="text-emerald-400 font-mono font-semibold">🕒 ${n.date || n.timeAgo}</span>
                    </div>
                    <h5 class="text-xs font-semibold text-slate-200 group-hover:text-amber-300 leading-snug">${n.title}</h5>
                    <p class="text-[10px] text-slate-400 italic mt-1">${n.impact}</p>
                </div>
                <div class="flex justify-end pt-1">
                    <a href="${n.link}" target="_blank" rel="noopener noreferrer"
                       class="inline-flex items-center gap-1 text-[11px] font-bold text-sky-300 hover:text-sky-100 bg-sky-950/60 hover:bg-sky-900/80 shadow-sm px-2.5 py-1 rounded transition">
                        <span>Baca Berita Lengkap</span>
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                    </a>
                </div>
            `;
            newsContainer.appendChild(item);
        });
    } else {
        newsContainer.innerHTML = `<p class="col-span-full text-xs text-slate-500 text-center py-4">Tidak ada aksi korporasi besar dalam 30 hari terakhir.</p>`;
    }

    // Card 5: Modul Aksi Korporasi Rights Issue (HMETD) & Tebus Calculator
    const ri = data.rightsIssue;
    const riContainer = document.getElementById('modal-rights-issue-container');
    const cumDate = String(ri?.dates?.cumDate || '').trim();
    const riIsRenderable = ri?.hasRightsIssue === true && ri?.isCorporateActionActive === true &&
        cumDate !== '' && cumDate !== '-' && Number.isFinite(Date.parse(cumDate)) &&
        Number.isFinite(Number(ri?.exercisePrice)) && Number(ri.exercisePrice) > 0 &&
        Number.isFinite(Number(ri?.ratioOld)) && Number(ri.ratioOld) > 0 &&
        Number.isFinite(Number(ri?.ratioNew)) && Number(ri.ratioNew) > 0;
    riContainer?.classList.toggle('hidden', !riIsRenderable);

    if (riIsRenderable && riContainer) {
        const badge = document.getElementById('modal-rights-status-badge');
        if (badge) {
            if (ri.hasRightsIssue && ri.isCorporateActionActive) {
                badge.textContent = 'HMETD AKTIF 🔥';
                badge.className = 'px-2.5 py-1 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-300 shadow-sm shadow-sm';
            } else if (ri.hasRightsIssue) {
                badge.textContent = ri.status || 'HISTORIS BENCHMARK';
                badge.className = 'px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 shadow-sm';
            } else {
                badge.textContent = 'SIMULASI HMETD';
                badge.className = 'px-2.5 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-300 shadow-sm';
            }
        }

        const ratioEl = document.getElementById('modal-rights-ratio');
        if (ratioEl) ratioEl.textContent = ri.ratioDisplay || `${ri.ratioOld || 100} : ${ri.ratioNew || 25}`;

        const peEl = document.getElementById('modal-rights-exercise-price');
        if (peEl) peEl.textContent = fmtRp.format(ri.exercisePrice || 0);

        const theoEl = document.getElementById('modal-rights-theoretical-price');
        if (theoEl) theoEl.textContent = fmtRp.format(ri.theoreticalPrice || 0);

        const dilEl = document.getElementById('modal-rights-dilution');
        if (dilEl) dilEl.textContent = `${(ri.dilutionPct || 0).toFixed(2)}%`;

        const discEl = document.getElementById('modal-rights-discount');
        if (discEl) {
            const disc = ri.discountPct || 0;
            discEl.textContent = `${disc >= 0 ? '+' : ''}${disc.toFixed(1)}%`;
            discEl.className = `font-mono font-bold text-sm ${disc >= 0 ? 'text-emerald-400' : 'text-rose-400'}`;
        }

        const procEl = document.getElementById('modal-rights-proceeds');
        if (procEl) procEl.textContent = ri.targetProceeds || '-';

        const sbEl = document.getElementById('modal-rights-standby-buyer');
        if (sbEl) sbEl.textContent = ri.standbyBuyer || 'Tidak Ada / Mandiri';

        const cumEl = document.getElementById('modal-rights-cum-date');
        if (cumEl) cumEl.textContent = ri.dates?.cumDate || '-';

        const tradeEl = document.getElementById('modal-rights-trading-period');
        if (tradeEl) tradeEl.textContent = (ri.dates?.tradingStart && ri.dates?.tradingStart !== '-') ? `${ri.dates.tradingStart} s/d ${ri.dates.tradingEnd}` : '-';

        const aiEl = document.getElementById('modal-rights-ai-summary');
        if (aiEl) aiEl.textContent = ri.aiSummary || 'Evaluasi rasio dilusi dan harga teoretis terhadap harga pasar.';

        // Populate calculator input fields
        const inputLots = document.getElementById('input-rights-lots');
        const inputPe = document.getElementById('input-rights-pe');
        const inputR = document.getElementById('input-rights-ratio-r');

        if (inputLots) inputLots.value = 100;
        if (inputPe) inputPe.value = ri.exercisePrice || 1000;
        if (inputR) {
            const rVal = ri.ratioOld ? Math.round((ri.ratioNew / ri.ratioOld) * 100) : (ri.ratioNew || 25);
            inputR.value = rVal;
        }

        // Active recalculator for current stock
        window.activeCalculateTebus = function () {
            const L = Math.max(0, parseInt(inputLots?.value) || 0);
            const pe = Math.max(1, parseFloat(inputPe?.value) || 1000);
            const r = Math.max(0, parseFloat(inputR?.value) || 25);
            const p0 = rt.lastPrice || 1000;
            const N = 100;

            const rightsLots = Math.floor(L * (r / N));
            const rightsShares = rightsLots * 100;
            const totalCost = rightsShares * pe;
            const initialVal = L * 100 * p0;
            const totalSharesPost = (L + rightsLots) * 100;
            const avgPrice = totalSharesPost > 0 ? Math.round((initialVal + totalCost) / totalSharesPost) : 0;
            const dilution = ((r / (N + r)) * 100).toFixed(2);

            const calcLotsEl = document.getElementById('calc-rights-lots');
            if (calcLotsEl) calcLotsEl.textContent = `${rightsLots.toLocaleString('id-ID')} Lot`;

            const calcSharesEl = document.getElementById('calc-rights-shares');
            if (calcSharesEl) calcSharesEl.textContent = `(${rightsShares.toLocaleString('id-ID')} lbr)`;

            const calcCostEl = document.getElementById('calc-rights-cost');
            if (calcCostEl) calcCostEl.textContent = fmtRp.format(totalCost);

            const calcAvgEl = document.getElementById('calc-rights-avg-price');
            if (calcAvgEl) calcAvgEl.textContent = fmtRp.format(avgPrice);

            const calcDilEl = document.getElementById('calc-rights-dilution-status');
            if (calcDilEl) calcDilEl.textContent = `${dilution}%`;
        };

        window.activeCalculateTebus();
    }
}

btnCloseModal.addEventListener('click', () => {
    stockAnalysisRequestId += 1;
    modalAnalysis.classList.add('hidden');
    modalAnalysis.classList.remove('flex');
    document.body.style.overflow = 'auto';
});

// Close modal when clicking outer backdrop
modalAnalysis.addEventListener('click', (e) => {
    if (e.target === modalAnalysis) {
        btnCloseModal.click();
    }
});

// Rights Issue (HMETD) Interactive Tebus Calculator Live Input Handlers
['input-rights-lots', 'input-rights-pe', 'input-rights-ratio-r'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
        el.addEventListener('input', () => {
            if (typeof window.activeCalculateTebus === 'function') {
                window.activeCalculateTebus();
            }
        });
    }
});
