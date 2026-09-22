// Search & Autocomplete Service for IDX Stocks (900+ emiten)
let ALL_IDX_STOCKS = [];
try {
    ALL_IDX_STOCKS = require('./idx_stocks.json');
} catch (e) {
    console.error('Failed to load idx_stocks.json:', e.message);
    ALL_IDX_STOCKS = [];
}

const { sanitizeTicker } = require('./utils');

function search_stocks(query) {
    if (!query) return [];
    const cleanQ = sanitizeTicker(query);
    const q = cleanQ;
    const qLower = cleanQ.toLowerCase();

    // Special handling for IHSG / Composite Index
    if (q === 'IHSG' || q === '^JKSE' || q === 'JKSE') {
        return [{
            ticker: 'IHSG',
            name: 'Indeks Harga Saham Gabungan (BEI)',
            sector: 'Indeks Acuan Pasar Saham Utama Indonesia'
        }];
    }

    // 1. Exact or starts-with ticker match (highest priority)
    const exactMatches = ALL_IDX_STOCKS.filter(s => s.ticker === q);
    const startsMatches = ALL_IDX_STOCKS.filter(s => s.ticker.startsWith(q) && s.ticker !== q);
    const containsMatches = ALL_IDX_STOCKS.filter(s =>
        s && s.ticker && !s.ticker.startsWith(q) && (
            s.ticker.includes(q) ||
            (s.name && s.name.toLowerCase().includes(qLower)) ||
            (s.sector && s.sector.toLowerCase().includes(qLower))
        )
    );

    const merged = [...exactMatches, ...startsMatches, ...containsMatches];

    // If query matches IHSG in general search
    if ('IHSG'.includes(q) && !merged.some(m => m.ticker === 'IHSG')) {
        merged.push({
            ticker: 'IHSG',
            name: 'Indeks Harga Saham Gabungan (BEI)',
            sector: 'Indeks Acuan Pasar Saham Utama Indonesia'
        });
    }

    // If query is a 4-letter code and not in list, add synthetic fallback
    if (q.length === 4 && /^[A-Z]{4}$/.test(q) && q !== 'IHSG' && !merged.some(m => m.ticker === q)) {
        merged.unshift({
            ticker: q,
            name: `PT ${q} Tbk`,
            sector: 'Emiten Terdaftar BEI / IHSG'
        });
    }

    return merged.slice(0, 12);
}

module.exports = {
    search_stocks,
    search_suggestions: search_stocks,
    ALL_IDX_STOCKS
};
