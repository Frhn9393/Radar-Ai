// ============================================================
//  MODULE: screener.js
//  Screener candidate tables, session toggles, and sector filtering
// ============================================================

// ============================================================
//  SHARED SCREENER HELPERS
// ============================================================
function confCell(confidence, label) {
    const color = confidence >= 75 ? 'text-emerald-400' : confidence >= 55 ? 'text-amber-400' : 'text-orange-400';
    const barColor = confidence >= 75 ? 'bg-emerald-400' : confidence >= 55 ? 'bg-amber-400' : 'bg-orange-400';
    const isCounterTrend = /rebound|oversold/i.test(label || '');
    const badgeBg = isCounterTrend
        ? 'bg-orange-500/20 text-orange-300 ring-1 ring-orange-400/30 shadow-sm'
        : confidence >= 75 ? 'bg-emerald-500/20 text-emerald-400 shadow-sm' : confidence >= 55 ? 'bg-amber-500/20 text-amber-400 shadow-sm' : 'bg-orange-500/20 text-orange-400 shadow-sm';
    const statusIcon = isCounterTrend ? '↗ ' : '';
    return `
        <td class="p-3">
            <div class="flex items-center gap-2">
                <span class="${color} font-bold font-mono text-xs">${confidence}%</span>
                <div class="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div class="${barColor} h-full rounded-full" style="width:${confidence}%"></div>
                </div>
            </div>
        </td>
        <td class="p-3">
            <span class="text-[10px] px-2 py-0.5 rounded font-semibold ${badgeBg}" title="${isCounterTrend ? 'Counter-trend: rebound dari kondisi oversold, bukan tren bullish utama' : 'Status momentum/tren teknikal'}">${statusIcon}${escapeHtml(label)}</span>
        </td>
    `;
}

function formatPrice(value) {
    const number = Number(value);
    return Number.isFinite(number) ? fmtRp.format(number) : '-';
}

function formatRange(low, high, fallback) {
    const first = Number(low);
    const second = Number(high);
    if (Number.isFinite(first) && Number.isFinite(second)) return `${formatPrice(first)} - ${formatPrice(second)}`;
    return escapeHtml(fallback || '-');
}

function broksumAction(ticker) {
    return `<button type="button" class="broksum-open rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-[10px] font-bold text-cyan-300 hover:bg-cyan-500/20" data-broksum-ticker="${escapeHtml(ticker)}">Broksum</button>`;
}

function getRankBadge(row) {
    if (row.rank === 1) return `<span class="text-[9px] px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-bold tracking-tight shadow-sm">🥇 #1</span>`;
    if (row.rank === 2) return `<span class="text-[9px] px-1.5 py-0.5 rounded-md bg-slate-400/20 text-slate-200 font-bold tracking-tight shadow-sm">🥈 #2</span>`;
    if (row.rank === 3) return `<span class="text-[9px] px-1.5 py-0.5 rounded-md bg-amber-700/20 text-amber-400 font-bold tracking-tight shadow-sm">🥉 #3</span>`;
    return '';
}

function filterScreenerList(items) {
    if (!Array.isArray(items)) return [];
    let result = items;
    const selectedSector = (typeof screenerSectorSelect !== 'undefined' && screenerSectorSelect?.value) || 'all';
    if (selectedSector !== 'all') {
        result = result.filter(item => (item.sector || '').toLowerCase().includes(selectedSector.toLowerCase()));
    }
    const limit = typeof screenerViewLimit !== 'undefined' ? screenerViewLimit : 'all';
    if (limit === 'top3') {
        result = result.slice(0, 3);
    }
    return result;
}

function strictScreenerEmptyRow(colspan) {
    return `<tr><td colspan="${colspan}" role="status" class="p-4 text-center text-amber-300"><span class="inline-flex items-center justify-center gap-2">🛡️ Tidak ada emiten yang memenuhi standar filter ketat hari ini. Kondisi pasar cenderung volatile/risky (Wait &amp; See).</span><small class="mt-1 block text-slate-500">Sinyal yang memerlukan data broksum, order book, dan running trade hanya ditampilkan jika sumber metrik terverifikasi tersedia.</small></td></tr>`;
}

