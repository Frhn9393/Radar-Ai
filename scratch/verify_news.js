const { fetch_market_news, fetch_ma_deals, fetch_corporate_news } = require('../services/newsService');

async function test() {
    const t0 = Date.now();
    console.log('1. Testing fetch_market_news()...');
    const mNews = await fetch_market_news();
    console.log(`-> Market News: ${mNews.count || (mNews.news && mNews.news.length)} items in ${Date.now() - t0}ms`);
    if (mNews.news && mNews.news.length > 0) {
        console.log(`   Sample: "${mNews.news[0].title}"`);
        console.log(`   Link: ${mNews.news[0].link}`);
    }

    const t1 = Date.now();
    console.log('\n2. Testing fetch_ma_deals()...');
    const deals = await fetch_ma_deals();
    console.log(`-> M&A Deals: ${deals.count || (deals.deals && deals.deals.length)} items in ${Date.now() - t1}ms`);
    if (deals.deals && deals.deals.length > 0) {
        console.log(`   Sample: [${deals.deals[0].tickers.join(',')}] "${deals.deals[0].title}"`);
        console.log(`   Link: ${deals.deals[0].link}`);
    }

    const t2 = Date.now();
    console.log('\n3. Testing fetch_corporate_news("BBRI")...');
    const corp = await fetch_corporate_news('BBRI');
    console.log(`-> BBRI Corporate News: ${corp.length} items in ${Date.now() - t2}ms`);
    if (corp.length > 0) {
        console.log(`   Sample: "${corp[0].title}"`);
        console.log(`   Link: ${corp[0].link}`);
    }
}

test().catch(err => console.error('Test failed:', err));
