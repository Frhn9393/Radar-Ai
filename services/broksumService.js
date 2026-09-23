const BROKER_CODES = ['YP', 'MG', 'CC', 'PD', 'NI', 'ZP', 'BK', 'AK'];
const { nowJakarta, tradingDateBounds } = require('./dateTime');

function analyzeBandarmologi(topBuyers = [], topSellers = []) {
    const buyers = topBuyers.slice(0, 3).map(row => Math.max(0, Number(row.netValue) || 0));
    const sellers = topSellers.slice(0, 3).map(row => Math.abs(Number(row.netValue) || 0));
    const buyTotal = buyers.reduce((sum, value) => sum + value, 0);
    const sellTotal = sellers.reduce((sum, value) => sum + value, 0);
    const topSellerValue = Math.abs(Number(topSellers[0]?.netValue) || 0);
    const ratio = buyTotal + sellTotal ? buyTotal / (buyTotal + sellTotal) : 0.5;
    const significantGap = sellTotal > 0 && buyTotal >= sellTotal * 1.25;
    let status;
    if (!buyTotal && !sellTotal || Math.abs(buyTotal - sellTotal) / Math.max(buyTotal, sellTotal, 1) < 0.05) {
        status = { key: 'NEUTRAL', label: 'NEUTRAL ⚪', className: 'text-slate-200 border-slate-500/40' };
    } else if (topSellerValue > buyTotal * 1.5 && topSellerValue > 0) {
        status = { key: 'BIG_DISTRIBUTION', label: 'BIG DISTRIBUTION 🔴', className: 'text-rose-300 border-rose-500/40' };
    } else if (buyTotal > sellTotal && (significantGap || (sellTotal > 0 && buyers[0] / sellTotal > 0.5))) {
        status = { key: 'BIG_ACCUMULATION', label: 'BIG ACCUMULATION 🟢', className: 'text-emerald-300 border-emerald-500/40' };
    } else if (buyTotal > sellTotal) {
        status = { key: 'NORMAL_ACCUMULATION', label: 'NORMAL ACCUMULATION 🟡', className: 'text-amber-200 border-amber-500/40' };
    } else {
        status = { key: 'NORMAL_DISTRIBUTION', label: 'NORMAL DISTRIBUTION 🟠', className: 'text-orange-300 border-orange-500/40' };
    }
    return { ...status, buyTotal, sellTotal, buyStrength: Math.round(ratio * 100), sellStrength: Math.round((1 - ratio) * 100) };
}

function createMockBroksum(ticker, dates) {
    const seed = [...String(ticker)].reduce((sum, char) => sum + char.charCodeAt(0), 0) + Number(dates.endDate.slice(-2));
    const makeRows = (offset, direction) => BROKER_CODES.slice(offset, offset + 5).map((code, index) => {
        const lots = (seed * (index + 5 + offset) * 73) % 7500 + 350;
        const averagePrice = Math.round(((seed * (index + 11) * 37) % 9500 + 500) / 25) * 25;
        const netValue = lots * 100 * averagePrice;
        return { brokerCode: code, lots, averagePrice, netValue: direction * netValue };
    }).sort((a, b) => Math.abs(b.netValue) - Math.abs(a.netValue));
    const buyers = makeRows(0, 1);
    const sellers = makeRows(3, -1);
    return {
        schemaVersion: '1.0', ticker: String(ticker).toUpperCase(), period: dates, currency: 'IDR',
        dataSource: 'MOCK', buyers, sellers, analysis: analyzeBandarmologi(buyers, sellers), generatedAt: nowJakarta().format()
    };
}

async function fetchBroksum(ticker, dates, legacyEndDate) {
    // Replace the mock response with the provider adapter while preserving this response schema.
    const bounds = typeof dates === 'string' ? tradingDateBounds(dates, legacyEndDate) : dates;
    if (!bounds) throw new Error('Rentang tanggal trading Jakarta tidak valid.');
    return createMockBroksum(ticker, bounds);
}

module.exports = { analyzeBandarmologi, createMockBroksum, fetchBroksum };