// ============================================================
//  5. SCREENER EXECUTION & RENDERING
// ============================================================
let screenerProgressInterval = null;
let activeScreenerProgressTick = null;

document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        clearInterval(screenerProgressInterval);
        screenerProgressInterval = null;
    } else if (activeScreenerProgressTick && !screenerProgressInterval) {
        screenerProgressInterval = setInterval(activeScreenerProgressTick, 1000);
    }
});

function renderScalpingTable(session = 'sesi1') {
    activeScalpSession = session;
    const tbodyScalp = document.getElementById('tbody-scalping');
    const btnSesi1 = document.getElementById('btn-scalp-sesi1');
    const btnSesi2 = document.getElementById('btn-scalp-sesi2');
    const targetInfo = document.getElementById('scalp-target-info');

    if (session === 'sesi1') {
        if (btnSesi1) btnSesi1.className = 'scalp-sesi-btn active bg-emerald-500/20 text-emerald-400 text-xs font-bold px-3 py-1 rounded-lg transition flex items-center gap-1.5 shadow-sm';
        if (btnSesi2) btnSesi2.className = 'scalp-sesi-btn text-slate-400 hover:text-slate-200 text-xs font-bold px-3 py-1 rounded-lg transition flex items-center gap-1.5 ml-1';
        if (targetInfo) targetInfo.textContent = 'Target Gain: 1.5% - 2.5% | Jam: 09:00 - 11:30 WIB';
    } else {
        if (btnSesi1) btnSesi1.className = 'scalp-sesi-btn text-slate-400 hover:text-slate-200 text-xs font-bold px-3 py-1 rounded-lg transition flex items-center gap-1.5';
        if (btnSesi2) btnSesi2.className = 'scalp-sesi-btn active bg-amber-500/20 text-amber-400 text-xs font-bold px-3 py-1 rounded-lg transition flex items-center gap-1.5 shadow-sm ml-1';
        if (targetInfo) targetInfo.textContent = 'Target Gain: 1.8% - 3.0% | Jam: 13:30 - 15:50 WIB';
    }

    if (!tbodyScalp) return;

    const rawList = session === 'sesi1'
        ? (lastScreenerData?.scalpingSesi1 || lastScreenerData?.scalping || [])
        : (lastScreenerData?.scalpingSesi2 || lastScreenerData?.scalping || []);

    const list = filterScreenerList(rawList);

    if (!list || list.length === 0) {
        tbodyScalp.innerHTML = strictScreenerEmptyRow(10);
        return;
    }

    tbodyScalp.innerHTML = list.map(row => {
        const tick = (row.price < 200 ? 1 : row.price < 500 ? 2 : row.price < 2000 ? 5 : row.price < 5000 ? 10 : 25);
        const antrean = row.antreanBeli || (session === 'sesi1' ? `Antre Bid Rp ${fmtRp.format(row.price - tick)} - Rp ${fmtRp.format(row.price)} (Bid 1-2)` : `Antre Bid Rp ${fmtRp.format(row.price - 2 * tick)} - Rp ${fmtRp.format(row.price - tick)} (Bid 2-3)`);
        const jam = row.jamEksekusi || (session === 'sesi1' ? '09:00 - 09:30 WIB' : '13:30 - 14:15 WIB');
        const rankBadge = getRankBadge(row);
        const stBadge = row.supertrendBadge ? `<span class="text-[9px] px-1.5 py-0.2 rounded bg-emerald-950/80 text-emerald-400 shadow-sm font-sans font-semibold">${row.supertrendBadge}</span>` : '';
        const rvBadge = row.rvolBadge ? `<span class="text-[9px] px-1.5 py-0.2 rounded bg-amber-950/80 text-amber-300 shadow-sm font-sans font-semibold">${row.rvolBadge}</span>` : '';

        return `
            <tr class=" hover:bg-[#11192a] transition cursor-pointer" data-ticker="${row.ticker}">
                <td class="p-3 font-mono">
                    <div class="flex items-center gap-1.5">
                        <span class="font-bold text-cyan-400 hover:underline text-sm">$${row.ticker}</span>
                        ${rankBadge}
                        ${broksumAction(row.ticker)}
                    </div>
                    <div class="flex flex-wrap items-center gap-1 mt-1">${stBadge} ${rvBadge}</div>
                </td>
                <td class="p-3 font-mono font-semibold text-white">${fmtRp.format(row.price)}</td>
                <td class="p-3 font-mono font-bold ${parseFloat(row.changePct) >= 0 ? 'text-emerald-400' : 'text-rose-400'}">${parseFloat(row.changePct) >= 0 ? '+' : ''}${row.changePct}%</td>
                <td class="p-3 font-mono text-slate-300">${row.range}%</td>
                <td class="p-3 font-mono font-bold text-cyan-300 whitespace-nowrap"><span class="bg-cyan-950/40 shadow-sm px-2 py-0.5 rounded text-xs">${antrean}</span></td>
                <td class="p-3 font-mono text-amber-300 font-semibold whitespace-nowrap text-xs">🕒 ${jam}</td>
                <td class="p-3 font-mono font-semibold text-emerald-400">${fmtRp.format(row.targetProfit)}</td>
                <td class="p-3 font-mono text-rose-400">${fmtRp.format(row.stopLoss)}</td>
                ${confCell(row.confidence, row.label)}
            </tr>
        `;
    }).join('');
}

