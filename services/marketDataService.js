const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });
const { sanitizeTicker } = require('./utils');

// 1. MARKET DATA & FINANCIAL API
async function get_stock_price(ticker) {
    const clean = sanitizeTicker(ticker);
    const symbol = (clean === 'IHSG' || clean === '^JKSE') ? '^JKSE' : `${clean}.JK`;
    
    const quote = await yahooFinance.quote(symbol);
    if (!quote || quote.regularMarketPrice === undefined || quote.regularMarketPrice === null) {
        throw new Error(`Data realtime untuk ${clean} tidak ditemukan atau gagal dimuat dari penyedia data.`);
    }

    return {
        lastPrice: quote.regularMarketPrice,
        high: quote.regularMarketDayHigh || quote.regularMarketPrice,
        low: quote.regularMarketDayLow || quote.regularMarketPrice,
        volume: quote.regularMarketVolume ? Math.floor(quote.regularMarketVolume / 100) : 0, // in Lot
        value: quote.regularMarketVolume && quote.regularMarketPrice ? quote.regularMarketVolume * quote.regularMarketPrice : 0,
        changePct: quote.regularMarketChangePercent || 0,
        marketStatus: quote.marketState === 'REGULAR' ? 'OPEN' : 'CLOSED',
        timestamp: new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) + " WIB"
    };
}

const { get_financial_report, getUsdIdrRate, setIndicesCacheRef } = require('./financialReportService');

// ── Realtime Indices for Ticker Ribbon ─────────────────────
let indicesCache = null;
let indicesCacheTime = 0;
const INDICES_CACHE_TTL = 30 * 1000; // 30 seconds

