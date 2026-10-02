// ============================================================
//  CENTRALIZED CURRENCY FORMATTER
//  Standardized Indonesian Rupiah Currency Formatting
//  - Nilai >= 1 Triliun  -> Rp X,XX T
//  - Nilai >= 1 Miliar   -> Rp X,XX M
//  - Nilai < 1 Miliar    -> Rp X
// ============================================================

function formatCurrency(value, options = {}) {
    if (value === null || value === undefined || value === '' || (typeof value === 'number' && isNaN(value))) {
        return options.fallback !== undefined ? options.fallback : 'Rp 0';
    }

    let num = value;
    if (typeof value === 'string') {
        const cleanStr = value.trim();
        // Check for textual strings like 'RP 2 TRILIUN', 'Rp372,6 MILIAR', '2 T', etc.
        const match = cleanStr.match(/^([+-]?)\s*(?:Rp\.?|IDR)?\s*([\d.,]+)\s*(Triliun|Miliar|Juta|Billion|Million|T|M|B)?/i);
        if (match && (match[3] || cleanStr.toLowerCase().includes('triliun') || cleanStr.toLowerCase().includes('miliar') || cleanStr.toLowerCase().includes('t') || cleanStr.toLowerCase().includes('m'))) {
            const sign = match[1] === '-' ? -1 : 1;
            const rawNumStr = match[2].replace(/\./g, '').replace(',', '.');
            const parsedNum = parseFloat(rawNumStr);
            if (!isNaN(parsedNum)) {
                const unit = (match[3] || '').toUpperCase();
                let multiplier = 1;
                if (unit === 'T' || unit.startsWith('TRIL')) multiplier = 1e12;
                else if (unit === 'M' || unit.startsWith('MIL') || unit.startsWith('BIL')) multiplier = 1e9;
                else if (unit === 'JUTA' || unit.startsWith('JUT') || unit.startsWith('MILL')) multiplier = 1e6;
                num = sign * parsedNum * multiplier;
            }
        } else {
            const parsed = Number(cleanStr.replace(/[^0-9.-]/g, ''));
            if (!isNaN(parsed) && cleanStr.length > 0) num = parsed;
        }
    }

    if (isNaN(num)) return typeof value === 'string' ? value : 'Rp 0';

    const n = Number(num);
    const abs = Math.abs(n);
    const sign = n < 0 ? '-' : (options.showPlus && n > 0 ? '+' : '');

    const idFormat = new Intl.NumberFormat('id-ID', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
    const idIntFormat = new Intl.NumberFormat('id-ID', {
        maximumFractionDigits: 0
    });

    if (abs >= 1e12) {
        return `${sign}Rp ${idFormat.format(abs / 1e12)} T`;
    }
    if (abs >= 1e9) {
        return `${sign}Rp ${idFormat.format(abs / 1e9)} M`;
    }
    return `${sign}Rp ${idIntFormat.format(Math.round(abs))}`;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { formatCurrency };
}
if (typeof window !== 'undefined') {
    window.formatCurrency = formatCurrency;
}
