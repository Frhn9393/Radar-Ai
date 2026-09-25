// ============================================================
//  MODULE: foreignFlow.js
//  Estimated price and volume proxy: daily, weekly, monthly, and consecutive streak
// ============================================================

// ============================================================
//  5B. PROXY HARGA DAN VOLUME
// ============================================================

function fmtRpMiliar(val) {
    if (val === null || val === undefined || isNaN(val)) return 'Rp 0';
    const num = Number(val);
    const abs = Math.abs(num);
    const sign = num > 0 ? '+' : num < 0 ? '-' : '';
    if (abs >= 1e12) return `${sign}Rp ${(abs / 1e12).toFixed(2)} Triliun`;
    if (abs >= 1e9) return `${sign}Rp ${(abs / 1e9).toFixed(1)} Miliar`;
    if (abs >= 1e6) return `${sign}Rp ${(abs / 1e6).toFixed(1)} Juta`;
    return `${sign}Rp ${fmtNum.format(Math.round(abs))}`;
}

function filterForeignList(list) {
    if (!list || !Array.isArray(list)) return [];
    const query = (foreignSearchInput?.value || '').trim().toUpperCase();
    const sectorFilter = foreignSectorSelect?.value || 'all';

    return list.filter(item => {
        const matchesTicker = !query || item.ticker?.toUpperCase().includes(query) || (item.name && item.name.toUpperCase().includes(query));
        const itemSector = item.sector || '';
        const matchesSector = sectorFilter === 'all' || itemSector.toLowerCase().includes(sectorFilter.toLowerCase());
        return matchesTicker && matchesSector;
    });
}

function switchForeignSubmenu(submenuName) {
    activeForeignSubmenu = submenuName;
    const subBtns = [
        { el: btnForeignDaily, view: viewForeignDaily, name: 'daily', activeClass: 'bg-cyan-500/20 text-cyan-300 shadow-sm' },
        { el: btnForeignWeekly, view: viewForeignWeekly, name: 'weekly', activeClass: 'bg-cyan-500/20 text-cyan-300 shadow-sm' },
        { el: btnForeignMonthly, view: viewForeignMonthly, name: 'monthly', activeClass: 'bg-purple-500/20 text-purple-300 shadow-sm' },
        { el: btnForeignStreak, view: viewForeignStreak, name: 'streak', activeClass: 'bg-amber-500/30 text-amber-300 shadow-sm' }
    ];

    subBtns.forEach(sub => {
        if (sub.el) {
            sub.el.classList.remove('bg-cyan-500/20', 'text-cyan-300', 'shadow-sm', 'bg-purple-500/20', 'text-purple-300', 'bg-amber-500/30', 'text-amber-300');
            if (sub.name === submenuName) {
                sub.el.className = `foreign-sub-btn active ${sub.activeClass} text-xs font-bold px-3.5 py-1.5 rounded-xl transition flex items-center gap-1.5 shadow-sm cursor-pointer`;
            } else {
                sub.el.className = 'foreign-sub-btn text-slate-400 hover:text-slate-200 text-xs font-bold px-3.5 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer';
            }
        }
        if (sub.view) {
            if (sub.name === submenuName) {
                sub.view.classList.remove('hidden');
            } else {
                sub.view.classList.add('hidden');
            }
        }
    });

    renderForeignTables();
}

btnForeignDaily?.addEventListener('click', () => switchForeignSubmenu('daily'));
btnForeignWeekly?.addEventListener('click', () => switchForeignSubmenu('weekly'));
btnForeignMonthly?.addEventListener('click', () => switchForeignSubmenu('monthly'));
btnForeignStreak?.addEventListener('click', () => switchForeignSubmenu('streak'));

foreignSearchInput?.addEventListener('input', () => renderForeignTables());
foreignSectorSelect?.addEventListener('change', () => renderForeignTables());
btnRefreshForeign?.addEventListener('click', () => loadForeignFlowData(true));