// Bind Sesi 1 & Sesi 2 buttons
document.getElementById('btn-scalp-sesi1')?.addEventListener('click', () => {
    renderScalpingTable('sesi1');
});
document.getElementById('btn-scalp-sesi2')?.addEventListener('click', () => {
    renderScalpingTable('sesi2');
});

btnTriggerScreener?.addEventListener('click', async () => {
    if (btnTriggerScreener) btnTriggerScreener.disabled = true;
    screenerLoading?.classList.remove('hidden');
    screenerResultsWrapper?.classList.add('hidden');
    screenerBtnIcon?.classList.add('animate-spin');

    // ── Live Elapsed Timer & Progress ──────────────────────────
    const timerEl = document.getElementById('screener-timer');
    const statusEl = document.getElementById('screener-scan-status');
    const progressBar = document.getElementById('screener-progress-bar');
    let elapsed = 0;
    let progress = 0;
    if (timerEl) timerEl.textContent = '0s';
    if (progressBar) progressBar.style.width = '0%';
    if (statusEl) statusEl.textContent = 'Menginisialisasi engine...';

    const statusMessages = [
        'Mengambil data harga real-time...',
        'Menghitung Supertrend (10, 3.0)...',
        'Menghitung MA 20 / 50 Golden Alignment...',
        'Mendeteksi lonjakan Volume Spike (RVol)...',
        'Analisis RSI & MACD expansion...',
        'Filter anti-gorengan ketat & likuiditas...',
        'Menentukan antrean Bid scalping...',
        'Menghitung stop-loss & target profit...',
        'Menyusun 3 rekomendasi terbaik tiap kategori...',
        'Finalisasi analisis teknikal...'
    ];

    activeScreenerProgressTick = () => {
        if (document.hidden) return;
        elapsed++;
        if (timerEl) timerEl.textContent = elapsed + 's';

        // Simulate progress (cap at 90% until real response arrives)
        if (progress < 90) {
            progress += (90 - progress) * 0.08;
            if (progressBar) progressBar.style.width = Math.round(progress) + '%';
        }

        // Cycle status messages
        const msgIdx = Math.min(Math.floor(elapsed / 3), statusMessages.length - 1);
        if (statusEl) statusEl.textContent = statusMessages[msgIdx];
    };
    if (!document.hidden) screenerProgressInterval = setInterval(activeScreenerProgressTick, 1000);

    try {
        const res = await fetch('/api/screener');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const responseData = await res.json();
        const data = responseData && typeof responseData === 'object' && !Array.isArray(responseData) ? responseData : {};
        if (data.error) throw new Error(data.error);

        // Complete the progress bar
        if (progressBar) progressBar.style.width = '100%';
        const totalTopPicks = (data.scalping?.length || 0) + (data.daytrade?.length || 0) + (data.swing?.length || 0) + (data.bsjp?.length || 0) + (data.bpjp?.length || 0) + (data.longterm?.length || 0);
        if (statusEl) statusEl.textContent = `✅ Selesai dalam ${elapsed}s — Top ${totalTopPicks} saham rekomendasi berhasil dikurasi`;

        lastScreenerData = data;
        const pdfButton = document.getElementById('btn-export-screener-pdf');
        if (pdfButton) pdfButton.disabled = false;
        renderScreenerResults(data);

        // Short delay to show 100% completion
        await new Promise(r => setTimeout(r, 500));
        screenerResultsWrapper?.classList.remove('hidden');
    } catch (err) {
        alert('Kendala Screener: ' + err.message);
    } finally {
        clearInterval(screenerProgressInterval);
        screenerProgressInterval = null;
        activeScreenerProgressTick = null;
        screenerLoading?.classList.add('hidden');
        if (btnTriggerScreener) btnTriggerScreener.disabled = false;
        screenerBtnIcon?.classList.remove('animate-spin');
    }
});

