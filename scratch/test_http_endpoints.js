// Live HTTP Endpoint Test Script
const BASE_URL = 'http://localhost:3000';

async function testHttp() {
    console.log('Testing live HTTP server at', BASE_URL);

    const endpoints = [
        { path: '/', expect: 'text/html' },
        { path: '/api/health', check: data => data.status === 'OK' && data.uptime >= 0 },
        { path: '/api/search-suggest?q=BBCA', check: data => data.suggestions?.length > 0 },
        { path: '/api/search-suggest?q=$BBCA', check: data => data.suggestions?.[0]?.ticker === 'BBCA' },
        { path: '/api/search-suggest?q=IHSG', check: data => data.suggestions?.[0]?.ticker === 'IHSG' },
        { path: '/api/analyze/BBCA', check: data => data.ticker === 'BBCA' && data.realtime?.lastPrice > 0 },
        { path: '/api/analyze/$BBCA', check: data => data.ticker === 'BBCA' },
        { path: '/api/analyze/IHSG', check: data => data.ticker === 'IHSG' && data.realtime?.lastPrice > 0 },
        { path: '/api/corporate-news/BBRI', check: data => data.ticker === 'BBRI' && Array.isArray(data.news) },
        { path: '/api/market-news', check: data => Array.isArray(data.news) && data.news.length > 0 && data.news[0].link.startsWith('http') },
        { path: '/api/deals', check: data => Array.isArray(data.deals) && data.deals.length > 0 && data.deals[0].link.startsWith('http') },
        { path: '/api/market-indices', check: data => data.ihsg?.price > 0 && data.usdidr?.price > 0 },
        { path: '/api/screener', check: data => Array.isArray(data.scalping) && data.daytrade?.length > 0 && data.swing?.length > 0 && data.bsjp?.length > 0 && data.bpjp?.length > 0 && data.longterm?.length > 0 }
    ];

    let passed = 0;
    let failed = 0;

    for (const ep of endpoints) {
        const start = Date.now();
        try {
            const res = await fetch(BASE_URL + ep.path);
            const duration = Date.now() - start;

            if (ep.expect === 'text/html') {
                const text = await res.text();
                const ok = res.ok && text.includes('STOCKRADAR');
                if (ok) {
                    console.log(`✅ [${res.status}] ${ep.path} (${duration}ms) - HTML Loaded`);
                    passed++;
                } else {
                    console.error(`❌ [${res.status}] ${ep.path} - Failed HTML validation`);
                    failed++;
                }
            } else {
                const json = await res.json();
                const ok = res.ok && (!ep.check || ep.check(json));
                if (ok) {
                    console.log(`✅ [${res.status}] ${ep.path} (${duration}ms) - Valid JSON`);
                    passed++;
                } else {
                    console.error(`❌ [${res.status}] ${ep.path} - Failed JSON validation:`, json);
                    failed++;
                }
            }
        } catch (err) {
            console.error(`❌ Failed connecting to ${ep.path}:`, err.message);
            failed++;
        }
    }

    console.log(`\nHTTP Summary: ${passed} passed, ${failed} failed`);
    if (failed > 0) process.exit(1);
}

testHttp();
