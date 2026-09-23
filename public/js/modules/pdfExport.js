// ============================================================
//  MODULE: pdfExport.js
//  Vector PDF reports for the currently visible screener/portfolio data
// ============================================================
function pdfTimestamp() {
    return new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short' }) + ' WIB';
}

function pdfJakartaDate() {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
}

// jsPDF's built-in Helvetica font cannot render emoji reliably. Keep the
// report text readable by removing pictographs only at PDF export time.
function sanitizePdfText(value) {
    return String(value ?? '')
        .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{FE0F}\u{200D}\u{20E3}]/gu, '')
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
}

function pdfSetLoading(button, loading) {
    if (!button) return;
    button.disabled = loading;
    button.innerHTML = loading ? '⏳ Generating...' : '📥 Ekspor PDF';
}

function screenerPdfSections() {
    const definitions = [
        ['scalping', 'Scalping Intraday', ['Kode', 'Harga', 'Chg %', 'Intraday', 'Target', 'Stop Loss', 'Status'], row => [row.ticker, formatPrice(row.price), `${row.changePct}%`, `${row.range}%`, formatPrice(row.targetProfit), formatPrice(row.stopLoss), row.label]],
        ['daytrade', 'Momentum Daytrade', ['Kode', 'Harga', 'Area Beli', 'Target', 'Stop Loss', 'Status'], row => [row.ticker, formatPrice(row.price), formatRange(row.entryZoneLow, row.entryZoneHigh, row.entryZone), formatPrice(row.targetProfit), formatPrice(row.stopLoss), row.label]],
        ['swing', 'Momentum Swing Trade', ['Kode', 'Harga', 'Area Beli', 'Target 1', 'Target 2', 'Cut Loss', 'R:R', 'Status'], row => [row.ticker, formatPrice(row.price), formatRange(row.areaBuyLow, row.areaBuyHigh, row.areaBuy), formatPrice(row.targetPrice1), formatPrice(row.targetPrice2), formatPrice(row.cutLoss), row.riskReward, row.label]],
        ['bsjp', 'BSJP - Akumulasi Sesi II', ['Kode', 'Harga', 'RSI', 'Area Beli', 'Target', 'Stop Loss', 'Status'], row => [row.ticker, formatPrice(row.price), row.rsi, row.beliSore, formatPrice(row.targetPagi), formatPrice(row.stopLoss), row.label]],
        ['bpjp', 'BPJP - Momentum / Rebound', ['Kode', 'Harga', 'RSI', 'ADX', 'Entry', 'Target', 'Stop Loss', 'Status'], row => [row.ticker, formatPrice(row.price), `${row.rsi} (${row.rsiStatus || ''})`, row.adx, row.entryPagi, formatPrice(row.target), formatPrice(row.stopLoss), row.label]],
        ['longterm', 'Investasi Jangka Panjang', ['Kode', 'Harga', 'RSI', 'EMA 200', 'Support', 'Target 20%', 'Target 40%', 'Cut Loss', 'Status'], row => [row.ticker, formatPrice(row.price), row.rsi, formatPrice(row.ema200), formatPrice(row.support), formatPrice(row.targetKonservatif), formatPrice(row.targetAgresif), formatPrice(row.cutLoss), row.label]]
    ];
    let rowBudget = 50;
    return definitions.map(([key, title, columns, map]) => {
        const rows = filterScreenerList(lastScreenerData?.[key] || []).slice(0, rowBudget);
        rowBudget -= rows.length;
        return rows.length ? { title: sanitizePdfText(title), columns: columns.map(sanitizePdfText), rows: rows.map(row => map(row).map(sanitizePdfText)) } : null;
    }).filter(Boolean);
}

function addPdfChrome(doc, title, subtitle) {
    const width = doc.internal.pageSize.getWidth();
    doc.setFillColor(7, 20, 35); doc.rect(0, 0, width, 25, 'F');
    doc.setTextColor(0, 230, 153); doc.setFont('helvetica', 'bold'); doc.setFontSize(17); doc.text(title, 14, 11);
    doc.setTextColor(190, 205, 220); doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.text(subtitle, 14, 18); doc.text(`Ekspor: ${pdfTimestamp()}`, width - 14, 18, { align: 'right' });
}

function addPdfFooter(doc) {
    const pageCount = doc.internal.getNumberOfPages();
    const width = doc.internal.pageSize.getWidth(); const height = doc.internal.pageSize.getHeight();
    for (let page = 1; page <= pageCount; page++) {
        doc.setPage(page); doc.setDrawColor(35, 55, 75); doc.line(14, height - 13, width - 14, height - 13);
        doc.setTextColor(100, 116, 139); doc.setFontSize(8); doc.text(`STOCKRADAR AI  |  Halaman ${page} dari ${pageCount}`, 14, height - 7);
    }
}

async function exportScreenerToPDF() {
    const button = document.getElementById('btn-export-screener-pdf');
    if (!window.jspdf?.jsPDF || typeof window.jspdf.jsPDF.API.autoTable !== 'function') { alert('Library PDF belum siap. Silakan refresh halaman.'); return; }
    let sections = screenerPdfSections();
    if (!sections.length) { alert('Jalankan screener terlebih dahulu agar ada data untuk diekspor.'); return; }
    pdfSetLoading(button, true);
    let doc = null;
    try {
        // Let the browser paint the progress state before generating the document.
        await new Promise(resolve => setTimeout(resolve, 30));
        const { jsPDF } = window.jspdf;
        doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        addPdfChrome(doc, 'STOCKRADAR AI - LAPORAN SCREENER', 'Kategori: Data yang sedang tampil dan terfilter · Maksimum 50 baris');
        let y = 32;
        sections.forEach((section, index) => {
            if (index > 0 && y > 175) { doc.addPage(); y = 32; }
            doc.setTextColor(15, 38, 60); doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text(`Kategori: ${section.title}`, 14, y);
            doc.autoTable({ startY: y + 4, head: [section.columns], body: section.rows, theme: 'striped', styles: { font: 'helvetica', fontSize: 8, cellPadding: 2.2, textColor: [35, 50, 65] }, headStyles: { fillColor: [7, 72, 94], textColor: [255, 255, 255], fontStyle: 'bold' }, alternateRowStyles: { fillColor: [239, 247, 249] }, columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } }, didParseCell: data => { if (data.section === 'body' && data.column.index > 0) data.cell.styles.halign = 'right'; } });
            y = doc.lastAutoTable.finalY + 12;
        });
        addPdfFooter(doc);
        const height = doc.internal.pageSize.getHeight(); doc.setPage(doc.internal.getNumberOfPages()); doc.setTextColor(100, 116, 139); doc.setFontSize(7); doc.text('Disclaimer: Laporan ini digenerate secara otomatis oleh sistem Stockradar AI. Keputusan investasi tetap berada di tangan pengguna.', 14, height - 17);
        await doc.save(`stockradar-screener-${pdfJakartaDate()}.pdf`, { returnPromise: true });
    } catch (error) {
        console.error('PDF export failed:', error);
        alert('PDF gagal dibuat. Silakan coba lagi.');
    } finally {
        sections.forEach(section => { section.rows.length = 0; });
        sections.length = 0;
        doc = null;
        await new Promise(resolve => setTimeout(resolve, 0));
        pdfSetLoading(button, false);
    }
}

document.getElementById('btn-export-screener-pdf')?.addEventListener('click', exportScreenerToPDF);