function renderScreenerResults(data) {
    data = data && typeof data === 'object' && !Array.isArray(data) ? data : {};

    // 1. Scalping (rendered with session support)
    renderScalpingTable(activeScalpSession || 'sesi1');

    // 2. Daytrade
    const tbodyDay = document.getElementById('tbody-daytrade');
    if (tbodyDay) {
        const dayList = filterScreenerList(data.daytrade || []);
        if (dayList.length === 0) {
            tbodyDay.innerHTML = strictScreenerEmptyRow(8);
        } else {
            tbodyDay.innerHTML = dayList.map(row => {
                const rankBadge = getRankBadge(row);
                const stBadge = row.supertrendBadge ? `<span class="text-[9px] px-1.5 py-0.2 rounded bg-emerald-950/80 text-emerald-400 shadow-sm font-sans font-semibold">${row.supertrendBadge}</span>` : '';
                const rvBadge = row.rvolBadge ? `<span class="text-[9px] px-1.5 py-0.2 rounded bg-amber-950/80 text-amber-300 shadow-sm font-sans font-semibold">${row.rvolBadge}</span>` : '';

                return `
                    <tr class=" hover:bg-[#11192a] transition cursor-pointer" data-ticker="${row.ticker}">
                        <td class="p-3 font-mono">
                            <div class="flex items-center gap-1.5">
                                <span class="font-bold text-cyan-400 hover:underline text-sm">$${row.ticker}</span>
                                ${rankBadge}
                                ${broksumAction(row.ticker)}
                            </div>
                            <div class="flex flex-wrap items-center gap-1 mt-1">${stBadge} ${rvBadge}</div>
                        </td>
                        <td class="p-3 font-mono font-semibold text-white">${fmtRp.format(row.price)}</td>
                        <td class="p-3 font-mono font-bold ${parseFloat(row.changePct) >= 0 ? 'text-emerald-400' : 'text-rose-400'}">${parseFloat(row.changePct) >= 0 ? '+' : ''}${row.changePct}%</td>
                <td class="p-3 font-mono text-slate-300">${formatRange(row.entryZoneLow, row.entryZoneHigh, row.entryZone)}</td>
                <td class="p-3 font-mono font-semibold text-emerald-400">${formatPrice(row.targetProfit)}</td>
                <td class="p-3 font-mono text-rose-400">${formatPrice(row.stopLoss)}</td>
                        ${confCell(row.confidence, row.label)}
                    </tr>
                `;
            }).join('');
        }
    }

    // 3. Swing
    const tbodySwing = document.getElementById('tbody-swing');
    if (tbodySwing) {
        const swingList = filterScreenerList(data.swing || []);
        if (swingList.length === 0) {
            tbodySwing.innerHTML = `<tr><td colspan="9" class="p-4 text-center text-slate-500 italic">Tidak ada saham lolos filter swing ketat saat ini.</td></tr>`;
        } else {
            tbodySwing.innerHTML = swingList.map(row => {
                const rankBadge = getRankBadge(row);
                const stBadge = row.supertrendBadge ? `<span class="text-[9px] px-1.5 py-0.2 rounded bg-emerald-950/80 text-emerald-400 shadow-sm font-sans font-semibold">${row.supertrendBadge}</span>` : '';
                const rvBadge = row.rvolBadge ? `<span class="text-[9px] px-1.5 py-0.2 rounded bg-amber-950/80 text-amber-300 shadow-sm font-sans font-semibold">${row.rvolBadge}</span>` : '';

                return `
                    <tr class=" hover:bg-[#11192a] transition cursor-pointer" data-ticker="${row.ticker}">
                        <td class="p-3 font-mono">
                            <div class="flex items-center gap-1.5">
                                <span class="font-bold text-cyan-400 hover:underline text-sm">$${row.ticker}</span>
                                ${rankBadge}
                                ${broksumAction(row.ticker)}
                            </div>
                            <div class="flex flex-wrap items-center gap-1 mt-1">${stBadge} ${rvBadge}</div>
                        </td>
                        <td class="p-3 font-mono font-semibold text-white">${fmtRp.format(row.price)}</td>
                        <td class="p-3 font-mono text-slate-300">${formatRange(row.areaBuyLow, row.areaBuyHigh, row.areaBuy)}</td>
                        <td class="p-3 font-mono font-semibold text-emerald-400">${formatPrice(row.targetPrice1)}</td>
                        <td class="p-3 font-mono font-semibold text-emerald-400">${formatPrice(row.targetPrice2)}</td>
                        <td class="p-3 font-mono text-rose-400">${formatPrice(row.cutLoss)}</td>
                        <td class="p-3 font-mono font-bold text-purple-400">${row.riskReward}</td>
                        ${confCell(row.confidence, row.label)}
                    </tr>
                `;
            }).join('');
        }
    }

    // 4. BSJP
    const tbodyBsjp = document.getElementById('tbody-bsjp');
    if (tbodyBsjp) {
        const bsjpList = filterScreenerList(data.bsjp || []);
        if (bsjpList.length === 0) {
            tbodyBsjp.innerHTML = strictScreenerEmptyRow(9);
        } else {
            tbodyBsjp.innerHTML = bsjpList.map(row => {
                const rankBadge = getRankBadge(row);
                const stBadge = row.supertrendBadge ? `<span class="text-[9px] px-1.5 py-0.2 rounded bg-emerald-950/80 text-emerald-400 shadow-sm font-sans font-semibold">${row.supertrendBadge}</span>` : '';
                const rvBadge = row.rvolBadge ? `<span class="text-[9px] px-1.5 py-0.2 rounded bg-amber-950/80 text-amber-300 shadow-sm font-sans font-semibold">${row.rvolBadge}</span>` : '';

                return `
                    <tr class=" hover:bg-[#11192a] transition cursor-pointer" data-ticker="${row.ticker}">
                        <td class="p-3 font-mono">
                            <div class="flex items-center gap-1.5">
                                <span class="font-bold text-cyan-400 hover:underline text-sm">$${row.ticker}</span>
                                ${rankBadge}
                                ${broksumAction(row.ticker)}
                            </div>
                            <div class="flex flex-wrap items-center gap-1 mt-1">${stBadge} ${rvBadge}</div>
                        </td>
                        <td class="p-3 font-mono font-semibold text-white">${fmtRp.format(row.price)}</td>
                        <td class="p-3 font-mono font-semibold ${parseFloat(row.rsi) > 60 ? 'text-amber-400' : 'text-emerald-400'}">${row.rsi}</td>
                        <td class="p-3 font-mono text-slate-300">${row.pullbackFromHigh}%</td>
                        <td class="p-3 text-amber-400 text-xs">${row.beliSore}</td>
                        <td class="p-3 font-mono font-semibold text-emerald-400">${fmtRp.format(row.targetPagi)}</td>
                        <td class="p-3 font-mono text-rose-400">${fmtRp.format(row.stopLoss)}</td>
                        ${confCell(row.confidence, row.label)}
                    </tr>
                `;
            }).join('');
        }
    }

    // 5. BPJP
    const tbodyBpjp = document.getElementById('tbody-bpjp');
    if (tbodyBpjp) {
        const bpjpList = filterScreenerList(data.bpjp || []);
        if (bpjpList.length === 0) {
            tbodyBpjp.innerHTML = strictScreenerEmptyRow(10);
        } else {
            tbodyBpjp.innerHTML = bpjpList.map(row => {
                const rankBadge = getRankBadge(row);
                const stBadge = row.supertrendBadge ? `<span class="text-[9px] px-1.5 py-0.2 rounded bg-emerald-950/80 text-emerald-400 shadow-sm font-sans font-semibold">${row.supertrendBadge}</span>` : '';
                const rvBadge = row.rvolBadge ? `<span class="text-[9px] px-1.5 py-0.2 rounded bg-amber-950/80 text-amber-300 shadow-sm font-sans font-semibold">${row.rvolBadge}</span>` : '';

                return `
                    <tr class=" hover:bg-[#11192a] transition cursor-pointer" data-ticker="${row.ticker}">
                        <td class="p-3 font-mono">
                            <div class="flex items-center gap-1.5">
                                <span class="font-bold text-cyan-400 hover:underline text-sm">$${row.ticker}</span>
                                ${rankBadge}
                                ${broksumAction(row.ticker)}
                            </div>
                            <div class="flex flex-wrap items-center gap-1 mt-1">${stBadge} ${rvBadge}</div>
                        </td>
                        <td class="p-3 font-mono font-semibold text-white">${fmtRp.format(row.price)}</td>
                        <td class="p-3 font-mono font-semibold text-emerald-400">${row.rsi} <span class="text-[10px] text-cyan-300 font-sans">(${row.rsiStatus || 'Bounce'})</span></td>
                        <td class="p-3 font-mono text-purple-400">${row.adx}</td>
                        <td class="p-3 font-mono text-slate-300">${row.macd}</td>
                        <td class="p-3 text-pink-400 text-xs">${row.entryPagi}</td>
                        <td class="p-3 font-mono font-semibold text-emerald-400">${fmtRp.format(row.target)}</td>
                        <td class="p-3 font-mono text-rose-400">${fmtRp.format(row.stopLoss)}</td>
                        ${confCell(row.confidence, row.label)}
                    </tr>
                `;
            }).join('');
        }
    }

    // 6. Jangka Panjang
    const tbodyLong = document.getElementById('tbody-longterm');
    if (tbodyLong) {
        const longList = filterScreenerList(data.longterm || []);
        if (longList.length === 0) {
            tbodyLong.innerHTML = `<tr><td colspan="10" class="p-4 text-center text-slate-500 italic">Tidak ada saham lolos filter jangka panjang saat ini.</td></tr>`;
        } else {
            tbodyLong.innerHTML = longList.map(row => {
                const rankBadge = getRankBadge(row);
                const stBadge = row.supertrendBadge ? `<span class="text-[9px] px-1.5 py-0.2 rounded bg-emerald-950/80 text-emerald-400 shadow-sm font-sans font-semibold">${row.supertrendBadge}</span>` : '';

                return `
                    <tr class=" hover:bg-[#11192a] transition cursor-pointer" data-ticker="${row.ticker}">
                        <td class="p-3 font-mono">
                            <div class="flex items-center gap-1.5">
                                <span class="font-bold text-cyan-400 hover:underline text-sm">$${row.ticker}</span>
                                ${rankBadge}
                                ${broksumAction(row.ticker)}
                            </div>
                            <div class="flex flex-wrap items-center gap-1 mt-1">${stBadge}</div>
                        </td>
                        <td class="p-3 font-mono font-semibold text-white">${fmtRp.format(row.price)}</td>
                        <td class="p-3 font-mono font-semibold text-amber-400">${row.rsi}</td>
                        <td class="p-3 font-mono text-slate-300">${fmtRp.format(row.ema200)}</td>
                        <td class="p-3 font-mono text-slate-400">${fmtRp.format(row.support)}</td>
                        <td class="p-3 font-mono font-semibold text-emerald-400">${formatPrice(row.targetKonservatif)}</td>
                        <td class="p-3 font-mono font-extrabold text-emerald-300">${formatPrice(row.targetAgresif)}</td>
                        <td class="p-3 font-mono text-rose-400">${fmtRp.format(row.cutLoss)}</td>
                        ${confCell(row.confidence, row.label)}
                    </tr>
                `;
            }).join('');
        }
    }
}

