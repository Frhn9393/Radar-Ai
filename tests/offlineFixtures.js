const DAY_MS = 24 * 60 * 60 * 1000;

function makeQuotes(symbol, count = 370) {
    const index = symbol.startsWith('^') || symbol === 'IDR=X' || symbol.includes('=F');
    const ticker = symbol.replace(/\.JK$/, '');
    const falling = ['BBRI', 'UNVR', 'ADRO', 'BUMI', 'BRIS', 'EXCL'].includes(ticker);
    const base = symbol === '^JKSE' ? 7800 : symbol === '^JKLQ45' ? 640 : symbol === 'IDR=X' ? 16500 : symbol === 'BZ=F' ? 74 : symbol === 'GC=F' ? 2500 : symbol === '^GSPC' ? 5900 : symbol === '^IXIC' ? 19000 : symbol === '^DJI' ? 43000 : symbol === '^N225' ? 38000 : ticker === 'ITMG' ? 25000 : ticker === 'BBCA' ? 10000 : ticker === 'BIPI' ? 200 : 1500;
    const drift = falling ? -0.00035 : 0.0006;
    const now = new Date();
    const quotes = [];
    for (let i = 0; i < count; i++) {
        const date = new Date(now.getTime() - (count - i) * DAY_MS);
        const trend = Math.exp(drift * i);
        const cycle = 1 + Math.sin(i / 9) * 0.008 + Math.sin(i / 31) * 0.012;
        const close = base * trend * cycle;
        const priorCycle = 1 + Math.sin((i - 1) / 9) * 0.008 + Math.sin((i - 1) / 31) * 0.012;
        const priorClose = i > 0 ? base * Math.exp(drift * (i - 1)) * priorCycle : close;
        const open = i > 0 ? (falling ? close * 1.002 : priorClose * 0.995) : close;
        const range = Math.max(close * 0.012, 1);
        const high = Math.max(open, close) + range;
        const low = Math.min(open, close) - range;
        quotes.push({ date, open, high, low, close, volume: 1_000_000 + (i % 7) * 50_000, adjclose: close });
    }
    return quotes;
}

function makeFeedXml() {
    const stories = [
        'IHSG menguat didukung perdagangan bursa Indonesia',
        'BBRI mencatat perkembangan kinerja emiten terbaru',
        'Emiten umumkan akuisisi strategis perusahaan nasional',
        'Perusahaan menuntaskan merger usaha di Indonesia',
        'Rights issue emiten untuk penguatan modal',
        'Rights issue BBCA memperoleh persetujuan pemegang saham',
        'Akuisisi usaha baru diumumkan perusahaan publik',
        'Pasar saham Indonesia mencermati perdagangan hari ini',
        'BBRI bahas prospek dan kinerja sektor perbankan',
        'Merger perusahaan terbuka masuk tahap penyelesaian'
    ];
    const items = stories.map((title, index) => `<item><title><![CDATA[${title} - Media Uji ${index + 1}]]></title><link>https://example.test/news/${index + 1}</link><pubDate>${new Date(Date.now() - index * 60_000).toUTCString()}</pubDate><description><![CDATA[Ringkasan berita fixture untuk pengujian offline.]]></description></item>`).join('');
    return `<?xml version="1.0"?><rss version="2.0"><channel><title>Offline test fixture</title>${items}</channel></rss>`;
}

