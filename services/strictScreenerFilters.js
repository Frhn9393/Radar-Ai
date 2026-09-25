function finite(value) {
    return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
}

function isStrictBsjpEligible(metrics = {}) {
    if (!metrics || typeof metrics !== 'object' || Array.isArray(metrics)) return false;
    const { close, high, tickSize, volumeToday, ma5Volume, rsi } = metrics;
    if (![close, high, tickSize, volumeToday, ma5Volume, rsi].every(finite)) return false;
    if (Number(tickSize) <= 0 || Number(ma5Volume) <= 0) return false;
    return metrics.isCurrentJakartaDay === true &&
        Number(close) >= Number(high) - 2 * Number(tickSize) &&
        Number(volumeToday) > 1.5 * Number(ma5Volume) &&
        Number(rsi) >= 50 && Number(rsi) <= 70;
}

function isStrictBpjpEligible(metrics = {}) {
    if (!metrics || typeof metrics !== 'object' || Array.isArray(metrics)) return false;
    const { open, previousClose, close } = metrics;
    if (![open, previousClose, close].every(finite) || Number(previousClose) <= 0) return false;
    const gapPct = ((Number(open) - Number(previousClose)) / Number(previousClose)) * 100;
    const changePct = ((Number(close) - Number(previousClose)) / Number(previousClose)) * 100;
    return metrics.isCurrentJakartaDay === true &&
        gapPct >= 1 && gapPct <= 3 &&
        (Number(close) > Number(open) || changePct > 2);
}

function isStrictIntradayEligible(metrics = {}) {
    if (!metrics || typeof metrics !== 'object' || Array.isArray(metrics)) return false;
    const { high, low, volumeToday, ma5Volume } = metrics;
    if (![high, low, volumeToday, ma5Volume].every(finite) || Number(low) <= 0 || Number(ma5Volume) <= 0) return false;
    const dailyVolatilityPct = ((Number(high) - Number(low)) / Number(low)) * 100;
    return metrics.isCurrentJakartaDay === true &&
        dailyVolatilityPct > 3 &&
        Number(volumeToday) > 1.8 * Number(ma5Volume);
}

function isScalpingOpeningSurgeEligible(metrics = {}, changePct) {
    return isStrictIntradayEligible(metrics) && finite(changePct) && Number(changePct) > 2;
}

module.exports = { isStrictBsjpEligible, isStrictBpjpEligible, isStrictIntradayEligible, isScalpingOpeningSurgeEligible };
