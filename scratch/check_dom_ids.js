const fs = require('fs');
const appJs = fs.readFileSync('public/app.js', 'utf8');
const indexHtml = fs.readFileSync('public/index.html', 'utf8');

const regex = /getElementById\(['"]([^'"]+)['"]\)/g;
const uniqueIds = new Set();
let match;
while ((match = regex.exec(appJs)) !== null) {
    uniqueIds.add(match[1]);
}

const missingIds = [];
for (const id of uniqueIds) {
    if (!indexHtml.includes(`id="${id}"`) && !indexHtml.includes(`id='${id}'`)) {
        missingIds.push(id);
    }
}

console.log('Total getElementById checked:', uniqueIds.size);
console.log('Missing IDs in index.html:', missingIds);