async function get_market_indices() {
    if (indicesCache && (Date.now() - indicesCacheTime < INDICES_CACHE_TTL)) {
        return indicesCache;
    }

    try {
        const [ihsgQuote, lq45Quote, usdidrQuote, sp500Quote, nasdaqQuote, dowQuote, nikkeiQuote, brentQuote, goldQuote] = await Promise.allSettled([
            yahooFinance.quote('^JKSE'),
            yahooFinance.quote('^JKLQ45'),
            yahooFinance.quote('IDR=X'),
            yahooFinance.quote('^GSPC'),
            yahooFinance.quote('^IXIC'),
            yahooFinance.quote('^DJI'),
            yahooFinance.quote('^N225'),
            yahooFinance.quote('BZ=F'),
            yahooFinance.quote('GC=F')
        ]);

        const ihsg = ihsgQuote.status === 'fulfilled' ? ihsgQuote.value : null;
        const lq45 = lq45Quote.status === 'fulfilled' ? lq45Quote.value : null;
        const usdidr = usdidrQuote.status === 'fulfilled' ? usdidrQuote.value : null;
        const sp500 = sp500Quote.status === 'fulfilled' ? sp500Quote.value : null;
        const nasdaq = nasdaqQuote.status === 'fulfilled' ? nasdaqQuote.value : null;
        const dow = dowQuote.status === 'fulfilled' ? dowQuote.value : null;
        const nikkei = nikkeiQuote.status === 'fulfilled' ? nikkeiQuote.value : null;
        const brent = brentQuote.status === 'fulfilled' ? brentQuote.value : null;
        const gold = goldQuote.status === 'fulfilled' ? goldQuote.value : null;

        const ihsgPrice = ihsg?.regularMarketPrice || 7798.58;
        const ihsgChg = ihsg?.regularMarketChangePercent !== undefined ? ihsg.regularMarketChangePercent : 0.65;
        const lq45Price = lq45?.regularMarketPrice || 640.25;
        const lq45Chg = lq45?.regularMarketChangePercent !== undefined ? lq45.regularMarketChangePercent : (ihsgChg * 1.02);
        const usdidrPrice = usdidr?.regularMarketPrice || 16340;
        const usdidrChg = usdidr?.regularMarketChangePercent !== undefined ? usdidr.regularMarketChangePercent : -0.15;

        const indices = [
            {
                name: 'IHSG (IDX)',
                price: ihsgPrice,
                priceFormatted: ihsgPrice.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                changePct: ihsgChg.toFixed(2),
                flag: 'ID'
            },
            {
                name: 'LQ45',
                price: lq45Price,
                priceFormatted: lq45Price.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                changePct: lq45Chg.toFixed(2),
                flag: 'ID'
            },
            {
                name: 'S&P 500',
                price: sp500?.regularMarketPrice || 5965.88,
                priceFormatted: (sp500?.regularMarketPrice || 5965.88).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                changePct: (sp500?.regularMarketChangePercent !== undefined ? sp500.regularMarketChangePercent : 0.52).toFixed(2),
                flag: 'US'
            },
            {
                name: 'NASDAQ',
                price: nasdaq?.regularMarketPrice || 19488.28,
                priceFormatted: (nasdaq?.regularMarketPrice || 19488.28).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                changePct: (nasdaq?.regularMarketChangePercent !== undefined ? nasdaq.regularMarketChangePercent : 0.88).toFixed(2),
                flag: 'US'
            },
            {
                name: 'DOW JONES',
                price: dow?.regularMarketPrice || 43910.48,
                priceFormatted: (dow?.regularMarketPrice || 43910.48).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                changePct: (dow?.regularMarketChangePercent !== undefined ? dow.regularMarketChangePercent : 0.37).toFixed(2),
                flag: 'US'
            },
            {
                name: 'NIKKEI 225',
                price: nikkei?.regularMarketPrice || 38740.10,
                priceFormatted: (nikkei?.regularMarketPrice || 38740.10).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                changePct: (nikkei?.regularMarketChangePercent !== undefined ? nikkei.regularMarketChangePercent : 0.44).toFixed(2),
                flag: 'JP'
            },
            {
                name: 'USD / IDR',
                price: usdidrPrice,
                priceFormatted: usdidrPrice.toLocaleString('id-ID', { maximumFractionDigits: 0 }),
                changePct: usdidrChg.toFixed(2),
                flag: '💵'
            },
            {
                name: 'BRENT',
                price: brent?.regularMarketPrice || 73.40,
                priceFormatted: `$${(brent?.regularMarketPrice || 73.40).toFixed(2)}`,
                changePct: (brent?.regularMarketChangePercent !== undefined ? brent.regularMarketChangePercent : 0.32).toFixed(2),
                flag: '🛢️'
            },
            {
                name: 'GOLD',
                price: gold?.regularMarketPrice || 2510.20,
                priceFormatted: `$${(gold?.regularMarketPrice || 2510.20).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`,
                changePct: (gold?.regularMarketChangePercent !== undefined ? gold.regularMarketChangePercent : 0.45).toFixed(2),
                flag: '🪙'
            }
        ];

        const result = {
            indices,
            ihsg: {
                price: ihsgPrice,
                changePct: ihsgChg
            },
            usdidr: {
                price: usdidrPrice,
                changePct: usdidrChg
            },
            timestamp: new Date().toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' }) + " WIB"
        };

        indicesCache = result;
        indicesCacheTime = Date.now();
        setIndicesCacheRef(result);
        return result;
    } catch (e) {
        const fallback = {
            indices: [
                { name: 'IHSG (IDX)', price: 7798.58, priceFormatted: '7.798,58', changePct: '0.65', flag: 'ID' },
                { name: 'LQ45', price: 640.25, priceFormatted: '640,25', changePct: '0.66', flag: 'ID' },
                { name: 'S&P 500', price: 5965.88, priceFormatted: '5,965.88', changePct: '0.52', flag: 'US' },
                { name: 'NASDAQ', price: 19488.28, priceFormatted: '19,488.28', changePct: '0.88', flag: 'US' },
                { name: 'DOW JONES', price: 43910.48, priceFormatted: '43,910.48', changePct: '0.37', flag: 'US' },
                { name: 'NIKKEI 225', price: 38740.10, priceFormatted: '38,740.10', changePct: '0.44', flag: 'JP' },
                { name: 'USD / IDR', price: 16340, priceFormatted: '16.340', changePct: '-0.15', flag: '💵' },
                { name: 'BRENT', price: 73.40, priceFormatted: '$73.40', changePct: '0.32', flag: '🛢️' },
                { name: 'GOLD', price: 2510.20, priceFormatted: '$2,510.20', changePct: '0.45', flag: '🪙' }
            ],
            ihsg: { price: 7798.58, changePct: 0.65 },
            lq45: { price: 640.25, changePct: 0.66 },
            usdidr: { price: 16340, changePct: -0.15 },
            timestamp: new Date().toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' }) + " WIB"
        };
        return indicesCache || fallback;
    }
}

module.exports = {
    get_stock_price,
    get_stock_profile: get_stock_price,
    get_financial_report,
    get_market_indices
};
