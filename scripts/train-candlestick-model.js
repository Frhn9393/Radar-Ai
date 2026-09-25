const fs = require('fs');
const path = require('path');
const YahooFinance = require('yahoo-finance2').default;
const { UNIQUE_WATCHLIST } = require('../services/screenerService');
const { extractFeatureAt, FEATURE_NAMES, PATTERN_NAMES, makeFeatureVector } = require('../services/candlestickAiEngine');

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });
const YEARS = 10;
const MAX_SYMBOLS = 170;
const MIN_AVG_TURNOVER = 500_000_000;
const MAX_TICKERS = 170;
const OUTPUT_DIR = path.join(__dirname, '..', 'data', 'candlestick');
const DATASET_PATH = path.join(OUTPUT_DIR, 'idx_candlestick_ohlcv_features.csv');
const MODEL_PATH = path.join(__dirname, '..', 'services', 'candlestickModel.json');
const REPORT_PATH = path.join(OUTPUT_DIR, 'training_report.json');
const HEADER = [
    'ticker', 'date', 'open', 'high', 'low', 'close', 'volume', 'avgTurnover20', 'volumeSpikeRatio',
    'ma20', 'ma50', 'ma200', 'rsi14', ...PATTERN_NAMES.map(([name]) => name), 'labelWin'
];

function validQuote(q) {
    const vals = [q?.open, q?.high, q?.low, q?.close, q?.volume].map(Number);
    return vals.every(Number.isFinite) && vals.slice(0, 4).every(v => v > 0) && vals[4] > 0 && vals[1] >= vals[2] &&
        vals[1] >= Math.max(vals[0], vals[3]) && vals[2] <= Math.min(vals[0], vals[3]);
}

function addLabels(quotes) {
    const rows = [];
    const patternCounts = Object.fromEntries(PATTERN_NAMES.map(([name]) => [name, 0]));
    for (let i = 199; i < quotes.length - 10; i++) {
        const feature = extractFeatureAt(quotes, i);
        if (!feature) continue;
        const entry = quotes[i].close;
        const target = entry * 1.03;
        const stop = entry * 0.98;
        let labelWin;
        for (let j = i + 1; j <= i + 10; j++) {
            if (quotes[j].low <= stop) { labelWin = 0; break; } // conservative if both touched in one candle
            if (quotes[j].high >= target) { labelWin = 1; break; }
        }
        if (labelWin === undefined) labelWin = Number(quotes[i + 10].close > entry);
        for (const [name] of PATTERN_NAMES) patternCounts[name] += feature[name] ? 1 : 0;
        rows.push({ ticker: '', date: new Date(quotes[i].date).toISOString().slice(0, 10), quote: quotes[i], feature, labelWin });
    }
    return { rows, patternCounts };
}

async function fetchUniverse() {
    const candidates = [...new Set(UNIQUE_WATCHLIST)].slice(0, MAX_SYMBOLS);
    const results = [];
    let cursor = 0;
    async function worker() {
        while (cursor < candidates.length) {
            const ticker = candidates[cursor++];
            try {
                const chart = await yahooFinance.chart(`${ticker}.JK`, {
                    period1: new Date(Date.now() - YEARS * 365.25 * 24 * 60 * 60 * 1000),
                    interval: '1d', events: 'splits'
                });
                const quotes = (chart?.quotes || []).filter(validQuote).sort((a, b) => new Date(a.date) - new Date(b.date));
                if (quotes.length < 260) continue;
                const recent = quotes.slice(-252);
                const recent20 = recent.slice(-20);
                const avgTurnover20 = recent20.reduce((sum, q) => sum + q.close * q.volume, 0) / recent20.length;
                const mostRecentDate = new Date(recent.at(-1).date).getTime();
                const freshEnough = Date.now() - mostRecentDate < 14 * 86400_000;
                const barsEnough = recent.length >= 200;
                const noLongSuspensionGap = quotes.slice(1).every((q, index) => new Date(q.date) - new Date(quotes[index].date) <= 14 * 86400_000);
                if (avgTurnover20 < MIN_AVG_TURNOVER || !freshEnough || !barsEnough || !noLongSuspensionGap) continue;
                results.push({ ticker, quotes, avgTurnover20, splitEvents: Array.isArray(chart.events?.splits) ? chart.events.splits.length : 0 });
                process.stdout.write(`Collected ${ticker}: ${quotes.length} bars; avg turnover ${Math.round(avgTurnover20).toLocaleString('en-US')}\n`);
            } catch (error) {
                process.stderr.write(`Skipped ${ticker}: ${error.message}\n`);
            }
        }
    }
    await Promise.all(Array.from({ length: 4 }, worker));
    return results.sort((a, b) => b.avgTurnover20 - a.avgTurnover20).slice(0, MAX_TICKERS);
}

