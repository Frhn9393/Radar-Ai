// Broker summary modal and mock API adapter for Bandarmologi analysis.
const broksumModal = document.getElementById('modal-broksum');
let activeBroksumTicker = '';

function formatBroksumValue(value) {
    const amount = Number(value) || 0;
    return fmtRp.format(amount);
}

async function fetchBroksum(ticker, startDate, endDate) {
    const response = await fetch(`/api/broksum/${encodeURIComponent(ticker)}?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
}

function renderBrokerRows(elementId, rows, color) {
    const body = document.getElementById(elementId);
    if (!body) return;
    body.innerHTML = rows.map(row => `<tr class="border-t border-slate-800"><td class="p-2 font-mono font-bold ${color}">${escapeHtml(row.brokerCode)}</td><td class="p-2 text-right font-mono">${Number(row.lots).toLocaleString('id-ID')}</td><td class="p-2 text-right font-mono">${formatBroksumValue(row.averagePrice)}</td><td class="p-2 text-right font-mono">${formatBroksumValue(Math.abs(row.netValue))}</td></tr>`).join('');
}

async function loadBroksumForPeriod() {
    const button = document.getElementById('broksum-load');
    const conclusion = document.getElementById('broksum-conclusion');
    const startDate = document.getElementById('broksum-start').value;
    const endDate = document.getElementById('broksum-end').value;
    if (!startDate || !endDate || startDate > endDate) { conclusion.textContent = 'Pilih rentang tanggal yang valid.'; return; }
    button.disabled = true; button.textContent = 'Memuat…';
    try {
        const data = await fetchBroksum(activeBroksumTicker, startDate, endDate);
        const analysis = data.analysis;
        conclusion.textContent = analysis.label;
        conclusion.className = `rounded-xl border bg-[#0e1626] p-4 text-center text-lg font-black ${analysis.className}`;
        renderBrokerRows('broksum-buyers', data.buyers, 'text-emerald-300');
        renderBrokerRows('broksum-sellers', data.sellers, 'text-orange-300');
        document.getElementById('broksum-buy-strength').textContent = `${analysis.buyStrength}%`;
        document.getElementById('broksum-sell-strength').textContent = `${analysis.sellStrength}%`;
        document.getElementById('broksum-buy-bar').style.width = `${analysis.buyStrength}%`;
        document.getElementById('broksum-sell-bar').style.width = `${analysis.sellStrength}%`;
        document.getElementById('broksum-summary').textContent = `Top 3 buyer ${formatBroksumValue(analysis.buyTotal)} vs top 3 seller ${formatBroksumValue(analysis.sellTotal)}. Dataset: ${data.dataSource}; periode ${data.period.startDate}–${data.period.endDate}.`;
        document.getElementById('broksum-source').textContent = data.dataSource === 'MOCK' ? 'Data simulasi • belum tersambung ke data broker BEI' : `Sumber: ${data.dataSource}`;
    } catch (error) {
        conclusion.textContent = 'Gagal memuat analisis broksum.';
        console.error('Broksum load failed:', error);
    } finally { button.disabled = false; button.textContent = 'Analisis Periode'; }
}

function openBroksum(ticker) {
    activeBroksumTicker = String(ticker || '').toUpperCase();
    document.getElementById('broksum-ticker').textContent = `$${activeBroksumTicker}`;
    const end = new Date(); const start = new Date(); start.setDate(start.getDate() - 6);
    document.getElementById('broksum-start').value = start.toISOString().slice(0, 10);
    document.getElementById('broksum-end').value = end.toISOString().slice(0, 10);
    broksumModal.classList.remove('hidden'); broksumModal.classList.add('flex');
    loadBroksumForPeriod();
}

document.addEventListener('click', event => {
    const button = event.target.closest('.broksum-open');
    if (button) { event.preventDefault(); event.stopPropagation(); openBroksum(button.dataset.broksumTicker); }
});
document.getElementById('broksum-load')?.addEventListener('click', loadBroksumForPeriod);
document.getElementById('broksum-close')?.addEventListener('click', () => { broksumModal.classList.add('hidden'); broksumModal.classList.remove('flex'); });
broksumModal?.addEventListener('click', event => { if (event.target === broksumModal) document.getElementById('broksum-close').click(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && broksumModal && !broksumModal.classList.contains('hidden')) document.getElementById('broksum-close').click(); });
