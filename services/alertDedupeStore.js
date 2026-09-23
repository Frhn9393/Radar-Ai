const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const TTL_MS = 24 * 60 * 60 * 1000;
const STORE_PATH = path.join(os.tmpdir(), 'stockradar-alert-dedupe.json');
let writeQueue = Promise.resolve();

async function claimAlert(key) {
    const normalized = String(key || '').trim();
    if (!normalized) return false;
    const hash = crypto.createHash('sha256').update(normalized).digest('hex');
    const previous = writeQueue;
    let release;
    const next = new Promise(resolve => { release = resolve; });
    writeQueue = previous.then(() => next);
    await previous;
    try {
        let store = {};
        try { store = JSON.parse(await fs.readFile(STORE_PATH, 'utf8')); } catch {}
        const now = Date.now();
        for (const [storedHash, timestamp] of Object.entries(store)) {
            if (!Number.isFinite(timestamp) || now - timestamp > TTL_MS) delete store[storedHash];
        }
        if (store[hash]) return false;
        store[hash] = now;
        const entries = Object.entries(store).sort((a, b) => b[1] - a[1]).slice(0, 4000);
        await fs.writeFile(STORE_PATH, JSON.stringify(Object.fromEntries(entries)), 'utf8');
        return true;
    } finally {
        release();
    }
}

async function releaseAlert(key) {
    const normalized = String(key || '').trim();
    if (!normalized) return;
    const hash = crypto.createHash('sha256').update(normalized).digest('hex');
    const previous = writeQueue;
    let release;
    const next = new Promise(resolve => { release = resolve; });
    writeQueue = previous.then(() => next);
    await previous;
    try {
        let store = {};
        try { store = JSON.parse(await fs.readFile(STORE_PATH, 'utf8')); } catch {}
        delete store[hash];
        await fs.writeFile(STORE_PATH, JSON.stringify(store), 'utf8');
    } finally { release(); }
}

module.exports = { claimAlert, releaseAlert };
