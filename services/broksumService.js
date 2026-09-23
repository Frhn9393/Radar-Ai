const { nowJakarta, formatJakartaDate, parseTradingDate, tradingDateBounds } = require('./dateTime');
const { fetchBrokerTop, emptyBroksum } = require('./customMarketFeed');

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

function formatFeedDate(value) {
    if (typeof value !== 'string' || !value) return null;
    if (parseTradingDate(value)) return value;
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? formatJakartaDate(date) : null;
}

function mapBrokerRows(rows, direction) {
    return rows.map(row => ({
        brokerCode: row.brokerCode,
        lots: row.lots,
        averagePrice: row.averagePrice,
        netValue: direction * row.value
    }));
}

async function fetchBroksum(ticker, dates, legacyEndDate) {
    const bounds = typeof dates === 'string' ? tradingDateBounds(dates, legacyEndDate) : dates;
    const symbol = String(ticker || '').trim().toUpperCase();
    if (!bounds || !/^[A-Z0-9]{3,5}$/.test(symbol)) return emptyBroksum(symbol, bounds || {});
    const feed = await fetchBrokerTop(symbol);
    if (!feed || feed.dataSource !== 'STOCKBIT') return emptyBroksum(symbol, bounds);

    const dataDate = formatFeedDate(feed.date);
    if (!dataDate || dataDate < bounds.startDate || dataDate > bounds.endDate) return emptyBroksum(symbol, bounds);
    const buyers = mapBrokerRows(feed.topBuyers, 1);
    const sellers = mapBrokerRows(feed.topSellers, -1);
    return {
        schemaVersion: '1.0',
        ticker: symbol,
        period: { ...bounds, dataDate },
        currency: 'IDR',
        dataSource: 'STOCKBIT',
        buyers,
        sellers,
        analysis: analyzeBandarmologi(buyers, sellers),
        brokerFlow: {
            netBuyerPowerPct: feed.netBuyerPowerPct,
            orderBook: feed.orderBook,
            runningTradeFrequencyPerMinute: feed.runningTradeFrequencyPerMinute,
            averageDailyTurnover: feed.averageDailyTurnover
        },
        generatedAt: nowJakarta().format()
    };
}

module.exports = { analyzeBandarmologi, formatFeedDate, fetchBroksum };