async function loadForeignFlowData(forceRefresh = false) {
    foreignLoading?.classList.remove('hidden');
    iconRefreshForeign?.classList.add('animate-spin');

    try {
        const url = forceRefresh ? '/api/foreign-flow?force=true' : '/api/foreign-flow';
        const res = await fetch(url);
        if (!res.ok) throw new Error('Gagal mengambil estimasi proxy harga dan volume');
        const data = await res.json();
        allForeignData = data;
        const flowDisclaimer = document.getElementById('foreign-flow-disclaimer');
        if (flowDisclaimer) flowDisclaimer.textContent = data.macro?.dataDisclaimer || 'Estimasi proxy berbasis harga dan volume, bukan catatan transaksi aktual investor asing.';

        if (data.macro) {
            if (foreignMacroNetval) {
                const val = data.macro.totalNetForeignVal;
                foreignMacroNetval.textContent = fmtRpMiliar(val);
                foreignMacroNetval.className = `text-lg font-black font-mono ${val >= 0 ? 'text-emerald-400' : 'text-rose-400'}`;
            }
            if (foreignMacroParticipation) {
                foreignMacroParticipation.textContent = `${data.macro.estimatedParticipationPct ?? '—'}% est.`;
            }
            if (foreignMacroSentiment) {
                foreignMacroSentiment.textContent = data.macro.sentiment;
                foreignMacroSentiment.className = `text-xs font-bold ${data.macro.totalNetForeignVal >= 0 ? 'text-emerald-400' : 'text-rose-400'}`;
            }
            if (foreignMacroTracked) {
                foreignMacroTracked.textContent = `${data.macro.totalEmitenTracked} Emiten`;
            }
        }

        if (badgeStreakCount) {
            const streakCount = data.streak?.streaks?.length || (Array.isArray(data.streak) ? data.streak.length : 0);
            badgeStreakCount.textContent = streakCount;
        }

        renderForeignTables();
    } catch (err) {
        console.error('Error loadForeignFlowData:', err);
    } finally {
        foreignLoading?.classList.add('hidden');
        iconRefreshForeign?.classList.remove('animate-spin');
    }
}

function renderForeignTables() {
    if (!allForeignData) return;

    if (activeForeignSubmenu === 'daily') {
        renderForeignDailyTables();
    } else if (activeForeignSubmenu === 'weekly') {
        renderForeignWeeklyTable();
    } else if (activeForeignSubmenu === 'monthly') {
        renderForeignMonthlyTable();
    } else if (activeForeignSubmenu === 'streak') {
        renderForeignStreakTable();
    }
}

function getForeignRankBadge(rank) {
    if (rank === 1) return `<span class="text-[9px] px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-bold shadow-sm">🥇 #1</span>`;
    if (rank === 2) return `<span class="text-[9px] px-1.5 py-0.5 rounded-md bg-slate-400/20 text-slate-200 font-bold shadow-sm">🥈 #2</span>`;
    if (rank === 3) return `<span class="text-[9px] px-1.5 py-0.5 rounded-md bg-amber-700/20 text-amber-400 font-bold shadow-sm">🥉 #3</span>`;
    return `<span class="text-[9px] px-1.5 py-0.5 rounded-md bg-slate-800 text-slate-400 font-bold font-mono">#${rank}</span>`;
}

