const fs = require('fs');
const text = fs.readFileSync('public/index.html', 'utf8');
console.log('Total characters in index.html:', text.length);
console.log('Includes "deals":', text.includes('deals'));
console.log('Includes "news":', text.toLowerCase().includes('news'));
console.log('Includes "general-news-grid":', text.includes('general-news-grid'));
console.log('Includes "news-category-select":', text.includes('news-category-select'));

const newsIds = text.match(/id=["'][^"']*news[^"']*["']/gi) || [];
console.log('News IDs found:', newsIds);

const allIds = text.match(/id=["'][^"']+["']/gi) || [];
console.log('Total IDs found in index.html:', allIds.length);
