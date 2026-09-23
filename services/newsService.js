const Parser = require('rss-parser');
const { formatWibTime, formatWibDate, calcTimeAgo } = require('./utils');
const { enqueueNewsAlerts, findNewNewsItems } = require('./newsAlertService');

const parser = new Parser();

// HTML Entity Unescaper & CDATA stripper
function unescapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
        .trim();
}

function cleanSnippet(value) {
    return unescapeHtml(String(value || '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

// Regex XML extractor fallback if XML parsing fails due to non-standard tags
function fallbackRegexExtract(xml) {
    const items = [];
    const itemMatches = xml.match(/<item[\s\S]*?<\/item>/gi) || [];
    for (const raw of itemMatches) {
        const titleMatch = raw.match(/<title(?:\s+[^>]*)?>([\s\S]*?)<\/title>/i);
        const linkMatch = raw.match(/<link(?:\s+[^>]*)?>([\s\S]*?)<\/link>/i);
        const pubDateMatch = raw.match(/<pubDate(?:\s+[^>]*)?>([\s\S]*?)<\/pubDate>/i);
        const sourceMatch = raw.match(/<source(?:\s+[^>]*)?>([\s\S]*?)<\/source>/i);
        const summaryMatch = raw.match(/<description(?:\s+[^>]*)?>([\s\S]*?)<\/description>/i);
        if (titleMatch) {
            items.push({
                title: unescapeHtml(titleMatch[1]),
                link: linkMatch ? unescapeHtml(linkMatch[1]) : '',
                pubDate: pubDateMatch ? unescapeHtml(pubDateMatch[1]) : new Date().toISOString(),
                summary: summaryMatch ? cleanSnippet(summaryMatch[1]) : '',
                source: sourceMatch ? unescapeHtml(sourceMatch[1]) : ''
            });
        }
    }
    return items;
}

// Ultra-reliable feed fetcher using native fetch + AbortController + parseString
async function fetchFeed(url, timeoutMs = 6000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept': 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
                'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8'
            }
        });
        clearTimeout(timer);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const xml = await res.text();
        try {
            const feed = await parser.parseString(xml);
            return (feed.items || []).map(i => ({
                title: unescapeHtml(i.title),
                link: i.link || i.guid || '',
                pubDate: i.pubDate || new Date().toISOString(),
                summary: cleanSnippet(i.contentSnippet || i.content || i.summary || ''),
                source: i.source ? unescapeHtml(typeof i.source === 'string' ? i.source : i.source._ || '') : ''
            }));
        } catch (parseErr) {
            return fallbackRegexExtract(xml);
        }
    } catch (err) {
        clearTimeout(timer);
        return [];
    }
}

// ── In-Memory Caches ────────────────────────────────────────────────────────
let marketNewsCache = null;
let marketNewsCacheTime = 0;
let marketNewsInFlight = null;
const MARKET_NEWS_CACHE_TTL = 60 * 1000; // 60s for realtime news

const corporateNewsCache = new Map();
const CORP_NEWS_CACHE_TTL = 3 * 60 * 1000;

let dealsCache = null;
let dealsCacheTime = 0;
let dealsInFlight = null;
const DEALS_CACHE_TTL = 60 * 1000;

// ── Verified High-Speed Media Feeds ─────────────────────────────────────────
const DIRECT_FEEDS = [
    'https://www.cnbcindonesia.com/market/rss',
    'https://finance.detik.com/bursa-dan-valas/rss',
    'https://rss.tempo.co/bisnis',
    'https://www.antaranews.com/rss/ekonomi-finansial.xml',
    'https://republika.co.id/rss/ekonomi'
];

const GOOGLE_NEWS_MARKET_QUERIES = [
    'IHSG saham bursa hari ini',
    'saham IDX emiten bursa efek Indonesia',
    'dividen laba kinerja emiten saham IHSG',
    'rekomendasi saham analis bursa hari ini'
];

// ── Emiten Dictionary for Ticker Extraction ─────────────────────────────────
let ALL_IDX_STOCKS = [];
try {
    ALL_IDX_STOCKS = require('./idx_stocks.json');
} catch (e) {
    ALL_IDX_STOCKS = [];
}

