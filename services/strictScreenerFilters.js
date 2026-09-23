function finite(value) {
    return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
}

function isStrictBsjpEligible(metrics = {}) {
    if (!metrics || typeof metrics !== 'object' || Array.isArray(metrics)) return false;
    const { close, high, tickSize, turnover, volumeToday, ma5Volume, broksum } = metrics;
    if (![close, high, tickSize, turnover, volumeToday, ma5Volume].every(finite)) return false;
    if (Number(tickSize) <= 0 || Number(ma5Volume) <= 0) return false;
    const source = String(broksum?.dataSource || '').trim().toUpperCase();
    const status = String(broksum?.status || broksum?.analysis?.label || broksum?.analysis?.key || '')
        .toUpperCase().replace(/[_-]+/g, ' ').replace(/[^A-Z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
    return metrics.isCurrentJakartaDay === true &&
        Number(close) >= Number(high) - 2 * Number(tickSize) &&
        Number(turnover) > 10_000_000_000 &&
        Number(volumeToday) > 2 * Number(ma5Volume) &&
        source === 'STOCKBIT' &&
        status === 'BIG ACCUMULATION';
}

function isStrictBpjpEligible(metrics = {}) {
    if (!metrics || typeof metrics !== 'object' || Array.isArray(metrics)) return false;
    const { open, previousClose, totalBidVolume, totalOfferVolume } = metrics;
    if (![open, previousClose, totalBidVolume, totalOfferVolume].every(finite)) return false;
    if (Number(previousClose) <= 0 || Number(totalOfferVolume) <= 0) return false;
    const gapPct = ((Number(open) - Number(previousClose)) / Number(previousClose)) * 100;
    return metrics.isCurrentJakartaDay === true &&
        Number(open) > Number(previousClose) &&
        gapPct >= 1 && gapPct <= 3 &&
        Number(totalBidVolume) > 2 * Number(totalOfferVolume) &&
        (metrics.hasPositiveDailyNews === true || metrics.hasDailyMaNews === true);
}

function isStrictIntradayEligible(metrics = {}) {
    if (!metrics || typeof metrics !== 'object' || Array.isArray(metrics)) return false;
    const { runningTradeFrequencyPerMinute, averageDailyTurnover, netBuyerPowerPct } = metrics;
    if (![runningTradeFrequencyPerMinute, averageDailyTurnover, netBuyerPowerPct].every(finite)) return false;
    return metrics.isCurrentJakartaDay === true &&
        Number(runningTradeFrequencyPerMinute) > 50 &&
        Number(averageDailyTurnover) > 20_000_000_000 &&
        Number(netBuyerPowerPct) > 65;
}

module.exports = { isStrictBsjpEligible, isStrictBpjpEligible, isStrictIntradayEligible };
