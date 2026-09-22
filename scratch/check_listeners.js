const fs = require('fs');
const appJs = fs.readFileSync('public/app.js', 'utf8');

const regex = /([a-zA-Z0-9_$.]+)\.addEventListener\(['"]([^'"]+)['"]/g;
let match;
const listeners = [];
while ((match = regex.exec(appJs)) !== null) {
    listeners.push({ target: match[1], event: match[2] });
}
console.log('Total addEventListener calls:', listeners.length);
console.log(listeners);
