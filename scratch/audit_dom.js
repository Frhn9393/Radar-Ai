const fs = require('fs');
const html = fs.readFileSync('public/index.html', 'utf8');
const js = fs.readFileSync('public/app.js', 'utf8');

const idRegex = /document\.getElementById\(['"]([^'"]+)['"]\)/g;
let match;
const missing = new Set();
const found = new Set();
while ((match = idRegex.exec(js)) !== null) {
  const id = match[1];
  if (!html.includes('id="' + id + '"') && !html.includes("id='" + id + "'")) {
    missing.add(id);
  } else {
    found.add(id);
  }
}
console.log('Total IDs queried:', found.size + missing.size);
console.log('Found IDs:', found.size);
console.log('Missing IDs in index.html:', Array.from(missing));
