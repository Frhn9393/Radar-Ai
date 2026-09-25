function parseDatasetCsv(contents, header) {
    if (typeof contents !== 'string' || !Array.isArray(header) || !contents.trim()) return [];
    const lines = contents.trim().split(/\r?\n/);
    if (lines.shift() !== header.join(',')) return [];

    return lines.map(line => line.split(',')).filter(values => values.length === header.length).map(values => {
        if (header.some((name, index) => name !== 'ticker' && name !== 'date' && name !== 'labelWin' && !values[index].trim())) return null;
        const row = Object.fromEntries(header.map((name, index) => [name, values[index]]));
        for (const name of header) {
            if (name === 'labelWin' && !String(row[name]).trim()) row[name] = null;
            else if (name !== 'ticker' && name !== 'date') row[name] = Number(row[name]);
        }
        return row;
    }).filter(row => row && isValidDatasetRow(row, header));
}

function isValidDatasetRow(row, header) {
    if (!row || !/^[A-Z0-9]{2,6}$/.test(String(row.ticker || '')) || !/^\d{4}-\d{2}-\d{2}$/.test(String(row.date || ''))) return false;
    if (header.some(name => name !== 'ticker' && name !== 'date' && name !== 'labelWin' && (row[name] === null || row[name] === undefined || String(row[name]).trim() === ''))) return false;
    const requiredPrices = ['open', 'high', 'low', 'close', 'volume'];
    if (!requiredPrices.every(name => Number.isFinite(Number(row[name])))) return false;
    if (![row.open, row.high, row.low, row.close, row.volume].every(value => Number(value) > 0)) return false;
    if (Number(row.high) < Math.max(Number(row.open), Number(row.close), Number(row.low))) return false;
    if (Number(row.low) > Math.min(Number(row.open), Number(row.close))) return false;
    if (row.labelWin !== null && row.labelWin !== undefined && ![0, 1].includes(Number(row.labelWin))) return false;
    return header.every(name => name === 'ticker' || name === 'date' || name === 'labelWin' || Number.isFinite(Number(row[name])));
}

function mergeDatasetRows(existingRows, freshRows, cutoffDate, header) {
    const keyedRows = new Map();
    for (const row of Array.isArray(existingRows) ? existingRows : []) {
        if (isValidDatasetRow(row, header) && row.date >= cutoffDate) keyedRows.set(`${row.ticker}|${row.date}`, row);
    }
    for (const row of Array.isArray(freshRows) ? freshRows : []) {
        if (isValidDatasetRow(row, header) && row.date >= cutoffDate) keyedRows.set(`${row.ticker}|${row.date}`, row);
    }
    return [...keyedRows.values()].sort((a, b) => a.date.localeCompare(b.date) || a.ticker.localeCompare(b.ticker));
}

function serializeDatasetCsv(rows, header) {
    return `${[header.join(','), ...(Array.isArray(rows) ? rows : []).map(row => header.map(name => {
        const value = row[name];
        return name === 'ticker' || name === 'date' ? String(value) : value === null || value === undefined ? '' : String(Number(value));
    }).join(','))].join('\n')}\n`;
}

module.exports = { parseDatasetCsv, isValidDatasetRow, mergeDatasetRows, serializeDatasetCsv };
