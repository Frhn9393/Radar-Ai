const { formatJakartaDate, nowJakarta } = require('./dateTime');
const { createHash } = require('crypto');

const STOCKBIT_BASE_URL = 'https://exodus.stockbit.com';
const REQUEST_TIMEOUT_MS = 7000;
const CACHE_TTL_MS = 15_000;
const responseCache = new Map();
const pendingRequests = new Map();
let lastFailureLogAt = 0;

class StockbitFeedError extends Error {
    constructor(code, statusCode = null) {
        super(code);
        this.name = 'StockbitFeedError';
        this.code = code;
        this.statusCode = statusCode;
    }
}

function normalizeTicker(ticker) {
    const value = String(ticker || '').trim().toUpperCase();
    return /^[A-Z0-9]{3,5}$/.test(value) ? value : null;
}

function finiteOrNull(value) {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

function findFirst(object, keys) {
    if (!object || typeof object !== 'object') return undefined;
    for (const key of keys) if (object[key] !== undefined && object[key] !== null) return object[key];
    return undefined;
}

function normalizeBrokerRow(row, side) {
    if (!row || typeof row !== 'object') return null;
    const brokerCode = String(findFirst(row, ['broker_code', 'brokerCode', 'code', 'broker']) || '').trim().toUpperCase();
    const value = finiteOrNull(findFirst(row, ['net_value', 'netValue', 'value', 'transaction_value', 'net_amount']));
    const lots = finiteOrNull(findFirst(row, ['net_lot', 'netLot', 'lot', 'lots', 'volume']));
    const averagePrice = finiteOrNull(findFirst(row, ['average_price', 'averagePrice', 'avg_price', 'avgPrice', 'avg']));
    if (!/^[A-Z0-9]{2,4}$/.test(brokerCode) || value === null || value <= 0) return null;
    return { brokerCode, value, lots, averagePrice, side };
}

function classifyBrokerFlow(buyers, sellers) {
    const topBuyers = [...buyers].sort((a, b) => b.value - a.value).slice(0, 3);
    const topSellers = [...sellers].sort((a, b) => b.value - a.value).slice(0, 3);
    if (!topBuyers.length || !topSellers.length) return null;
    const buyValue = topBuyers.reduce((sum, row) => sum + row.value, 0);
    const sellValue = topSellers.reduce((sum, row) => sum + row.value, 0);
    if (!(buyValue > 0) || !(sellValue > 0)) return null;
    const buyerConcentration = topBuyers[0].value / sellValue;
    const buyerSellerRatio = buyValue / sellValue;
    const bigDistribution = topSellers[0].value > buyValue * 1.5;
    const status = bigDistribution ? 'BIG DISTRIBUTION'
        : buyerConcentration > 0.5 || buyerSellerRatio >= 1.2 ? 'BIG ACCUMULATION'
            : buyValue > sellValue ? 'NORMAL ACCUMULATION'
                : sellValue > buyValue ? 'NORMAL DISTRIBUTION' : 'NEUTRAL';
    return {
        status,
        analysis: { key: status.replace(/\s+/g, '_'), label: status },
        topBuyers,
        topSellers,
        topThreeBuyValue: buyValue,
        topThreeSellValue: sellValue,
        netBuyerPowerPct: Math.round((buyValue / (buyValue + sellValue)) * 100)
    };
}

function parseStockbitResponse(body, requestedTicker) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
    const root = body.data && typeof body.data === 'object' ? body.data : body;
    const summary = root.broker_summary || root.brokerSummary || root.broker_top || root.brokerTop || root;
    const responseTicker = String(findFirst(root, ['symbol', 'ticker', 'stock_code']) || findFirst(summary, ['symbol', 'ticker', 'stock_code']) || '').toUpperCase();
    if (!responseTicker || responseTicker !== requestedTicker) return null;

    const buyRows = findFirst(summary, ['brokers_buy', 'brokersBuy', 'top_buyers', 'topBuyers', 'buyers', 'buy']);
    const sellRows = findFirst(summary, ['brokers_sell', 'brokersSell', 'top_sellers', 'topSellers', 'sellers', 'sell']);
    if (!Array.isArray(buyRows) || !Array.isArray(sellRows)) return null;
    const buyers = buyRows.map(row => normalizeBrokerRow(row, 'BUY')).filter(Boolean);
    const sellers = sellRows.map(row => normalizeBrokerRow(row, 'SELL')).filter(Boolean);
    const flow = classifyBrokerFlow(buyers, sellers);
    if (!flow) return null;

    const orderBook = root.order_book || root.orderBook || root.orderbook || null;
    const bidVolume = finiteOrNull(orderBook && findFirst(orderBook, ['total_bid_volume', 'totalBidVolume', 'bid_volume', 'bidVolume']));
    const offerVolume = finiteOrNull(orderBook && findFirst(orderBook, ['total_offer_volume', 'totalOfferVolume', 'offer_volume', 'offerVolume']));
    const runningTradeFrequencyPerMinute = finiteOrNull(findFirst(root, ['running_trade_frequency_per_minute', 'runningTradeFrequencyPerMinute', 'frequency_per_minute']));
    const averageDailyTurnover = finiteOrNull(findFirst(root, ['average_daily_turnover', 'averageDailyTurnover', 'avg_daily_turnover']));
    const netBuyerPowerPct = finiteOrNull(findFirst(root, ['net_buyer_power_pct', 'netBuyerPowerPct'])) ?? flow.netBuyerPowerPct;
    const date = findFirst(root, ['date', 'trade_date', 'tradeDate', 'to', 'updated_at', 'updatedAt']) || null;

    return {
        dataSource: 'STOCKBIT',
        ticker: requestedTicker,
        date,
        status: flow.status,
        analysis: flow.analysis,
        topBuyers: flow.topBuyers,
        topSellers: flow.topSellers,
        topThreeBuyValue: flow.topThreeBuyValue,
        topThreeSellValue: flow.topThreeSellValue,
        netBuyerPowerPct,
        orderBook: bidVolume !== null && offerVolume !== null ? { totalBidVolume: bidVolume, totalOfferVolume: offerVolume } : null,
        runningTradeFrequencyPerMinute,
        averageDailyTurnover,
    };
}