// Delegated click handler for all screener tables (guarantees clickability regardless of scope)
['tbody-scalping', 'tbody-daytrade', 'tbody-swing', 'tbody-bsjp', 'tbody-bpjp', 'tbody-longterm'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('click', (e) => {
        if (e.target.closest('.broksum-open')) return;
        const tr = e.target.closest('tr[data-ticker]');
        if (tr) {
            const ticker = tr.getAttribute('data-ticker');
            if (ticker) executeStockAnalysis(ticker);
        }
    });
});

// Screener Sector & View Limit Event Listeners
screenerSectorSelect?.addEventListener('change', () => {
    if (lastScreenerData) renderScreenerResults(lastScreenerData);
});
btnViewTop3?.addEventListener('click', () => {
    screenerViewLimit = 'top3';
    if (btnViewTop3) btnViewTop3.className = 'view-limit-btn active bg-emerald-500/20 text-emerald-400 shadow-sm text-xs font-bold px-3 py-1 rounded-lg transition shadow-sm';
    if (btnViewAll) btnViewAll.className = 'view-limit-btn text-slate-400 hover:text-slate-200 text-xs font-bold px-3 py-1 rounded-lg transition';
    if (lastScreenerData) renderScreenerResults(lastScreenerData);
});
btnViewAll?.addEventListener('click', () => {
    screenerViewLimit = 'all';
    if (btnViewAll) btnViewAll.className = 'view-limit-btn active bg-emerald-500/20 text-emerald-400 shadow-sm text-xs font-bold px-3 py-1 rounded-lg transition shadow-sm';
    if (btnViewTop3) btnViewTop3.className = 'view-limit-btn text-slate-400 hover:text-slate-200 text-xs font-bold px-3 py-1 rounded-lg transition';
    if (lastScreenerData) renderScreenerResults(lastScreenerData);
});

// Backtest Modal Event Listeners
const openBacktestModal = () => {
    if (modalBacktest) {
        modalBacktest.classList.remove('hidden');
        modalBacktest.classList.add('flex');
        document.body.style.overflow = 'hidden';
    }
};
const closeBacktestModal = () => {
    if (modalBacktest) {
        modalBacktest.classList.add('hidden');
        modalBacktest.classList.remove('flex');
        document.body.style.overflow = 'auto';
    }
};
btnOpenBacktestModal?.addEventListener('click', openBacktestModal);
btnCloseBacktestModal?.addEventListener('click', closeBacktestModal);
btnCloseBacktestModalBottom?.addEventListener('click', closeBacktestModal);
modalBacktest?.addEventListener('click', (e) => {
    if (e.target === modalBacktest) closeBacktestModal();
});
