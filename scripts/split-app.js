const fs = require('fs');
const path = require('path');

const srcPath = path.join(__dirname, '../public/app.js');
const targetDir = path.join(__dirname, '../public/js/modules');

if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
}

const content = fs.readFileSync(srcPath, 'utf8');
const lines = content.split('\n');

const modulesDef = [
    { file: 'state.js', start: 1, end: 156, desc: 'Core state management, DOM element references and currency formatters' },
    { file: 'utils.js', start: 157, end: 198, desc: 'Utility helpers: relative time formatters and audio synthesizer chime' },
    { file: 'navigation.js', start: 199, end: 311, desc: 'Tab navigation and mobile header action handlers' },
    { file: 'deals.js', start: 312, end: 483, desc: 'M&A radar deals rendering, filtering, and card click bindings' },
    { file: 'news.js', start: 484, end: 615, desc: 'Market news feed, corporate ticker, and drawer expandable view' },
    { file: 'analysisModal.js', start: 616, end: 1161, desc: 'Detailed stock analysis modal, technical indicators, and rights issue tebus' },
    { file: 'search.js', start: 1162, end: 1309, desc: 'Autocomplete search engine, keyboard selection, and suggestions popup' },
    { file: 'screener.js', start: 1310, end: 1705, desc: 'Screener candidate tables, session toggles, and sector filtering' },
    { file: 'foreignFlow.js', start: 1706, end: 2154, desc: 'Foreign flow tracking: daily, weekly, monthly, and consecutive streak' },
    { file: 'watchlist.js', start: 2155, end: 2224, desc: 'Watchlist drawer, quick removal, and badge sync' },
    { file: 'indices.js', start: 2225, end: 2254, desc: 'Live market indices ribbon updater' },
    { file: 'controls.js', start: 2255, end: 2407, desc: 'Global app controls: stream polling, sound toggle, refresh, and data export' },
    { file: 'backtest.js', start: 2408, end: 2858, desc: 'Automated quantitative backtest engine UI, equity canvas, and trade log' },
    { file: 'mobileSearch.js', start: 2859, end: 2942, desc: 'Mobile search modal controller and quick chip navigation' },
    { file: 'init.js', start: 2943, end: lines.length, desc: 'Application bootstrap and DOM ready initialization' }
];

modulesDef.forEach(m => {
    const chunkLines = lines.slice(m.start - 1, m.end);
    const chunkContent = `// ============================================================\n` +
        `//  MODULE: ${m.file}\n` +
        `//  ${m.desc}\n` +
        `// ============================================================\n\n` +
        chunkLines.join('\n');
    
    const filePath = path.join(targetDir, m.file);
    fs.writeFileSync(filePath, chunkContent, 'utf8');
    console.log(`Created ${m.file} (${chunkLines.length} lines)`);
});

console.log('All modules created successfully in public/js/modules/');
