const Parser = require('rss-parser');
const parser = new Parser();
const { formatWibTime, formatWibDate, calcTimeAgo } = require('../services/utils');

function unescapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1');
}

function fallbackRegexExtract(xml) {
    const items = [];
    const itemMatches = xml.match(/<item[\s\S]*?<\/item>/gi) || [];
    for (const raw of itemMatches) {
        const titleMatch = raw.match(/<title(?:\s+[^>]*)?>([\s\S]*?)<\/title>/i);
        const linkMatch = raw.match(/<link(?:\s+[^>]*)?>([\s\S]*?)<\/link>/i);
        const pubDateMatch = raw.match(/<pubDate(?:\s+[^>]*)?>([\s\S]*?)<\/pubDate>/i);
        const sourceMatch = raw.match(/<source(?:\s+[^>]*)?>([\s\S]*?)<\/source>/i);
        if (titleMatch) {
            items.push({
                title: unescapeHtml(titleMatch[1].trim()),
                link: linkMatch ? unescapeHtml(linkMatch[1].trim()) : '',
                pubDate: pubDateMatch ? unescapeHtml(pubDateMatch[1].trim()) : new Date().toISOString(),
                source: sourceMatch ? unescapeHtml(sourceMatch[1].trim()) : ''
            });
        }
    }
    return items;
}

async function fetchFeed(url) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    try {
        const res = await fetch(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
            }
        });
        clearTimeout(timeoutId);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const xml = await res.text();
        try {
            const feed = await parser.parseString(xml);
            return (feed.items || []).map(i => ({
                title: unescapeHtml(i.title),
                link: i.link || i.guid || '',
                pubDate: i.pubDate || new Date().toISOString(),
                source: i.source || ''
            }));
        } catch (parseErr) {
            return fallbackRegexExtract(xml);
        }
    } catch (err) {
        clearTimeout(timeoutId);
        return [];
    }
}

let ALL_IDX_STOCKS = [];
try {
    ALL_IDX_STOCKS = require('../services/idx_stocks.json');
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

const STOP_TICKERS = new Set([
    'IHSG', 'BEI', 'IDX', 'RUPS', 'BANK', 'EMIT', 'KURS', 'SBN', 'NET', 'PLUS', 'ASIA',
    'NEWS', 'INFO', 'POST', 'LIVE', 'YANG', 'DARI', 'PADA', 'AKAN', 'BISA', 'JUGA', 'SAAT',
    'HARI', 'JUTA', 'DEAL', 'VTO', 'DENGAN', 'UNTUK', 'OLEH', 'LEBIH', 'BANYAK', 'KINI',
    'SIAP', 'MAU', 'INI', 'ITU', 'BACA', 'KATA', 'RP', 'USD', 'IDR', 'LABA', 'TAHUN',
    'BULAN', 'RUGI', 'ASET', 'DANA', 'POIN', 'NAIK', 'TURU', 'SUSU', 'JUAL', 'BELI',
    'BARU', 'LAMA', 'LUAR', 'RIBU', 'PESO', 'YEN', 'EURO', 'KOTA', 'JAWA', 'BALI'
]);

async function testDealsEngine() {
    const queries = [
        'akuisisi saham emiten bursa',
        'merger saham bursa Indonesia',
        'tender offer saham IDX',
        'rights issue emiten bursa efek',
        'divestasi buyback saham IDX'
    ];
    const urls = queries.map(q => `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=id&gl=ID&ceid=ID:id`);
    
    // Also include direct feeds
    urls.push('https://www.cnbcindonesia.com/market/rss');
    urls.push('https://finance.detik.com/bursa-dan-valas/rss');

    const results = await Promise.all(urls.map(fetchFeed));
    const allItems = [];
    results.forEach(arr => allItems.push(...arr));

    const seen = new Set();
    const parsedDeals = [];

    allItems.forEach((item, idx) => {
        if (!item.title) return;
        const key = item.title.substring(0, 45).toLowerCase().replace(/[^\w]/g, '');
        if (seen.has(key)) return;
        seen.add(key);

        const pubDateObj = new Date(item.pubDate);
        const titleParts = item.title.split(' - ');
        const source = titleParts.length > 1 ? titleParts.pop().trim() : (item.source || 'Bursa & Media');
        const title = titleParts.join(' - ').trim();
        const lowerTitle = title.toLowerCase();

        // Check if related to M&A / deals
        const isDealRelated = /akuisisi|merger|tender offer|rights issue|private placement|buyback|divestasi|caplok|ambil alih|konsolidasi|investasi/.test(lowerTitle);
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
        for (const [name, code] of Object.entries(KNOWN_EMITEN_DICT)) {
            if (lowerTitle.includes(name) && !tickers.includes(code)) {
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
        }

        let dealValue = 'Nilai Dalam Pembahasan / Belum Dirilis';
        const valMatch = title.match(/(?:Rp\s*[\d,.]+\s*(?:Triliun|Miliar|T\b|M\b))|(?:US\$\s*[\d,.]+\s*(?:Juta|Miliar|Billion|Million))|(?:Rp\s*[\d,.]+\s*\/\s*saham)/i);
        if (valMatch) {
            dealValue = valMatch[0].toUpperCase().replace(/\bT\b/g, 'TRILIUN').replace(/\bM\b/g, 'MILIAR');
        }

        let impact = 'POTENSI SURGE & STRATEGIS 🚀';
        if (lowerTitle.includes('buyback')) impact = 'BUYBACK SAHAM / VOLATILITAS POSITIF 💰';
        else if (lowerTitle.includes('tender offer')) impact = 'TENDER OFFER / PREMIUM BIDDING 📈';
        else if (lowerTitle.includes('caplok') || lowerTitle.includes('akuisisi')) impact = 'PREMIUM BUYOUT / VALUASI NAIK 💎';
        else if (lowerTitle.includes('rights issue') || lowerTitle.includes('private placement')) impact = 'RIGHTS ISSUE / EKSPANSI MODAL 🏗️';
        else if (lowerTitle.includes('merger')) impact = 'PREMIUM BIDDING / KONSOLIDASI 🤝';

        parsedDeals.push({
            id: `deal-live-${idx + 1}`,
            type,
            typeLabel,
            accuracy,
            tickers: tickers.slice(0, 3),
            source,
            title,
            dealValue,
            impact,
            pubDate: pubDateObj.toISOString(),
            timeAgo: calcTimeAgo(pubDateObj),
            timeStr: formatWibTime(pubDateObj),
            dateStr: formatWibDate(pubDateObj),
            link: item.link
        });
    });

    parsedDeals.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
    console.log(`Detected ${parsedDeals.length} deals!`);
    parsedDeals.slice(0, 5).forEach((d, i) => {
        console.log(`${i+1}. [${d.tickers.join(',')}] ${d.title} | Link: ${d.link ? 'YES' : 'NO'}`);
    });
}

testDealsEngine();