function gini(positives, total) {
    if (!total) return 0;
    const p = positives / total;
    return 2 * p * (1 - p);
}

function leaf(indices, samples) {
    const wins = indices.reduce((sum, i) => sum + samples[i].labelWin, 0);
    return { leaf: true, n: indices.length, wins, probability: (wins + 1) / (indices.length + 2) };
}

function buildTree(samples, indices, depth = 0, maxDepth = 4, minLeaf = 250) {
    const positives = indices.reduce((sum, i) => sum + samples[i].labelWin, 0);
    const base = leaf(indices, samples);
    if (depth >= maxDepth || indices.length < minLeaf * 2 || positives === 0 || positives === indices.length) return base;
    const parentImpurity = gini(positives, indices.length);
    let best = null;
    for (let f = 0; f < FEATURE_NAMES.length; f++) {
        const ordered = indices.map(i => [samples[i].features[f], samples[i].labelWin, i]).sort((a, b) => a[0] - b[0]);
        let leftN = 0, leftWins = 0;
        for (let i = 0; i < ordered.length - 1; i++) {
            leftN++;
            leftWins += ordered[i][1];
            const rightN = ordered.length - leftN;
            if (leftN < minLeaf || rightN < minLeaf || ordered[i][0] === ordered[i + 1][0]) continue;
            const rightWins = positives - leftWins;
            const impurity = leftN / indices.length * gini(leftWins, leftN) + rightN / indices.length * gini(rightWins, rightN);
            const gain = parentImpurity - impurity;
            if (!best || gain > best.gain) best = { featureIndex: f, threshold: (ordered[i][0] + ordered[i + 1][0]) / 2, gain };
        }
    }
    if (!best || best.gain < 0.00005) return base;
    const leftIndices = [], rightIndices = [];
    for (const index of indices) (samples[index].features[best.featureIndex] <= best.threshold ? leftIndices : rightIndices).push(index);
    return {
        featureIndex: best.featureIndex, threshold: best.threshold,
        left: buildTree(samples, leftIndices, depth + 1, maxDepth, minLeaf),
        right: buildTree(samples, rightIndices, depth + 1, maxDepth, minLeaf)
    };
}

function predict(tree, features) {
    let node = tree;
    while (!node.leaf) node = features[node.featureIndex] <= node.threshold ? node.left : node.right;
    return node.probability;
}

function csvValue(value) {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) return '';
    return String(Number(Number(value).toFixed(6)));
}

