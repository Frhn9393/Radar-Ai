const Parser = require('rss-parser');
const parser = new Parser();

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

async function run() {
    const directUrls = [
        'https://www.cnbcindonesia.com/market/rss',
        'https://finance.detik.com/bursa-dan-valas/rss',
        'https://rss.tempo.co/bisnis',
        'https://www.antaranews.com/rss/ekonomi-finansial.xml',
        'https://republika.co.id/rss/ekonomi',
        'https://news.google.com/rss/search?q=IHSG+saham+hari+ini&hl=id&gl=ID&ceid=ID:id'
    ];
    const t0 = Date.now();
    const allResults = await Promise.all(directUrls.map(fetchFeed));
    const count = allResults.reduce((sum, arr) => sum + arr.length, 0);
    console.log(`Fetched ${count} total articles across ${directUrls.length} sources in ${Date.now() - t0}ms`);
    if (allResults[0].length > 0) {
        console.log('Sample CNBC Article:', allResults[0][0].title);
        console.log('Sample CNBC Link:', allResults[0][0].link);
    }
}
run();
