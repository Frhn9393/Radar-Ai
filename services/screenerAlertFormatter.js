function formatScreenerAlertBatch(signals) {
    const groups = new Map();
    for (const signal of Array.isArray(signals) ? signals : []) {
        if (!signal?.row?.ticker || !signal.strategy) continue;
        if (!groups.has(signal.strategy)) groups.set(signal.strategy, []);
        const row = signal.row;
        groups.get(signal.strategy).push(
            `• $${row.ticker} · Rp ${Number(row.price || 0).toLocaleString('id-ID')} · ${row.changePct || '0.00'}% · TP ${Number(row.targetProfit || row.targetPrice1 || 0).toLocaleString('id-ID')} · SL ${Number(row.stopLoss || row.cutLoss || 0).toLocaleString('id-ID')}`
        );
    }

    if (!groups.size) return '';
    const sections = [...groups].map(([strategy, rows]) => `🔹 ${strategy}\n${rows.slice(0, 8).join('\n')}`);
    return `🛰️ STOCKRADAR AI · MASTER RADAR\n\n${sections.join('\n\n━━━━━━━━━━━━━━\n\n')}\n\nSumber: Yahoo Finance OHLCV`;
}

module.exports = { formatScreenerAlertBatch };
