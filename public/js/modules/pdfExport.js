// ============================================================
//  MODULE: pdfExport.js
//  Vector PDF reports for the currently visible screener/portfolio data
// ============================================================
function pdfTimestamp() {
    return new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short' }) + ' WIB';
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
    return definitions.map(([key, title, columns, map]) => {
        const rows = filterScreenerList(lastScreenerData?.[key] || []);
        return rows.length ? { title, columns, rows: rows.map(map) } : null;
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

function exportScreenerToPDF() {
    const button = document.getElementById('btn-export-screener-pdf');
    if (!window.jspdf?.jsPDF || typeof window.jspdf.jsPDF.API.autoTable !== 'function') { alert('Library PDF belum siap. Silakan refresh halaman.'); return; }
    const sections = screenerPdfSections();
    if (!sections.length) { alert('Jalankan screener terlebih dahulu agar ada data untuk diekspor.'); return; }
    pdfSetLoading(button, true);
    try {
        const { jsPDF } = window.jspdf; const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        addPdfChrome(doc, 'STOCKRADAR AI - LAPORAN SCREENER', 'Kategori: Data screener yang sedang tampil dan terfilter');
        let y = 32;
        sections.forEach((section, index) => {
            if (index > 0 && y > 175) { doc.addPage(); y = 32; }
            doc.setTextColor(15, 38, 60); doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text(`Kategori: ${section.title}`, 14, y);
            doc.autoTable({ startY: y + 4, head: [section.columns], body: section.rows, theme: 'striped', styles: { font: 'helvetica', fontSize: 8, cellPadding: 2.2, textColor: [35, 50, 65] }, headStyles: { fillColor: [7, 72, 94], textColor: [255, 255, 255], fontStyle: 'bold' }, alternateRowStyles: { fillColor: [239, 247, 249] }, columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } }, didParseCell: data => { if (data.section === 'body' && data.column.index > 0) data.cell.styles.halign = 'right'; } });
            y = doc.lastAutoTable.finalY + 12;
        });
        addPdfFooter(doc);
        const height = doc.internal.pageSize.getHeight(); doc.setPage(doc.internal.getNumberOfPages()); doc.setTextColor(100, 116, 139); doc.setFontSize(7); doc.text('Disclaimer: Laporan ini digenerate secara otomatis oleh sistem Stockradar AI. Keputusan investasi tetap berada di tangan pengguna.', 14, height - 17);
        doc.save(`stockradar-screener-${new Date().toISOString().slice(0, 10)}.pdf`);
    } finally { pdfSetLoading(button, false); }
}

document.getElementById('btn-export-screener-pdf')?.addEventListener('click', exportScreenerToPDF);