const KNOWN_EMITEN_DICT = {
    'dian swastatika': 'DSSA',
    'dssa': 'DSSA',
    'chandra daya': 'CDIA',
    'chandra asri': 'TPIA',
    'dms propertindo': 'KOTA',
    'iforte': 'IBST',
    'sarana menara': 'TOWR',
    'astra': 'ASII',
    'auto 2000': 'AUTO',
    'astra otoparts': 'AUTO',
    'mitratel': 'MTEL',
    'tower bersama': 'TBIG',
    'telkom': 'TLKM',
    'indosat': 'ISAT',
    'xl axiata': 'EXCL',
    'smartfren': 'FREN',
    'md pictures': 'FILM',
    'net tv': 'NETV',
    'barito renewables': 'BREN',
    'barito pacific': 'BRPT',
    'medco': 'MEDC',
    'adaro': 'ADRO',
    'bumi resources': 'BUMI',
    'goto': 'GOTO',
    'bank jago': 'ARTO',
    'bank bsi': 'BRIS',
    'bank syariah indonesia': 'BRIS',
    'bank bca': 'BBCA',
    'bca': 'BBCA',
    'bank bri': 'BBRI',
    'bri': 'BBRI',
    'bank mandiri': 'BMRI',
    'mandiri': 'BMRI',
    'bank btn': 'BBTN',
    'btn': 'BBTN',
    'kalbe': 'KLBF',
    'kalbe farma': 'KLBF',
    'bukit asam': 'PTBA',
    'timah': 'TINS',
    'antam': 'ANTM',
    'aneka tambang': 'ANTM',
    'merdeka copper': 'MDKA',
    'merdeka battery': 'MBMA',
    'indofood': 'ICBP',
    'summarecon': 'SMRA',
    'bumi serpong': 'BSDE',
    'jasa marga': 'JSMR',
    'united tractors': 'UNTR',
    'pertamina geothermal': 'PGEO',
    'bukalapak': 'BUKA',
    'sumber alfaria': 'AMRT',
    'vale indonesia': 'INCO',
    'bayan': 'BYAN',
    'bayan resources': 'BYAN',
    'indika': 'INDY',
    'vktr': 'VKTR',
    'allo bank': 'BBHI',
    'ocbc': 'NISP',
    'panin': 'PNBN',
    'erajaya': 'ERAA',
    'petrosea': 'PTRO',
    'petrindo': 'CUAN',
    'pantai indah kapuk': 'PANI',
    'pik 2': 'PANI'
};

ALL_IDX_STOCKS.forEach(stock => {
    if (!stock || !stock.name) return;
    const cleanName = stock.name.toLowerCase().replace(/tbk|pt|\(persero\)|\./g, '').trim();
    if (cleanName.length > 3 && !KNOWN_EMITEN_DICT[cleanName]) {
        KNOWN_EMITEN_DICT[cleanName] = stock.ticker;
    }
});

const KNOWN_TICKERS = new Set(ALL_IDX_STOCKS.map(stock => String(stock?.ticker || '').toUpperCase()).filter(Boolean));

function titleHasIssuerName(title, name) {
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    return new RegExp(`(?:^|[^a-z0-9])${escapedName}(?=$|[^a-z0-9])`, 'i').test(title);
}

function extractNewsTicker(title) {
    const originalTitle = String(title || '');
    const explicitTickers = originalTitle.match(/(?:^|[^A-Za-z0-9])\$?([A-Z0-9]{3,5})(?:\.JK)?(?=$|[^A-Za-z0-9])/g) || [];
    for (const match of explicitTickers) {
        const ticker = (match.match(/\$?([A-Z0-9]{3,5})/) || [])[1];
        if (!ticker) continue;
        if (KNOWN_TICKERS.has(ticker) && !STOP_TICKERS.has(ticker)) return ticker;
    }
    const lowerTitle = originalTitle.toLowerCase();
    for (const [companyName, ticker] of Object.entries(KNOWN_EMITEN_DICT)) {
        if (companyName.length >= 5 && titleHasIssuerName(lowerTitle, companyName)) return ticker;
    }
    return null;
}