async function requestBrokerTop(ticker) {
    const token = process.env.SEKURITAS_AUTH_TOKEN;
    if (!token) throw new StockbitFeedError('MISSING_CREDENTIAL');
    const symbol = normalizeTicker(ticker);
    if (!symbol) throw new StockbitFeedError('INVALID_TICKER');
    const url = new URL('/order-trade/broker/top', STOCKBIT_BASE_URL);
    url.searchParams.set('symbol', symbol);
    const tokenDigest = createHash('sha256').update(token).digest('hex');
    const key = `${url.toString()}|${tokenDigest}`;
    const cached = responseCache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    if (pendingRequests.has(key)) return pendingRequests.get(key);

    const pending = (async () => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    Accept: 'application/json',
                    Authorization: `Bearer ${token}`,
                    Origin: 'https://stockbit.com',
                    Referer: 'https://stockbit.com/',
                    'User-Agent': 'Mozilla/5.0 (compatible; StockradarAI/1.0)'
                },
                signal: controller.signal
            });
            if (response.status === 401 || response.status === 403) throw new StockbitFeedError('AUTH_REJECTED', response.status);
            if (!response.ok) throw new StockbitFeedError('UPSTREAM_HTTP_ERROR', response.status);
            const body = await response.json();
            if (body?.error || String(body?.status || '').toLowerCase() === 'error') throw new StockbitFeedError('UPSTREAM_RESPONSE_ERROR');
            const parsed = parseStockbitResponse(body, symbol);
            if (!parsed) throw new StockbitFeedError('UNRECOGNIZED_RESPONSE');
            responseCache.set(key, { value: parsed, expiresAt: Date.now() + CACHE_TTL_MS });
            return parsed;
        } catch (error) {
            if (error instanceof StockbitFeedError) throw error;
            if (error?.name === 'AbortError') throw new StockbitFeedError('UPSTREAM_TIMEOUT');
            throw new StockbitFeedError('UPSTREAM_UNAVAILABLE');
        } finally {
            clearTimeout(timeout);
            pendingRequests.delete(key);
        }
    })();
    pendingRequests.set(key, pending);
    return pending;
}

async function fetchBrokerTop(ticker) {
    try {
        return await requestBrokerTop(ticker);
    } catch (error) {
        if (Date.now() - lastFailureLogAt >= 30_000) {
            console.warn('[stockbit-feed] request failed', {
                ticker: normalizeTicker(ticker),
                code: error instanceof StockbitFeedError ? error.code : 'UNEXPECTED_ERROR',
                statusCode: error?.statusCode || null
            });
            lastFailureLogAt = Date.now();
        }
        return null;
    }
}

function emptyBroksum(ticker, period = {}) {
    return {
        schemaVersion: '1.0',
        ticker: normalizeTicker(ticker),
        period,
        currency: 'IDR',
        dataSource: 'STOCKBIT_UNAVAILABLE',
        buyers: [],
        sellers: [],
        analysis: { key: 'NEUTRAL', label: 'WAIT & SEE', buyTotal: 0, sellTotal: 0, buyStrength: 0, sellStrength: 0 },
        generatedAt: nowJakarta().format()
    };
}

module.exports = {
    STOCKBIT_BASE_URL,
    StockbitFeedError,
    fetchBrokerTop,
    requestBrokerTop,
    parseStockbitResponse,
    classifyBrokerFlow,
    normalizeTicker,
    emptyBroksum,
    _clearCacheForTests() {
        responseCache.clear();
        pendingRequests.clear();
        lastFailureLogAt = 0;
    }
};
