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

const PDF_MARGINS = { top: 12, right: 15, bottom: 12, left: 15 };
const PDF_TABLE_BOTTOM = PDF_MARGINS.bottom + 6; // reserve footer text inside the page margin
let montserratFontDataPromise = null;

async function loadMontserratFontData() {
    if (!montserratFontDataPromise) {
        montserratFontDataPromise = Promise.all([
            fetch('/vendor/Montserrat-Regular.ttf').then(response => {
                if (!response.ok) throw new Error('Font Montserrat Regular tidak dapat dimuat.');
                return response.arrayBuffer();
            }),
            fetch('/vendor/Montserrat-Bold.ttf').then(response => {
                if (!response.ok) throw new Error('Font Montserrat Bold tidak dapat dimuat.');
                return response.arrayBuffer();
            })
        ]).then(buffers => buffers.map(buffer => {
            const bytes = new Uint8Array(buffer);
            let binary = '';
            for (let offset = 0; offset < bytes.length; offset += 0x8000) {
                binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
            }
            return btoa(binary);
        })).catch(error => {
            montserratFontDataPromise = null;
            throw error;
        });
    }
    return montserratFontDataPromise;
}

async function registerMontserratFonts(doc) {
    const [regular, bold] = await loadMontserratFontData();
    doc.addFileToVFS('Montserrat-Regular.ttf', regular);
    doc.addFont('Montserrat-Regular.ttf', 'Montserrat', 'normal');
    doc.addFileToVFS('Montserrat-Bold.ttf', bold);
    doc.addFont('Montserrat-Bold.ttf', 'Montserrat', 'bold');
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
    doc.setFillColor(15, 23, 42); doc.rect(0, 0, width, 25, 'F');
    doc.setTextColor(0, 230, 153); doc.setFont('Montserrat', 'bold'); doc.setFontSize(17); doc.text(title, PDF_MARGINS.left, 11);
    doc.setTextColor(203, 213, 225); doc.setFontSize(9); doc.setFont('Montserrat', 'normal'); doc.text(subtitle, PDF_MARGINS.left, 18); doc.text(`Ekspor: ${pdfTimestamp()}`, width - PDF_MARGINS.right, 18, { align: 'right' });
}

function addPdfFooter(doc) {
    const pageCount = doc.internal.getNumberOfPages();
    const width = doc.internal.pageSize.getWidth(); const height = doc.internal.pageSize.getHeight();
    for (let page = 1; page <= pageCount; page++) {
        doc.setPage(page); doc.setDrawColor(203, 213, 225); doc.line(PDF_MARGINS.left, height - 12, width - PDF_MARGINS.right, height - 12);
        doc.setTextColor(100, 116, 139); doc.setFont('Montserrat', 'normal'); doc.setFontSize(8); doc.text(`STOCKRADAR AI  |  Halaman ${page} dari ${pageCount}`, PDF_MARGINS.left, height - 6);
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
        await registerMontserratFonts(doc);
        addPdfChrome(doc, 'STOCKRADAR AI - LAPORAN SCREENER', 'Kategori: Data yang sedang tampil dan terfilter · Maksimum 50 baris');
        let y = 31;
        const rowsPerPage = 14;
        for (const section of sections) {
            const lastColumnIndex = section.columns.length - 1;
            const columnStyles = Object.fromEntries(section.columns.map((_, columnIndex) => [columnIndex, {
                halign: columnIndex === 0 || columnIndex === lastColumnIndex ? 'left' : 'right',
                ...(columnIndex === 0 || columnIndex === lastColumnIndex ? { fontStyle: 'bold' } : {})
            }]));
            for (let offset = 0; offset < section.rows.length; offset += rowsPerPage) {
                const rowChunk = section.rows.slice(offset, offset + rowsPerPage);
                const estimatedChunkHeight = 22 + rowChunk.length * 8.5;
                if (y + estimatedChunkHeight > doc.internal.pageSize.getHeight() - PDF_TABLE_BOTTOM && y > 31) {
                    doc.addPage('a4', 'landscape');
                    addPdfChrome(doc, 'STOCKRADAR AI - LAPORAN SCREENER', 'Kategori: Data yang sedang tampil dan terfilter · Maksimum 50 baris');
                    y = 31;
                }
                doc.autoTable({
                    startY: y,
                    head: [
                        [{ content: `Kategori: ${section.title}`, colSpan: section.columns.length, styles: {
                            fillColor: [255, 255, 255],
                            textColor: [15, 23, 42],
                            fontStyle: 'bold',
                            fontSize: 12,
                            halign: 'left',
                            lineWidth: 0,
                            cellPadding: { top: 1, right: 0, bottom: 1, left: 0 }
                        } }],
                        section.columns
                    ],
                    body: rowChunk,
                    theme: 'striped',
                    margin: { ...PDF_MARGINS, top: 31, bottom: PDF_TABLE_BOTTOM },
                    rowPageBreak: 'avoid',
                    showHead: 'everyPage',
                    tableWidth: 'auto',
                    styles: {
                        font: 'Montserrat',
                        fontSize: 8,
                        cellPadding: { top: 2.1, right: 2.65, bottom: 2.1, left: 2.65 },
                        textColor: [30, 41, 59],
                        lineColor: [226, 232, 240],
                        lineWidth: 0.15,
                        overflow: 'linebreak',
                        valign: 'middle'
                    },
                    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
                    alternateRowStyles: { fillColor: [248, 250, 252] },
                    columnStyles,
                    didParseCell: data => {
                        if (data.section === 'head' && data.row.index === 0) {
                            data.cell.styles.fillColor = [255, 255, 255];
                            data.cell.styles.textColor = [15, 23, 42];
                            data.cell.styles.fontStyle = 'bold';
                            data.cell.styles.fontSize = 12;
                            data.cell.styles.halign = 'left';
                            data.cell.styles.lineWidth = 0;
                            data.cell.styles.cellPadding = { top: 1, right: 0, bottom: 1, left: 0 };
                        }
                    }
                });
                y = doc.lastAutoTable.finalY + 8;
            }
        }
        addPdfFooter(doc);
        const height = doc.internal.pageSize.getHeight(); doc.setPage(doc.internal.getNumberOfPages()); doc.setTextColor(100, 116, 139); doc.setFont('Montserrat', 'normal'); doc.setFontSize(7); doc.text('Disclaimer: Laporan ini digenerate secara otomatis oleh sistem Stockradar AI. Keputusan investasi tetap berada di tangan pengguna.', PDF_MARGINS.left, height - 14);
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