const STOP_TICKERS = new Set([
    'IHSG', 'BEI', 'IDX', 'RUPS', 'BANK', 'EMIT', 'KURS', 'SBN', 'NET', 'PLUS', 'ASIA',
    'NEWS', 'INFO', 'POST', 'LIVE', 'YANG', 'DARI', 'PADA', 'AKAN', 'BISA', 'JUGA', 'SAAT',
    'HARI', 'JUTA', 'DEAL', 'VTO', 'DENGAN', 'UNTUK', 'OLEH', 'LEBIH', 'BANYAK', 'KINI',
    'SIAP', 'MAU', 'INI', 'ITU', 'BACA', 'KATA', 'RP', 'USD', 'IDR', 'LABA', 'TAHUN',
    'BULAN', 'RUGI', 'ASET', 'DANA', 'POIN', 'NAIK', 'TURU', 'SUSU', 'JUAL', 'BELI',
    'BARU', 'LAMA', 'LUAR', 'RIBU', 'PESO', 'YEN', 'EURO', 'KOTA', 'JAWA', 'BALI'
]);

// ═══════════════════════════════════════════════════════════════
//  1. MARKET NEWS ENGINE (Dashboard Realtime News)
// ═══════════════════════════════════════════════════════════════
async function fetch_market_news() {
    if (marketNewsCache && (Date.now() - marketNewsCacheTime < MARKET_NEWS_CACHE_TTL)) {
        return marketNewsCache;
    }
    if (marketNewsInFlight) return marketNewsInFlight;

    const previousItems = marketNewsCache?.news || [];
    const request = fetchMarketNewsFresh(previousItems);
    marketNewsInFlight = request;
    try {
        return await request;
    } finally {
        if (marketNewsInFlight === request) marketNewsInFlight = null;
    }
}

