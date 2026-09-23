const fs = require('fs');
const path = require('path');

const modulesDir = path.join(__dirname, '../public/js/modules');
const outFile = path.join(__dirname, '../public/app.js');

const moduleOrder = [
    'state.js',
    'utils.js',
    'navigation.js',
    'deals.js',
    'news.js',
    'analysisModal.js',
    'stockChart.js',
    'search.js',
    'screener.js',
    'pdfExport.js',
    'foreignFlow.js',
    'watchlist.js',
    'portfolio.js',
    'broksum.js',
    'indices.js',
    'controls.js',
    'backtest.js',
    'screenerBacktest.js',
    'mobileSearch.js',
    'init.js'
];

let combined = `// ============================================================\n` +
    `//  STOCKRADAR AI — Frontend Core Engine (Modular Bundle)\n` +
    `//  Generated automatically from public/js/modules/\n` +
    `// ============================================================\n\n`;

for (const mod of moduleOrder) {
    const modPath = path.join(modulesDir, mod);
    if (!fs.existsSync(modPath)) {
        console.error(`Missing module: ${mod}`);
        process.exit(1);
    }
    const code = fs.readFileSync(modPath, 'utf8');
    combined += `// --- START MODULE: ${mod} ---\n`;
    combined += code + '\n';
    combined += `// --- END MODULE: ${mod} ---\n\n`;
}

// Window global function bridge to guarantee 100% compatibility with inline onclick and test suites
combined += `\n// ============================================================\n` +
    `//  GLOBAL WINDOW BINDINGS (Compatibility Bridge)\n` +
    `// ============================================================\n` +
    `if (typeof window !== 'undefined') {\n` +
    `    window.executeStockAnalysis = typeof executeStockAnalysis !== 'undefined' ? executeStockAnalysis : window.executeStockAnalysis;\n` +
    `    window.switchMainTab = typeof switchMainTab !== 'undefined' ? switchMainTab : window.switchMainTab;\n` +
    `    window.openMobileSearch = typeof openMobileSearch !== 'undefined' ? openMobileSearch : window.openMobileSearch;\n` +
    `    window.closeMobileSearch = typeof closeMobileSearch !== 'undefined' ? closeMobileSearch : window.closeMobileSearch;\n` +
    `    window.timeAgo = typeof timeAgo !== 'undefined' ? timeAgo : window.timeAgo;\n` +
    `    window.playSoundChime = typeof playSoundChime !== 'undefined' ? playSoundChime : window.playSoundChime;\n` +
    `    window.renderScalpingTable = typeof renderScalpingTable !== 'undefined' ? renderScalpingTable : window.renderScalpingTable;\n` +
    `    window.switchForeignSubmenu = typeof switchForeignSubmenu !== 'undefined' ? switchForeignSubmenu : window.switchForeignSubmenu;\n` +
    `    window.renderWatchlistDrawer = typeof renderWatchlistDrawer !== 'undefined' ? renderWatchlistDrawer : window.renderWatchlistDrawer;\n` +
    `    window.updateWatchlistBadge = typeof updateWatchlistBadge !== 'undefined' ? updateWatchlistBadge : window.updateWatchlistBadge;\n` +
    `    window.saveWatchlistToStorage = typeof saveWatchlistToStorage !== 'undefined' ? saveWatchlistToStorage : window.saveWatchlistToStorage;\n` +
    `}\n`;

fs.writeFileSync(outFile, combined, 'utf8');
console.log(`Successfully built ${outFile} from ${moduleOrder.length} modules (${combined.split('\n').length} lines).`);