function renderForeignDailyTables() {
    if (!tbodyForeignDailyBuy || !tbodyForeignDailySell || !allForeignData?.daily) return;

    // 1. Top Buy
    const rawBuys = allForeignData.daily.topBuy || [];
    const filteredBuys = filterForeignList(rawBuys);

    if (filteredBuys.length === 0) {
        tbodyForeignDailyBuy.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-slate-500 italic">Tidak ada data akumulasi harian sesuai kriteria filter.</td></tr>`;
    } else {
        tbodyForeignDailyBuy.innerHTML = filteredBuys.map((row, idx) => {
            const chg = parseFloat(row.changePct || 0);
            const chgColor = chg >= 0 ? 'text-emerald-400' : 'text-rose-400';
            const sign = chg >= 0 ? '+' : '';
            const statusBadge = row.status?.includes('MASIF')
                ? 'bg-emerald-950/80 shadow-sm text-emerald-400 font-extrabold'
                : 'bg-cyan-950/80 shadow-sm text-cyan-300 font-bold';

            const buyVal = row.foreignBuyVal ? fmtRpMiliar(row.foreignBuyVal) : null;
            const sellVal = row.foreignSellVal ? fmtRpMiliar(row.foreignSellVal) : null;

            return `
                <tr class=" hover:bg-[#11192a] transition cursor-pointer" data-ticker="${escapeHtml(row.ticker)}">
                    <td class="p-3 font-mono">
                        <div class="flex items-center gap-2">
                            ${getForeignRankBadge(idx + 1)}
                            <span class="font-bold text-cyan-400 hover:underline text-sm">${escapeHtml(row.ticker)}</span>
                        </div>
                        <p class="text-[10px] text-slate-400 truncate max-w-[150px] sm:max-w-[200px] mt-0.5">${escapeHtml(row.sector || 'IDX')}</p>
                    </td>
                    <td class="p-3 font-mono font-semibold text-white">${fmtRp.format(row.currentPrice || row.price)}</td>
                    <td class="p-3 font-mono font-bold ${chgColor}">${sign}${chg.toFixed(2)}%</td>
                    <td class="p-3 font-mono">
                        <div class="font-extrabold text-emerald-400 text-sm">${fmtRpMiliar(row.netForeignVal)}</div>
                        ${buyVal && sellVal ? `
                        <div class="text-[10px] text-slate-400 flex items-center gap-1 font-mono mt-0.5">
                            <span class="text-emerald-500 font-semibold">B: ${buyVal}</span>
                            <span class="text-slate-600">|</span>
                            <span class="text-rose-400/80">S: ${sellVal}</span>
                        </div>` : ''}
                    </td>
                    <td class="p-3 font-mono font-semibold text-cyan-300">+${fmtNum.format(Math.abs(row.netForeignVol || 0))} Lot</td>
                    <td class="p-3">
                        <div class="flex items-center gap-1.5">
                            <span class="font-mono text-xs font-bold text-emerald-400">+${row.ffpi}</span>
                            <div class="w-12 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                <div class="bg-emerald-400 h-full rounded-full" style="width:${Math.min(100, Math.max(10, Math.abs(row.ffpi)))}%"></div>
                            </div>
                        </div>
                    </td>
                    <td class="p-3">
                        <span class="text-[10px] px-2 py-0.5 rounded shadow-sm ${statusBadge}">${escapeHtml(row.status || 'PROXY')}</span>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // 2. Top Sell
    const rawSells = allForeignData.daily.topSell || [];
    const filteredSells = filterForeignList(rawSells);

    if (filteredSells.length === 0) {
        tbodyForeignDailySell.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-slate-500 italic">Tidak ada data distribusi harian sesuai kriteria filter.</td></tr>`;
    } else {
        tbodyForeignDailySell.innerHTML = filteredSells.map((row, idx) => {
            const chg = parseFloat(row.changePct || 0);
            const chgColor = chg >= 0 ? 'text-emerald-400' : 'text-rose-400';
            const sign = chg >= 0 ? '+' : '';
            const statusBadge = row.status?.includes('MASIF')
                ? 'bg-rose-950/80 shadow-sm text-rose-400 font-extrabold'
                : 'bg-rose-950/60 shadow-sm text-rose-300 font-bold';

            const buyVal = row.foreignBuyVal ? fmtRpMiliar(row.foreignBuyVal) : null;
            const sellVal = row.foreignSellVal ? fmtRpMiliar(row.foreignSellVal) : null;

            return `
                <tr class=" hover:bg-[#11192a] transition cursor-pointer" data-ticker="${escapeHtml(row.ticker)}">
                    <td class="p-3 font-mono">
                        <div class="flex items-center gap-2">
                            ${getForeignRankBadge(idx + 1)}
                            <span class="font-bold text-cyan-400 hover:underline text-sm">${escapeHtml(row.ticker)}</span>
                        </div>
                        <p class="text-[10px] text-slate-400 truncate max-w-[150px] sm:max-w-[200px] mt-0.5">${escapeHtml(row.sector || 'IDX')}</p>
                    </td>
                    <td class="p-3 font-mono font-semibold text-white">${fmtRp.format(row.currentPrice || row.price)}</td>
                    <td class="p-3 font-mono font-bold ${chgColor}">${sign}${chg.toFixed(2)}%</td>
                    <td class="p-3 font-mono">
                        <div class="font-extrabold text-rose-400 text-sm">${fmtRpMiliar(row.netForeignVal)}</div>
                        ${buyVal && sellVal ? `
                        <div class="text-[10px] text-slate-400 flex items-center gap-1 font-mono mt-0.5">
                            <span class="text-emerald-400/80">B: ${buyVal}</span>
                            <span class="text-slate-600">|</span>
                            <span class="text-rose-500 font-semibold">S: ${sellVal}</span>
                        </div>` : ''}
                    </td>
                    <td class="p-3 font-mono font-semibold text-slate-300">-${fmtNum.format(Math.abs(row.netForeignVol || 0))} Lot</td>
                    <td class="p-3">
                        <div class="flex items-center gap-1.5">
                            <span class="font-mono text-xs font-bold text-rose-400">${row.ffpi}</span>
                            <div class="w-12 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                <div class="bg-rose-400 h-full rounded-full" style="width:${Math.min(100, Math.max(10, Math.abs(row.ffpi)))}%"></div>
                            </div>
                        </div>
                    </td>
                    <td class="p-3">
                        <span class="text-[10px] px-2 py-0.5 rounded shadow-sm ${statusBadge}">${escapeHtml(row.status || 'PROXY')}</span>
                    </td>
                </tr>
            `;
        }).join('');
    }
}

function renderForeignWeeklyTable() {
    if (!tbodyForeignWeekly || !allForeignData?.weekly) return;

    const rawList = allForeignData.weekly.topBuy || allForeignData.weekly.all || [];
    const filteredList = filterForeignList(rawList);

    if (filteredList.length === 0) {
        tbodyForeignWeekly.innerHTML = `<tr><td colspan="8" class="p-4 text-center text-slate-500 italic">Tidak ada data akumulasi mingguan (5D) sesuai kriteria filter.</td></tr>`;
        return;
    }

    tbodyForeignWeekly.innerHTML = filteredList.map((row, idx) => {
        const ret = parseFloat(row.weeklyPriceChgPct || row.weeklyReturnPct || 0);
        const retColor = ret >= 0 ? 'text-emerald-400' : 'text-rose-400';
        const sign = ret >= 0 ? '+' : '';
        const netVal = row.weeklyNetVal || 0;
        const netValColor = netVal >= 0 ? 'text-cyan-400 font-extrabold' : 'text-rose-400 font-bold';

        let accelBadge = '<span class="bg-slate-800 text-slate-300 text-[10px] px-2 py-0.5 rounded font-mono font-bold">STEADY ⚖️</span>';
        if (row.flowAcceleration >= 1.2) {
            accelBadge = '<span class="bg-emerald-950/80 shadow-sm text-emerald-400 text-[10px] px-2 py-0.5 rounded font-mono font-extrabold">ACCELERATING ⚡</span>';
        } else if (row.flowAcceleration < 0.8) {
            accelBadge = '<span class="bg-amber-950/60 shadow-sm text-amber-400 text-[10px] px-2 py-0.5 rounded font-mono font-semibold">DECELERATING 🔻</span>';
        }

        let phaseBadge = '<span class="bg-cyan-950/80 shadow-sm text-cyan-300 text-[10px] px-2 py-0.5 rounded font-bold">Akumulasi 🟢</span>';
        const ph = row.phase || row.institutionalPhase || '';
        if (ph.includes('Mark-Up') || ph.includes('Markup')) {
            phaseBadge = '<span class="bg-emerald-950/80 shadow-sm text-emerald-400 text-[10px] px-2 py-0.5 rounded font-extrabold">Mark-Up 🚀</span>';
        } else if (ph.includes('Re-Accumulation') || ph.includes('Akumulasi')) {
            phaseBadge = '<span class="bg-cyan-950/80 shadow-sm text-cyan-300 text-[10px] px-2 py-0.5 rounded font-bold">Re-Accumulation 📈</span>';
        } else if (ph.includes('Absorption') || ph.includes('Serap')) {
            phaseBadge = '<span class="bg-indigo-950/80 shadow-sm text-indigo-300 text-[10px] px-2 py-0.5 rounded font-bold">Absorption 🛡️</span>';
        } else if (ph.includes('Markdown')) {
            phaseBadge = '<span class="bg-rose-950/90 shadow-sm text-rose-400 text-[10px] px-2 py-0.5 rounded font-extrabold">Markdown 🔻</span>';
        } else if (ph.includes('Distribution') || ph.includes('Distribusi')) {
            phaseBadge = '<span class="bg-rose-950/80 shadow-sm text-rose-400 text-[10px] px-2 py-0.5 rounded font-bold">Distribution ⚠️</span>';
        }

        return `
            <tr class=" hover:bg-[#11192a] transition cursor-pointer" data-ticker="${escapeHtml(row.ticker)}">
                <td class="p-3 font-mono">
                    <div class="flex items-center gap-2">
                        ${getForeignRankBadge(idx + 1)}
                        <span class="font-bold text-cyan-400 hover:underline text-sm">${escapeHtml(row.ticker)}</span>
                    </div>
                    <p class="text-[10px] text-slate-400 truncate max-w-[150px] sm:max-w-[200px] mt-0.5">${escapeHtml(row.sector || 'IDX')}</p>
                </td>
                <td class="p-3 font-mono font-semibold text-white">${fmtRp.format(row.currentPrice || row.price)}</td>
                <td class="p-3 font-mono font-bold ${retColor}">${sign}${ret.toFixed(2)}%</td>
                <td class="p-3 font-mono">
                    <div class="${netValColor}">${fmtRpMiliar(netVal)}</div>
                    ${row.weeklyBuyVal ? `<div class="text-[10px] text-slate-400 font-mono">B: ${fmtRpMiliar(row.weeklyBuyVal)} | S: ${fmtRpMiliar(row.weeklySellVal)}</div>` : ''}
                </td>
                <td class="p-3 font-mono text-slate-300 font-semibold">${row.weeklyNetVol >= 0 ? '+' : ''}${fmtNum.format(row.weeklyNetVol || 0)} Lot</td>
                <td class="p-3">${accelBadge}</td>
                <td class="p-3 font-mono text-amber-400 font-bold">${row.daysNetBuy || row.netBuyDays || 0} / 5 Hari</td>
                <td class="p-3">${phaseBadge}</td>
            </tr>
        `;
    }).join('');
}

function renderForeignMonthlyTable() {
    if (!tbodyForeignMonthly || !allForeignData?.monthly) return;

    const rawList = allForeignData.monthly.topBuy || allForeignData.monthly.all || [];
    const filteredList = filterForeignList(rawList);

    if (filteredList.length === 0) {
        tbodyForeignMonthly.innerHTML = `<tr><td colspan="8" class="p-4 text-center text-slate-500 italic">Tidak ada data akumulasi bulanan (20D) sesuai kriteria filter.</td></tr>`;
        return;
    }

    tbodyForeignMonthly.innerHTML = filteredList.map((row, idx) => {
        const ret = parseFloat(row.monthlyPriceChgPct || row.monthlyReturnPct || 0);
        const retColor = ret >= 0 ? 'text-emerald-400' : 'text-rose-400';
        const sign = ret >= 0 ? '+' : '';
        const netVal = row.monthlyNetVal || 0;
        const pnl = parseFloat(row.foreignFloatingPL !== undefined ? row.foreignFloatingPL : (row.floatingPnlPct || 0));
        const pnlColor = pnl >= 0 ? 'text-emerald-400' : 'text-rose-400';

        let baseBadge = '<span class="bg-cyan-950/80 shadow-sm text-cyan-300 text-[10px] px-2 py-0.5 rounded font-bold">BUILDING BASE ⭐⭐</span>';
        const bs = row.baseScore || row.baseBuildingScore || 50;
        if (bs >= 70) {
            baseBadge = '<span class="bg-emerald-950/80 shadow-sm text-emerald-400 text-[10px] px-2 py-0.5 rounded font-extrabold">SOLID BASE ⭐⭐⭐</span>';
        } else if (bs < 40) {
            baseBadge = '<span class="bg-slate-800 text-slate-400 text-[10px] px-2 py-0.5 rounded font-semibold">TESTING BASE ⭐</span>';
        }

        return `
            <tr class=" hover:bg-[#11192a] transition cursor-pointer" data-ticker="${escapeHtml(row.ticker)}">
                <td class="p-3 font-mono">
                    <div class="flex items-center gap-2">
                        ${getForeignRankBadge(idx + 1)}
                        <span class="font-bold text-cyan-400 hover:underline text-sm">${escapeHtml(row.ticker)}</span>
                    </div>
                    <p class="text-[10px] text-slate-400 truncate max-w-[150px] sm:max-w-[200px] mt-0.5">${escapeHtml(row.sector || 'IDX')}</p>
                </td>
                <td class="p-3 font-mono font-semibold text-white">${fmtRp.format(row.currentPrice || row.price)}</td>
                <td class="p-3 font-mono font-bold ${retColor}">${sign}${ret.toFixed(2)}%</td>
                <td class="p-3 font-mono">
                    <div class="font-extrabold text-purple-300">${fmtRpMiliar(netVal)}</div>
                    ${row.monthlyBuyVal ? `<div class="text-[10px] text-slate-400 font-mono">B: ${fmtRpMiliar(row.monthlyBuyVal)} | S: ${fmtRpMiliar(row.monthlySellVal)}</div>` : ''}
                </td>
                <td class="p-3 font-mono font-bold text-amber-300">${row.foreignVWAP ? fmtRp.format(row.foreignVWAP) : 'Rp -'}</td>
                <td class="p-3 font-mono font-bold ${pnlColor}">${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}% ${pnl >= 0 ? 'Profit' : 'Loss'}</td>
                <td class="p-3 font-mono text-cyan-300 font-bold">${row.daysNetBuy || row.netBuyDays || 0} / 20 Hari</td>
                <td class="p-3">${baseBadge}</td>
            </tr>
        `;
    }).join('');
}

function renderForeignStreakTable() {
    if (!tbodyForeignStreak || !allForeignData?.streak) return;

    const rawList = allForeignData.streak.streaks || (Array.isArray(allForeignData.streak) ? allForeignData.streak : []);
    const filteredList = filterForeignList(rawList);

    if (filteredList.length === 0) {
        tbodyForeignStreak.innerHTML = `<tr><td colspan="10" class="p-4 text-center text-slate-500 italic">Tidak ada emiten dengan streak akumulasi aktif (≥ 2 hari) saat ini.</td></tr>`;
        return;
    }

    tbodyForeignStreak.innerHTML = filteredList.map((row, idx) => {
        const currentPrice = row.currentPrice || row.price || 0;
        const streakDays = row.streakDays || 2;
        const flame = streakDays >= 7 ? '💎💎💎' : streakDays >= 5 ? '🔥🔥🔥' : streakDays >= 3 ? '🔥🔥' : '🔥';
        const streakTotalVal = row.streakTotalVal || 0;
        const avgDaily = row.streakAvgDailyVal !== undefined && row.streakAvgDailyVal !== null
            ? row.streakAvgDailyVal
            : (row.avgDailyInflow !== undefined && row.avgDailyInflow !== null ? row.avgDailyInflow : (streakDays > 0 ? Math.round(streakTotalVal / streakDays) : 0));
        const gain = parseFloat(row.streakGainPct !== undefined ? row.streakGainPct : (row.streakPriceGain !== undefined ? row.streakPriceGain : 0));
        const gainColor = gain >= 0 ? 'text-emerald-400' : 'text-rose-400';
        const conviction = row.convictionRating || row.convictionBadge || 'HIGH CONVICTION ⭐⭐⭐⭐';
        const entryZone = row.entryZone || row.entryArea || (row.foreignVWAP ? `Rp ${Math.round(row.foreignVWAP * 0.99)} - Rp ${Math.round(row.foreignVWAP * 1.01)}` : '-');

        let trailingStop = row.trailingStop;
        if (typeof trailingStop === 'number') {
            if (currentPrice > 0 && trailingStop >= currentPrice) {
                trailingStop = Math.round(currentPrice * 0.97);
            }
            trailingStop = fmtRp.format(trailingStop);
        } else if (!trailingStop || trailingStop === '-') {
            trailingStop = currentPrice > 0 ? fmtRp.format(Math.round(currentPrice * 0.97)) : '-';
        }
        return `
            <tr class=" hover:bg-[#11192a] transition cursor-pointer" data-ticker="${escapeHtml(row.ticker)}">
                <td class="p-3 font-mono">
                    <div class="flex items-center gap-2">
                        ${getForeignRankBadge(idx + 1)}
                        <span class="font-bold text-cyan-400 hover:underline text-sm">${escapeHtml(row.ticker)}</span>
                    </div>
                    <p class="text-[10px] text-slate-400 truncate max-w-[150px] sm:max-w-[200px] mt-0.5">${escapeHtml(row.sector || 'IDX')}</p>
                </td>
                <td class="p-3 font-mono font-semibold text-white">${fmtRp.format(currentPrice)}</td>
                <td class="p-3">
                    <span class="bg-amber-500/20 text-amber-300 shadow-sm px-2.5 py-0.5 rounded-full font-bold font-mono text-xs whitespace-nowrap">
                        ${streakDays} Hari ${flame}
                    </span>
                </td>
                <td class="p-3 font-mono font-extrabold text-emerald-400">${fmtRpMiliar(row.streakTotalVal)}</td>
                <td class="p-3 font-mono font-semibold text-cyan-300">${fmtRpMiliar(avgDaily)}</td>
                <td class="p-3 font-mono font-bold ${gainColor}">${gain >= 0 ? '+' : ''}${gain.toFixed(2)}%</td>
                <td class="p-3">
                    <span class="bg-purple-950/80 shadow-sm text-purple-300 font-extrabold text-[10px] px-2 py-0.5 rounded">
                        ${escapeHtml(conviction)}
                    </span>
                </td>
                <td class="p-3 font-mono text-emerald-400 font-semibold">${escapeHtml(entryZone)}</td>
                <td class="p-3 font-mono text-rose-400 font-semibold">${trailingStop}</td>
                <td class="p-3">
                    <span class="bg-emerald-950/80 shadow-sm text-emerald-400 px-2 py-0.5 rounded text-[11px] font-mono font-bold whitespace-nowrap">
                        Estimasi berbasis harga dan volume
                    </span>
                </td>
            </tr>
        `;
    }).join('');
}

// Delegated click handler for foreign tables
['tbody-foreign-daily-buy', 'tbody-foreign-daily-sell', 'tbody-foreign-weekly', 'tbody-foreign-monthly', 'tbody-foreign-streak'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('click', (e) => {
        const tr = e.target.closest('tr[data-ticker]');
        if (tr) {
            const ticker = tr.getAttribute('data-ticker');
            if (ticker) executeStockAnalysis(ticker);
        }
    });
});