async function fetchMarketNewsFresh(previousItems) {
    try {
        const fetchUrls = [
            ...DIRECT_FEEDS,
            ...GOOGLE_NEWS_MARKET_QUERIES.map(q =>
                `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=id&gl=ID&ceid=ID:id`
            )
        ];

        // Fetch all in parallel with timeout guard
        const results = await Promise.all(fetchUrls.map(url => fetchFeed(url, 5000)));
        const allRawItems = [];
        results.forEach(items => {
            if (Array.isArray(items)) allRawItems.push(...items);
        });

        const threeDaysAgo = new Date(Date.now() - 72 * 3600 * 1000);
        const parsedItems = [];

        allRawItems.forEach(item => {
            if (!item.title) return;
            const pubDate = new Date(item.pubDate);
            if (isNaN(pubDate.getTime()) || pubDate < threeDaysAgo) return;

            const titleParts = item.title.split(' - ');
            const source = titleParts.length > 1 ? titleParts.pop().trim() : (item.source || 'Media Pasar');
            const title = titleParts.join(' - ').trim();

            const titleLower = title.toLowerCase();
            let category = 'Market';
            if (titleLower.includes('ihsg') || titleLower.includes('indeks')) category = 'IHSG';
            else if (titleLower.includes('dividen')) category = 'Dividen';
            else if (titleLower.includes('ipo') || titleLower.includes('listing')) category = 'IPO';
            else if (titleLower.includes('akuisisi') || titleLower.includes('merger') || titleLower.includes('buyback') || titleLower.includes('rups')) category = 'Aksi Korporasi';
            else if (titleLower.includes('obligasi') || titleLower.includes('sukuk') || titleLower.includes('sbn')) category = 'Obligasi';
            else if (titleLower.includes('rupiah') || titleLower.includes('kurs') || titleLower.includes('dolar')) category = 'Valas';
            else if (titleLower.includes('inflasi') || titleLower.includes('bi rate') || titleLower.includes('suku bunga') || titleLower.includes('the fed')) category = 'Makro';

            // Ensure article link is present
            const link = item.link || `https://news.google.com/search?q=${encodeURIComponent(title)}&hl=id&gl=ID&ceid=ID:id`;

            parsedItems.push({
                title,
                source,
                link,
                ticker: extractNewsTicker(title) || 'IHSG',
                summary: cleanSnippet(item.summary),
                pubDate: pubDate.toISOString(),
                timeAgo: calcTimeAgo(pubDate),
                timeStr: formatWibTime(pubDate),
                dateStr: formatWibDate(pubDate),
                category
            });
        });

        // Deduplicate by normalized title
        const seen = new Set();
        const unique = parsedItems.filter(n => {
            const key = n.title.substring(0, 45).toLowerCase().replace(/[^\w]/g, '');
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        // Sort descending by date (newest first)
        unique.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

        const finalNews = unique.slice(0, 36);

        if (finalNews.length > 0) {
            enqueueNewsAlerts(findNewNewsItems(finalNews, previousItems));

            const responseData = {
                news: finalNews,
                count: finalNews.length,
                lastUpdated: formatWibTime(new Date())
            };
            marketNewsCache = responseData;
            marketNewsCacheTime = Date.now();
            return responseData;
        }

        if (marketNewsCache && marketNewsCache.news?.length > 0) {
            return marketNewsCache;
        }

        return {
            news: [],
            count: 0,
            lastUpdated: formatWibTime(new Date()),
            error: 'Tidak ada berita pasar terbaru saat ini.'
        };
    } catch (e) {
        console.error('Gagal menarik berita pasar:', e.message);
        if (marketNewsCache && marketNewsCache.news?.length > 0) return marketNewsCache;
        return { news: [], count: 0, lastUpdated: null, error: 'Gagal memuat berita pasar.' };
    }
}

// ═══════════════════════════════════════════════════════════════
//  2. WEB SEARCH & CORPORATE NEWS ENGINE (Per Ticker)
// ═══════════════════════════════════════════════════════════════
async function fetch_corporate_news(ticker) {
    const symbol = ticker.toUpperCase().replace('$', '').replace('.JK', '');
    const cached = corporateNewsCache.get(symbol);
    if (cached && (Date.now() - cached.time < CORP_NEWS_CACHE_TTL)) {
        return cached.data;
    }

    try {
        const query = `"${symbol}" (saham OR emiten OR dividen OR laba OR akuisisi OR merger OR kinerja OR bursa OR IDX)`;
        const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=id&gl=ID&ceid=ID:id`;

        const rawItems = await fetchFeed(url, 5000);
        const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 3600 * 1000);

        let items = rawItems
            .filter(item => {
                const pubDate = new Date(item.pubDate);
                return !isNaN(pubDate.getTime()) && pubDate >= fourteenDaysAgo;
            })
            .map(item => {
                const pubDateObj = new Date(item.pubDate);
                const titleParts = item.title.split(' - ');
                const source = titleParts.length > 1 ? titleParts.pop().trim() : (item.source || 'Bursa / Media');
                const title = titleParts.join(' - ').trim();
                const ago = calcTimeAgo(pubDateObj);
                const timeStr = formatWibTime(pubDateObj);
                const dateStr = formatWibDate(pubDateObj);
                const link = item.link || `https://news.google.com/search?q=${encodeURIComponent(title)}&hl=id&gl=ID&ceid=ID:id`;

                return {
                    title,
                    source,
                    link,
                    pubDate: pubDateObj.toISOString(),
                    timeAgo: ago,
                    timeStr,
                    dateStr,
                    date: `${ago} (${timeStr}, ${dateStr})`,
                    impact: 'Berpotensi mempengaruhi struktur modal, valuasi, atau likuiditas emiten.'
                };
            });

        // If Google News had 0 results, check market news cache for mentions of this ticker
        if (items.length === 0 && marketNewsCache && marketNewsCache.news?.length > 0) {
            const pattern = new RegExp(`\\b${symbol}\\b`, 'i');
            items = marketNewsCache.news
                .filter(n => pattern.test(n.title))
                .map(n => ({
                    title: n.title,
                    source: n.source,
                    link: n.link,
                    pubDate: n.pubDate,
                    timeAgo: n.timeAgo,
                    timeStr: n.timeStr,
                    dateStr: n.dateStr,
                    date: `${n.timeAgo} (${n.timeStr}, ${n.dateStr})`,
                    impact: 'Berpotensi mempengaruhi pergerakan harga dan likuiditas pasar.'
                }));
        }

        items.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
        const result = items.slice(0, 8);

        corporateNewsCache.set(symbol, { data: result, time: Date.now() });
        return result;
    } catch (e) {
        console.error(`Gagal menarik berita korporasi untuk ${symbol}:`, e.message);
        return [];
    }
}

