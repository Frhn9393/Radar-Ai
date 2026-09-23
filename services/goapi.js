const { formatJakartaDate, parseTradingDate } = require('./dateTime');

const GOAPI_BASE_URL = 'https://api.goapi.io';
const GOAPI_CAPABILITIES = Object.freeze({ prices: true, historical: true, brokerSummary: true, orderBook: false, runningTrade: false });
const CACHE_TTL_MS = 30_000;
const responseCache = new Map();
const pendingRequests = new Map();

class GoApiError extends Error {
    constructor(message, statusCode = null) {
        super(message);
        this.name = 'GoApiError';
        this.statusCode = statusCode;
    }
}

function normalizeTicker(ticker) {
    const normalized = String(ticker || '').trim().toUpperCase();
    return /^[A-Z0-9]{3,5}$/.test(normalized) ? normalized : null;
}

function cacheGet(key) {
    const entry = responseCache.get(key);
    if (!entry || entry.expiresAt <= Date.now()) {
        responseCache.delete(key);
        return undefined;
    }
    return entry.value;
}

async function requestJson(path, params = {}) {
    const apiKey = process.env.GOAPI_KEY;
    if (!apiKey) throw new GoApiError('GOAPI_KEY is not configured');

    const url = new URL(path, GOAPI_BASE_URL);
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
    }
    const cacheKey = url.toString();
    const cached = cacheGet(cacheKey);
    if (cached !== undefined) return cached;
    if (pendingRequests.has(cacheKey)) return pendingRequests.get(cacheKey);

    const pending = (async () => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    Accept: 'application/json',
                    'X-API-KEY': apiKey
                },
                signal: controller.signal
            });
            if (!response.ok) throw new GoApiError(`GoAPI request failed (HTTP ${response.status})`, response.status);
            const body = await response.json();
            if (!body || typeof body !== 'object' || Array.isArray(body) || String(body.status || '').toLowerCase() === 'error') {
                throw new GoApiError('GoAPI returned an invalid or unsuccessful response');
            }
            responseCache.set(cacheKey, { value: body, expiresAt: Date.now() + CACHE_TTL_MS });
            return body;
        } catch (error) {
            if (error instanceof GoApiError) throw error;
            if (error?.name === 'AbortError') throw new GoApiError('GoAPI request timed out');
            throw new GoApiError('Unable to reach GoAPI');
        } finally {
            clearTimeout(timeout);
            pendingRequests.delete(cacheKey);
        }
    })();
    pendingRequests.set(cacheKey, pending);
    return pending;
}

function rowsFrom(body, keys = ['results']) {
    const data = body?.data;
    if (Array.isArray(data)) return data;
    for (const key of keys) if (Array.isArray(data?.[key])) return data[key];
    return [];
}

function normalizeStockRow(row) {
    if (!row || typeof row !== 'object') return null;
    const ticker = normalizeTicker(row.symbol || row.ticker);
    const date = row.date;
    const numeric = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;
    const result = {
        ticker,
        date,
        open: numeric(row.open),
        high: numeric(row.high),
        low: numeric(row.low),
        close: numeric(row.close),
        volume: numeric(row.volume),
        value: numeric(row.value),
        previousClose: numeric(row.previousClose ?? row.prevClose)
    };
    return ticker && result.close !== null && result.volume !== null ? result : null;
}

async function fetchStockPrices(tickers) {
    const symbols = Array.from(new Set((Array.isArray(tickers) ? tickers : []).map(normalizeTicker).filter(Boolean)));
    if (symbols.length === 0) return new Map();
    const result = new Map();
    for (let start = 0; start < symbols.length; start += 100) {
        const batch = symbols.slice(start, start + 100);
        const body = await requestJson('/stock/idx/prices', { symbols: batch.join(',') });
        for (const row of rowsFrom(body, ['results'])) {
            const normalized = normalizeStockRow(row);
            if (normalized) result.set(normalized.ticker, normalized);
        }
    }
    return result;
}

async function fetchHistorical(ticker, from, to) {
    const symbol = normalizeTicker(ticker);
    if (!symbol || !parseTradingDate(from) || !parseTradingDate(to) || from > to) {
        throw new GoApiError('Invalid ticker or historical date range');
    }
    const body = await requestJson(`/stock/idx/${encodeURIComponent(symbol)}/historical`, { from, to });
    return rowsFrom(body, ['results']).map(normalizeStockRow).filter(Boolean);
}

async function fetchBrokerSummary(ticker, date = formatJakartaDate(), investor = 'ALL') {
    const symbol = normalizeTicker(ticker);
    const investorType = String(investor || '').toUpperCase();
    if (!symbol || !parseTradingDate(date) || !['ALL', 'LOCAL', 'FOREIGN'].includes(investorType)) {
        throw new GoApiError('Invalid broker-summary query');
    }
    const body = await requestJson(`/stock/idx/${encodeURIComponent(symbol)}/broker_summary`, { date, investor: investorType });
    return rowsFrom(body, ['results']);
}

function analyzeBrokerSummary(rows) {
    if (!Array.isArray(rows) || rows.length === 0) return null;
    const buyers = [];
    const sellers = [];
    for (const row of rows) {
        if (!row || typeof row !== 'object' || String(row.transaction_type || '').toUpperCase() !== 'NET') continue;
        const broker = String(row.code || row.broker?.code || '').trim().toUpperCase();
        const value = Number(row.value);
        const side = String(row.side || '').trim().toUpperCase();
        if (!broker || !Number.isFinite(value) || value <= 0) continue;
        const entry = { broker, value, lot: Number(row.lot), averagePrice: Number(row.avg) };
        if (side === 'BUY') buyers.push(entry);
        else if (side === 'SELL') sellers.push(entry);
    }
    buyers.sort((a, b) => b.value - a.value);
    sellers.sort((a, b) => b.value - a.value);
    if (!buyers.length || !sellers.length) return null;

    const topBuyers = buyers.slice(0, 3);
    const topSellers = sellers.slice(0, 3);
    const topThreeBuyValue = topBuyers.reduce((sum, row) => sum + row.value, 0);
    const topThreeSellValue = topSellers.reduce((sum, row) => sum + row.value, 0);
    const concentrationRatio = topSellers.length ? topBuyers[0].value / topThreeSellValue : 0;
    const buyToSellRatio = topThreeSellValue > 0 ? topThreeBuyValue / topThreeSellValue : 0;
    const bigDistribution = topSellers[0].value > topThreeBuyValue * 1.5;
    const status = bigDistribution
        ? 'BIG DISTRIBUTION'
        : concentrationRatio > 0.5 || buyToSellRatio >= 1.2
        ? 'BIG ACCUMULATION'
        : topThreeBuyValue > topThreeSellValue
            ? 'NORMAL ACCUMULATION'
            : topThreeSellValue > topThreeBuyValue
                ? 'NORMAL DISTRIBUTION'
                : 'NEUTRAL';

    return {
        dataSource: 'GOAPI',
        status,
        analysis: { key: status.replace(/\s+/g, '_'), label: status },
        topBuyers,
        topSellers,
        topThreeBuyValue,
        topThreeSellValue,
        concentrationRatio,
        buyToSellRatio
    };
}

module.exports = {
    GOAPI_BASE_URL,
    GOAPI_CAPABILITIES,
    GoApiError,
    fetchStockPrices,
    fetchHistorical,
    fetchBrokerSummary,
    analyzeBrokerSummary,
    normalizeStockRow,
    _clearCacheForTests() {
        responseCache.clear();
        pendingRequests.clear();
    }
};