async function main() {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    process.stdout.write(`Fetching up to ${MAX_SYMBOLS} IDX tickers, ${YEARS} years daily OHLCV...\n`);
    const instruments = await fetchUniverse();
    if (instruments.length < 50) throw new Error(`Only ${instruments.length} currently liquid tickers were found; need at least 50.`);
    const allRows = [];
    const aggregatePatternCounts = Object.fromEntries(PATTERN_NAMES.map(([name]) => [name, 0]));
    for (const instrument of instruments) {
        const { rows, patternCounts } = addLabels(instrument.quotes);
        for (const row of rows) { row.ticker = instrument.ticker; row.avgTurnover20 = instrument.avgTurnover20; }
        allRows.push(...rows);
        for (const name of Object.keys(aggregatePatternCounts)) aggregatePatternCounts[name] += patternCounts[name];
    }
    if (allRows.length < 150_000) throw new Error(`Dataset has ${allRows.length} rows; requirement is at least 150,000.`);
    allRows.sort((a, b) => a.date.localeCompare(b.date) || a.ticker.localeCompare(b.ticker));
    const csv = [HEADER.join(',')];
    for (const row of allRows) {
        const q = row.quote, f = row.feature;
        csv.push([
            row.ticker, row.date, q.open, q.high, q.low, q.close, q.volume, csvValue(row.avgTurnover20),
            csvValue(f.volumeSpikeRatio), csvValue(f.ma20), csvValue(f.ma50), csvValue(f.ma200), csvValue(f.rsi14),
            ...PATTERN_NAMES.map(([name]) => f[name]), row.labelWin
        ].join(','));
    }
    fs.writeFileSync(DATASET_PATH, `${csv.join('\n')}\n`, 'utf8');

    const cutoff = new Date(Date.now() - 2 * 365.25 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const outcomeSafetyCutoff = new Date(new Date(cutoff).getTime() - 30 * 86400_000).toISOString().slice(0, 10);
    const patternRows = allRows.filter(row => PATTERN_NAMES.some(([name]) => row.feature[name]));
    const training = patternRows.filter(row => row.date < outcomeSafetyCutoff).map(row => ({ features: makeFeatureVector(row.feature), labelWin: row.labelWin }));
    const holdout = patternRows.filter(row => row.date >= cutoff).map(row => ({ features: makeFeatureVector(row.feature), labelWin: row.labelWin }));
    if (training.length < 20_000 || holdout.length < 10_000) throw new Error(`Insufficient train/holdout rows (${training.length}/${holdout.length}).`);
    const tree = buildTree(training, training.map((_, i) => i));
    let correct = 0, wins80 = 0, signals80 = 0, predicted = 0, truePositives = 0, actualPositives = 0;
    let brier = 0;
    for (const sample of holdout) {
        const p = predict(tree, sample.features);
        const guess = p >= 0.5 ? 1 : 0;
        if (guess === sample.labelWin) correct++;
        if (guess && sample.labelWin) truePositives++;
        if (guess) predicted++;
        if (sample.labelWin) actualPositives++;
        if (p >= 0.8) { signals80++; if (sample.labelWin) wins80++; }
        brier += (p - sample.labelWin) ** 2;
    }
    const validation = {
        method: 'chronological holdout: last 2 years of bullish candlestick-pattern events; training labels end 30 days before holdout; TP +3% before SL -2% within 10 trading sessions, timeout uses horizon close',
        cutoffDate: cutoff,
        samples: holdout.length,
        accuracyPct: Number((100 * correct / holdout.length).toFixed(2)),
        majorityClassBaselineAccuracyPct: Number((100 * Math.max(actualPositives, holdout.length - actualPositives) / holdout.length).toFixed(2)),
        accuracyLiftOverMajorityBaselinePct: Number((100 * correct / holdout.length - 100 * Math.max(actualPositives, holdout.length - actualPositives) / holdout.length).toFixed(2)),
        precisionPct: predicted ? Number((100 * truePositives / predicted).toFixed(2)) : null,
        baselineWinRatePct: Number((100 * actualPositives / holdout.length).toFixed(2)),
        brierScore: Number((brier / holdout.length).toFixed(4)),
        predictedStrongBuySamples: signals80,
        observedStrongBuyWinRatePct: signals80 ? Number((100 * wins80 / signals80).toFixed(2)) : null,
        confidenceTarget80Met: Boolean(signals80 && (100 * wins80 / signals80) >= 80)
    };
    const model = {
        version: 1,
        trainedAt: new Date().toISOString(),
        featureNames: FEATURE_NAMES,
        tree,
        trainingSamples: training.length,
        tickerCount: instruments.length,
        patternCounts: aggregatePatternCounts,
        dataQuality: {
            adjustedOhlcvSource: 'Yahoo Finance chart API split-adjusted OHLCV (split events included for audit; not double-adjusted)',
            minimumCurrentAverageTurnoverIdr: MIN_AVG_TURNOVER,
            invalidOrZeroOhlcvRowsRemoved: true,
            historyYearsRequested: YEARS,
            suspendedAndFcaHandling: 'Missing/no-trade bars removed; current symbols screened for >=200 of last 252 bars and fresh quote, but Yahoo does not supply a historical FCA/suspension classification feed.'
        },
        validation
    };
    fs.writeFileSync(MODEL_PATH, `${JSON.stringify(model)}\n`, 'utf8');
    const report = {
        rowCount: allRows.length,
        tickerCount: instruments.length,
        fileBytes: fs.statSync(DATASET_PATH).size,
        patternCounts: aggregatePatternCounts,
        patternTargetMet: Object.fromEntries(Object.entries(aggregatePatternCounts).map(([name, count]) => [name, count >= 2000])),
        validation,
        selectedTickers: instruments.map(({ ticker, avgTurnover20, splitEvents }) => ({ ticker, avgTurnover20: Math.round(avgTurnover20), splitEvents }))
    };
    fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(JSON.stringify(report, null, 2));
    if (allRows.length < 150_000 || instruments.length < 50 || fs.statSync(DATASET_PATH).size < 15_000_000) {
        process.exitCode = 2;
        console.error('Dataset does not meet all volume/file-size targets; inspect the report before claiming training readiness.');
    }
}

main().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