function installOfflineFixtures() {
    const YahooFinance = require('yahoo-finance2').default;
    const prototype = YahooFinance.prototype;
    prototype.quote = async function quote(symbol) {
        const ticker = String(symbol).replace(/\.JK$/, '');
        const base = symbol === '^JKSE' ? 7800 : symbol === '^JKLQ45' ? 640 : symbol === 'IDR=X' ? 16500 : symbol === 'BZ=F' ? 74 : symbol === 'GC=F' ? 2500 : symbol === '^GSPC' ? 5900 : symbol === '^IXIC' ? 19000 : symbol === '^DJI' ? 43000 : symbol === '^N225' ? 38000 : ticker === 'ITMG' ? 25000 : ticker === 'BBCA' ? 10000 : ticker === 'BIPI' ? 200 : 1500;
        const change = ['BBRI', 'UNVR', 'ADRO', 'BUMI', 'BRIS', 'EXCL'].includes(ticker) ? -0.7 : 0.8;
        return { symbol, regularMarketPrice: base, regularMarketDayHigh: base * 1.02, regularMarketDayLow: base * 0.98, regularMarketVolume: 5_000_000, regularMarketChangePercent: change, marketState: 'CLOSED', epsTrailingTwelveMonths: ticker === 'BIPI' ? 60 : ticker === 'ITMG' ? 2500 : 500, trailingPE: ticker === 'BIPI' ? 30 : 12, priceToBook: 1.4, bookValue: ticker === 'ITMG' ? 3 : 7000, financialCurrency: ['BIPI', 'ITMG'].includes(ticker) ? 'USD' : 'IDR' };
    };
    prototype.chart = async function chart(symbol) {
        const quotes = makeQuotes(String(symbol));
        return { meta: { symbol, currency: 'IDR', exchangeName: 'JKT' }, quotes };
    };
    prototype.quoteSummary = async function quoteSummary(symbol) {
        const ticker = String(symbol).replace(/\.JK$/, '');
        const isBipi = ticker === 'BIPI';
        const isItmg = ticker === 'ITMG';
        return {
            financialData: { financialCurrency: isBipi || isItmg ? 'USD' : 'IDR', profitMargins: 0.12, grossMargins: 0.35, operatingMargins: 0.18, returnOnEquity: 0.16, returnOnAssets: 0.08, currentRatio: 1.5, quickRatio: 1.1, debtToEquity: 45, totalRevenue: 1_000_000, recommendationKey: 'hold' },
            defaultKeyStatistics: { trailingEps: isBipi ? 60 : isItmg ? 2500 : 500, priceToBook: 1.4, bookValue: isItmg ? 3 : 7000, forwardPE: 12 },
            summaryDetail: { trailingPE: isBipi ? 30 : 12, forwardPE: 12, dividendYield: 0.02, beta: 1.1 },
            incomeStatementHistory: { incomeStatementHistory: [
                { totalRevenue: { raw: isBipi ? 800 : 1000 }, costOfRevenue: { raw: isBipi ? 600 : 600 }, netIncome: { raw: isBipi ? 50 : 200 }, operatingIncome: { raw: isBipi ? 90 : 250 } },
                { totalRevenue: { raw: isBipi ? 1200 : 900 }, costOfRevenue: { raw: isBipi ? 1000 : 550 }, netIncome: { raw: isBipi ? -40 : 180 }, operatingIncome: { raw: isBipi ? -20 : 220 } }
            ] }
        };
    };
    prototype.fundamentalsTimeSeries = async function fundamentalsTimeSeries(symbol) {
        const isBipi = String(symbol).startsWith('BIPI');
        return [
            { date: new Date(Date.now() - 365 * DAY_MS), totalRevenue: isBipi ? 1200 : 900, costOfRevenue: isBipi ? 1000 : 550, netIncome: isBipi ? -40 : 180, operatingIncome: isBipi ? -20 : 220 },
            { date: new Date(Date.now() - 90 * DAY_MS), totalRevenue: isBipi ? 800 : 1000, costOfRevenue: isBipi ? 600 : 600, netIncome: isBipi ? 50 : 200, operatingIncome: isBipi ? 90 : 250 }
        ];
    };

    const rss = makeFeedXml();
    global.fetch = async (input) => {
        const url = String(input);
        if (/^https:\/\/(?:news\.google\.com|www\.cnbcindonesia\.com|finance\.detik\.com|rss\.tempo\.co|www\.antaranews\.com)\//i.test(url)) {
            return { ok: true, status: 200, text: async () => rss };
        }
        throw new Error(`External network is disabled in offline tests: ${new URL(url).host}`);
    };
}

module.exports = { installOfflineFixtures };
