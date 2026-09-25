const FEATURE_NAMES = [
    'bullishEngulfing', 'hammer', 'morningStar', 'threeWhiteSoldiers', 'piercingLine', 'breakoutVolume',
    'volumeSpikeRatio', 'closeAboveMA20', 'ma20AboveMA50', 'ma50AboveMA200', 'rsi14'
];
const PATTERN_NAMES = [
    ['bullishEngulfing', 'Bullish Engulfing'], ['hammer', 'Hammer'], ['morningStar', 'Morning Star'],
    ['threeWhiteSoldiers', 'Three White Soldiers'], ['piercingLine', 'Piercing Line'], ['breakoutVolume', 'Breakout Volume']
];
let cachedModel;

function average(values) {
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function rsi14(quotes, index) {
    if (index < 14) return null;
    let gains = 0;
    let losses = 0;
    for (let i = index - 13; i <= index; i++) {
        const delta = Number(quotes[i].close) - Number(quotes[i - 1].close);
        if (delta > 0) gains += delta;
        else losses -= delta;
    }
    if (losses === 0) return gains > 0 ? 100 : 50;
    const avgGain = gains / 14;
    const avgLoss = losses / 14;
    return 100 - (100 / (1 + avgGain / avgLoss));
}

function getCandlePatterns(quotes, index) {
    const flags = { bullishEngulfing: 0, hammer: 0, morningStar: 0, threeWhiteSoldiers: 0, piercingLine: 0, breakoutVolume: 0 };
    if (index < 2) return flags;
    const current = quotes[index];
    const previous = quotes[index - 1];
    const beforePrevious = quotes[index - 2];
    const body = Math.abs(current.close - current.open);
    const range = current.high - current.low;
    const lowerWick = Math.min(current.open, current.close) - current.low;
    const upperWick = current.high - Math.max(current.open, current.close);
    const previousBody = Math.abs(previous.close - previous.open);
    const previousRed = previous.close < previous.open;
    const currentGreen = current.close > current.open;

    flags.bullishEngulfing = Number(currentGreen && previousRed && current.open <= previous.close && current.close >= previous.open && body >= previousBody);
    flags.hammer = Number(range > 0 && body > 0 && lowerWick >= 2 * body && upperWick <= body && current.close >= current.low + range * 0.6);
    const middleBody = previousBody;
    flags.morningStar = Number(beforePrevious.close < beforePrevious.open &&
        Math.abs(beforePrevious.close - beforePrevious.open) >= beforePrevious.close * 0.01 &&
        middleBody <= Math.abs(beforePrevious.close - beforePrevious.open) * 0.45 && currentGreen &&
        current.close >= (beforePrevious.open + beforePrevious.close) / 2);
    if (index >= 2) {
        const a = quotes[index - 2], b = quotes[index - 1], c = current;
        const bMid = (b.open + b.close) / 2;
        flags.threeWhiteSoldiers = Number(a.close > a.open && b.close > b.open && c.close > c.open &&
            b.close > a.close && c.close > b.close && b.open <= a.close && b.open >= a.open &&
            c.open <= b.close && c.open >= b.open && (b.close - b.open) >= (b.high - b.low) * 0.5 &&
            (c.close - c.open) >= (c.high - c.low) * 0.5 && bMid > b.open);
    }
    flags.piercingLine = Number(previousRed && currentGreen && current.open <= previous.close &&
        current.close > (previous.open + previous.close) / 2 && current.close < previous.open);

    const priorVolumes = quotes.slice(Math.max(0, index - 20), index).map(q => Number(q.volume)).filter(v => v > 0);
    const avgVolume = average(priorVolumes);
    const volumeSpikeRatio = avgVolume ? Number(current.volume) / avgVolume : 0;
    const priorHighs = quotes.slice(Math.max(0, index - 20), index).map(q => Number(q.high)).filter(v => v > 0);
    flags.breakoutVolume = Number(priorHighs.length === 20 && current.close > Math.max(...priorHighs) && volumeSpikeRatio >= 1.5);
    return flags;
}

function extractFeatureAt(quotes, index) {
    if (index < 199 || index >= quotes.length) return null;
    const current = quotes[index];
    const trailingCloses = quotes.slice(index - 199, index + 1).map(q => Number(q.close));
    const ma20 = average(trailingCloses.slice(-20));
    const ma50 = average(trailingCloses.slice(-50));
    const ma200 = average(trailingCloses);
    const priorVolumes = quotes.slice(index - 20, index).map(q => Number(q.volume)).filter(v => v > 0);
    const avgVolume = average(priorVolumes);
    const patterns = getCandlePatterns(quotes, index);
    const feature = {
        ...patterns,
        volumeSpikeRatio: Math.max(0, Math.min(10, avgVolume ? Number(current.volume) / avgVolume : 0)),
        closeAboveMA20: Number(current.close > ma20),
        ma20AboveMA50: Number(ma20 > ma50),
        ma50AboveMA200: Number(ma50 > ma200),
        rsi14: rsi14(quotes, index),
        ma20, ma50, ma200
    };
    return feature;
}

function makeFeatureVector(feature) {
    return FEATURE_NAMES.map(name => Number(feature?.[name] ?? 0));
}

function loadModel() {
    if (cachedModel !== undefined) return cachedModel;
    try {
        const model = require('./candlestickModel.json');
        cachedModel = model?.version === 1 && model.tree ? model : null;
    } catch {
        cachedModel = null;
    }
    return cachedModel;
}

function predictProbability(tree, features) {
    let node = tree;
    while (node && !node.leaf) node = features[node.featureIndex] <= node.threshold ? node.left : node.right;
    return node?.probability ?? null;
}

function jakartaDateKey(value) {
    return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
}

function analyzeCandlesticks(quotes) {
    const clean = Array.isArray(quotes) ? quotes.filter(q => q && Number(q.open) > 0 && Number(q.high) > 0 && Number(q.low) > 0 && Number(q.close) > 0 && Number(q.volume) > 0) : [];
    const jakartaHour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', hourCycle: 'h23' }).format(new Date()));
    if (clean.length > 200 && clean.at(-1)?.date && jakartaDateKey(clean.at(-1).date) === jakartaDateKey(Date.now()) && jakartaHour < 16) {
        clean.pop(); // Avoid evaluating an unfinished daily candle during the IDX session.
    }
    const index = clean.length - 1;
    const latest = clean[index];
    const features = extractFeatureAt(clean, index);
    const model = loadModel();
    const patterns = features ? PATTERN_NAMES.filter(([key]) => features[key]).map(([, label]) => label) : [];
    const probability = features && model ? predictProbability(model.tree, makeFeatureVector(features)) : null;
    const trendConfirmed = Boolean(features?.closeAboveMA20 && features?.ma20AboveMA50);
    const hasPattern = patterns.length > 0;
    const patternSupport = patterns.length > 0 && patterns.every(label => {
        const key = PATTERN_NAMES.find(([, name]) => name === label)?.[0];
        return key && Number(model?.patternCounts?.[key] || 0) >= 2000;
    });
    const validation = model?.validation || null;
    const statisticallySupported = Boolean(validation?.confidenceTarget80Met &&
        Number(validation?.predictedStrongBuySamples) >= 30 &&
        Number(validation?.observedStrongBuyWinRatePct) >= 80);
    const decision = probability === null || probability < 0.6 || !hasPattern || !trendConfirmed || !patternSupport ? 'NEUTRAL'
        : probability >= 0.8 && statisticallySupported ? 'STRONG BUY'
            : probability >= 0.6 && statisticallySupported ? 'BUY' : 'NEUTRAL';
    return {
        decision,
        confidencePct: probability === null || !statisticallySupported ? null : Number((probability * 100).toFixed(1)),
        targetPrice: latest ? Number((latest.close * 1.03).toFixed(2)) : null,
        stopLoss: latest ? Number((latest.close * 0.98).toFixed(2)) : null,
        patterns,
        trendConfirmed,
        patternSupport,
        modelTrained: Boolean(model),
        validation,
        targetRule: 'TP +3%, SL -2%; label dievaluasi selama 10 sesi bursa'
    };
}

module.exports = { analyzeCandlesticks, extractFeatureAt, getCandlePatterns, makeFeatureVector, FEATURE_NAMES, PATTERN_NAMES, predictProbability, loadModel };
