const { nowJakarta, parseTradingDate, tradingDateBounds } = require('./dateTime');
const { fetchBrokerSummary } = require('./goapi');

function analyzeBandarmologi(topBuyers = [], topSellers = []) {
    const buyers = (Array.isArray(topBuyers) ? topBuyers : []).slice(0, 3).map(row => Math.max(0, Number(row.netValue) || 0));
    const sellers = (Array.isArray(topSellers) ? topSellers : []).slice(0, 3).map(row => Math.abs(Number(row.netValue) || 0));
    const buyTotal = buyers.reduce((sum, value) => sum + value, 0);
    const sellTotal = sellers.reduce((sum, value) => sum + value, 0);
    const topBuyerValue = buyers[0] || 0;
    const topSellerValue = sellers[0] || 0;
    const ratio = buyTotal + sellTotal ? buyTotal / (buyTotal + sellTotal) : 0.5;
    const significantGap = sellTotal > 0 && buyTotal >= sellTotal * 1.2;
    let status;
    if (!buyTotal && !sellTotal || Math.abs(buyTotal - sellTotal) / Math.max(buyTotal, sellTotal, 1) < 0.05) {
        status = { key: 'NEUTRAL', label: 'NEUTRAL ⚪', className: 'text-slate-200 border-slate-500/40' };
    } else if (topSellerValue > buyTotal * 1.5 && topSellerValue > 0) {
        status = { key: 'BIG_DISTRIBUTION', label: 'BIG DISTRIBUTION 🔴', className: 'text-rose-300 border-rose-500/40' };
    } else if (buyTotal > sellTotal && (significantGap || (sellTotal > 0 && topBuyerValue / sellTotal > 0.5))) {
        status = { key: 'BIG_ACCUMULATION', label: 'BIG ACCUMULATION 🟢', className: 'text-emerald-300 border-emerald-500/40' };
    } else if (buyTotal > sellTotal) {
        status = { key: 'NORMAL_ACCUMULATION', label: 'NORMAL ACCUMULATION 🟡', className: 'text-amber-200 border-amber-500/40' };
    } else {
        status = { key: 'NORMAL_DISTRIBUTION', label: 'NORMAL DISTRIBUTION 🟠', className: 'text-orange-300 border-orange-500/40' };
    }
    return { ...status, buyTotal, sellTotal, buyStrength: Math.round(ratio * 100), sellStrength: Math.round((1 - ratio) * 100) };
}

function tradingDaysBetween(startDate, endDate) {
    const start = parseTradingDate(startDate);
    const end = parseTradingDate(endDate);
    if (!start || !end || start.isAfter(end, 'day') || end.diff(start, 'day') > 31) return null;
    const dates = [];
    for (let cursor = start; !cursor.isAfter(end, 'day'); cursor = cursor.add(1, 'day')) {
        if (cursor.day() !== 0 && cursor.day() !== 6) dates.push(cursor.format('YYYY-MM-DD'));
    }
    return dates;
}

function normalizeBrokerRows(rows, totals) {
    if (!Array.isArray(rows)) return;
    for (const row of rows) {
        if (!row || String(row.transaction_type || '').toUpperCase() !== 'NET') continue;
        const brokerCode = String(row.code || row.broker?.code || '').trim().toUpperCase();
        const side = String(row.side || '').trim().toUpperCase();
        const lots = Number(row.lot);
        const averagePrice = Number(row.avg);
        if (!/^[A-Z0-9]{2,4}$/.test(brokerCode) || !['BUY', 'SELL'].includes(side) || !Number.isFinite(lots) || lots <= 0) continue;
        const key = `${brokerCode}:${side}`;
        const total = totals.get(key) || { brokerCode, side, lots: 0, value: 0, weightedAverage: 0 };
        total.lots += lots;
        total.value += Number.isFinite(Number(row.value)) && Number(row.value) > 0
            ? Number(row.value)
            : Number.isFinite(averagePrice) && averagePrice > 0 ? averagePrice * lots * 100 : 0;
        if (Number.isFinite(averagePrice) && averagePrice > 0) total.weightedAverage += averagePrice * lots;
        totals.set(key, total);
    }
}

async function fetchBroksum(ticker, dates, legacyEndDate) {
    const bounds = typeof dates === 'string' ? tradingDateBounds(dates, legacyEndDate) : dates;
    if (!bounds) throw new Error('Rentang tanggal trading Jakarta tidak valid.');
    const symbol = String(ticker || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{3,5}$/.test(symbol)) throw new Error('Kode saham tidak valid.');
    const tradingDates = tradingDaysBetween(bounds.startDate, bounds.endDate);
    if (!tradingDates) throw new Error('Rentang broksum maksimal 31 hari kalender.');

    const totals = new Map();
    for (let index = 0; index < tradingDates.length; index += 3) {
        const batch = tradingDates.slice(index, index + 3);
        const responses = await Promise.all(batch.map(date => fetchBrokerSummary(symbol, date, 'ALL')));
        for (const rows of responses) normalizeBrokerRows(rows, totals);
    }

    const allRows = Array.from(totals.values()).map(row => ({
        brokerCode: row.brokerCode,
        lots: row.lots,
        averagePrice: row.lots > 0 ? row.weightedAverage / row.lots : null,
        netValue: row.side === 'BUY' ? row.value : -row.value
    }));
    const buyers = allRows.filter(row => row.netValue > 0).sort((left, right) => right.netValue - left.netValue).slice(0, 5);
    const sellers = allRows.filter(row => row.netValue < 0).sort((left, right) => left.netValue - right.netValue).slice(0, 5);
    return {
        schemaVersion: '1.0',
        ticker: symbol,
        period: bounds,
        currency: 'IDR',
        dataSource: 'GOAPI',
        dataDates: tradingDates,
        buyers,
        sellers,
        analysis: analyzeBandarmologi(buyers, sellers),
        generatedAt: nowJakarta().format()
    };
}

module.exports = { analyzeBandarmologi, tradingDaysBetween, fetchBroksum };