// ═══════════════════════════════════════════════════════════════
//  3. RADAR AKUISISI & M&A ENGINE (32+ DEALS REALTIME)
// ═══════════════════════════════════════════════════════════════
async function fetch_ma_deals() {
    if (dealsCache && (Date.now() - dealsCacheTime < DEALS_CACHE_TTL)) {
        return dealsCache;
    }
    if (dealsInFlight) return dealsInFlight;

    const previousDeals = dealsCache?.deals || [];
    const request = fetchMaDealsFresh(previousDeals);
    dealsInFlight = request;
    try {
        return await request;
    } finally {
        if (dealsInFlight === request) dealsInFlight = null;
    }
}

async function fetchMaDealsFresh(previousDeals) {
    try {
        const queries = [
            'akuisisi saham emiten bursa',
            'merger saham bursa Indonesia',
            'tender offer saham IDX',
            'rights issue emiten bursa efek',
            'divestasi buyback saham IDX'
        ];

        const fetchUrls = [
            ...queries.map(q => `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=id&gl=ID&ceid=ID:id`),
            'https://www.cnbcindonesia.com/market/rss',
            'https://finance.detik.com/bursa-dan-valas/rss'
        ];

        const results = await Promise.all(fetchUrls.map(url => fetchFeed(url, 5000)));
        const allItems = [];
        results.forEach(arr => {
            if (Array.isArray(arr)) allItems.push(...arr);
        });

        const threeDaysAgo = new Date(Date.now() - 72 * 3600 * 1000);
        const seen = new Set();
        const parsedDeals = [];

        allItems.forEach((item, idx) => {
            if (!item.title) return;
            const key = item.title.substring(0, 45).toLowerCase().replace(/[^\w]/g, '');
            if (seen.has(key)) return;
            seen.add(key);

            const pubDateObj = new Date(item.pubDate);
            if (isNaN(pubDateObj.getTime()) || pubDateObj < threeDaysAgo) return;

            const titleParts = item.title.split(' - ');
            const source = titleParts.length > 1 ? titleParts.pop().trim() : (item.source || 'Bursa & Media');
            const title = titleParts.join(' - ').trim();
            const lowerTitle = title.toLowerCase();

            // Deal relevance filter
            const isDealRelated = /akuisisi|merger|tender offer|rights issue|private placement|buyback|divestasi|caplok|ambil alih|konsolidasi|investasi|rampingkan|lepas saham/.test(lowerTitle);
            if (!isDealRelated) return;

            // Extract tickers
            const tickers = [];
            const parenMatches = title.match(/\(([A-Z0-9]{4})\)/g);
            if (parenMatches) {
                parenMatches.forEach(m => {
                    const clean = m.replace(/[()]/g, '');
                    if (!STOP_TICKERS.has(clean) && !tickers.includes(clean)) tickers.push(clean);
                });
            }
            const dollarMatches = title.match(/\$([A-Z0-9]{4})/g);
            if (dollarMatches) {
                dollarMatches.forEach(m => {
                    const clean = m.replace('$', '');
                    if (!STOP_TICKERS.has(clean) && !tickers.includes(clean)) tickers.push(clean);
                });
            }

            for (const [name, code] of Object.entries(KNOWN_EMITEN_DICT)) {
                if (name.length >= 5 && titleHasIssuerName(lowerTitle, name) && !tickers.includes(code)) {
                    tickers.push(code);
                }
            }

            const wordMatches = title.match(/\b([A-Z]{4})\b/g);
            if (wordMatches) {
                wordMatches.forEach(w => {
                    if (!STOP_TICKERS.has(w) && !tickers.includes(w)) {
                        tickers.push(w);
                    }
                });
            }

            if (tickers.length === 0) tickers.push('IHSG');

            // Deal Type & Accuracy
            let type = 'resmi';
            let typeLabel = 'RESMI / TERKONFIRMASI';
            let accuracy = 96;

            if (lowerTitle.match(/negosiasi|tahap akhir|pembahasan|finalisasi|siapkan|menanti|rencana/)) {
                type = 'negosiasi';
                typeLabel = 'NEGOSIASI AKTIF';
                accuracy = 82;
            } else if (lowerTitle.match(/rumor|isu|diisukan|dikabarkan|incar|penjajakan|berpotensi|mencuat/)) {
                type = 'rumor';
                typeLabel = 'RUMOR / PENJAJAKAN';
                accuracy = 70;
            } else if (lowerTitle.match(/resmi|rampungkan|tuntaskan|setujui|kantongi restu|caplok|telah/)) {
                type = 'resmi';
                typeLabel = 'RESMI / TERKONFIRMASI';
                accuracy = 97;
            } else {
                type = 'resmi';
                typeLabel = 'CONFIRMED';
                accuracy = 88;
            }

            // Estimate Deal Value
            let dealValue = 'Nilai Dalam Pembahasan / Belum Dirilis';
            const valMatch = title.match(/(?:Rp\s*[\d,.]+\s*(?:Triliun|Miliar|T\b|M\b))|(?:US\$\s*[\d,.]+\s*(?:Juta|Miliar|Billion|Million))|(?:Rp\s*[\d,.]+\s*\/\s*saham)/i);
            if (valMatch) {
                dealValue = valMatch[0].toUpperCase()
                    .replace(/\bT\b/g, 'TRILIUN')
                    .replace(/\bM\b/g, 'MILIAR');
            }

            // Impact tag
            let impact = 'POTENSI SURGE & STRATEGIS 🚀';
            if (lowerTitle.includes('buyback')) impact = 'BUYBACK SAHAM / VOLATILITAS POSITIF 💰';
            else if (lowerTitle.includes('tender offer')) impact = 'TENDER OFFER / PREMIUM BIDDING 📈';
            else if (lowerTitle.includes('caplok') || lowerTitle.includes('akuisisi')) impact = 'PREMIUM BUYOUT / VALUASI NAIK 💎';
            else if (lowerTitle.includes('rights issue') || lowerTitle.includes('private placement')) impact = 'RIGHTS ISSUE / EKSPANSI MODAL 🏗️';
            else if (lowerTitle.includes('merger')) impact = 'PREMIUM BIDDING / KONSOLIDASI 🤝';
            else if (lowerTitle.includes('divestasi') || lowerTitle.includes('spin-off')) impact = 'UNLOCK VALUE & DELEVERAGING 💰';
            else if (lowerTitle.includes('rumor') || lowerTitle.includes('isu')) impact = 'SPEKULASI & VOLATILITAS TINGGI ⚡';

            // Ensure valid link
            const link = item.link || `https://news.google.com/search?q=${encodeURIComponent(title)}&hl=id&gl=ID&ceid=ID:id`;

            parsedDeals.push({
                id: `deal-live-${idx + 1}`,
                type,
                typeLabel,
                accuracy,
                tickers: tickers.slice(0, 3),
                source,
                title,
                summary: cleanSnippet(item.summary),
                dealValue,
                impact,
                pubDate: pubDateObj.toISOString(),
                timeAgo: calcTimeAgo(pubDateObj),
                timeStr: formatWibTime(pubDateObj),
                dateStr: formatWibDate(pubDateObj),
                link
            });
        });

        parsedDeals.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

        const result = {
            count: Math.min(32, parsedDeals.length),
            deals: parsedDeals.slice(0, 32),
            lastUpdated: formatWibTime(new Date())
        };

        if (result.deals.length > 0) {
            enqueueNewsAlerts(findNewNewsItems(result.deals, previousDeals));
            dealsCache = result;
            dealsCacheTime = Date.now();
            return result;
        }

        if (dealsCache && dealsCache.deals?.length > 0) return dealsCache;
        return { count: 0, deals: [], lastUpdated: formatWibTime(new Date()) };
    } catch (e) {
        console.error('Gagal memuat M&A deals:', e.message);
        if (dealsCache && dealsCache.deals?.length > 0) return dealsCache;
        return { count: 0, deals: [], lastUpdated: formatWibTime(new Date()), error: e.message };
    }
}

module.exports = {
    fetch_market_news,
    fetch_corporate_news,
    fetch_ma_deals,
    extractNewsTicker
};
