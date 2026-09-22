// Time, Date, and Market Helper Utilities

function formatWibTime(date) {
    if (!date) return 'Baru saja';
    const d = typeof date === 'string' ? new Date(date) : (date instanceof Date ? date : new Date(date));
    if (isNaN(d.getTime())) return 'Baru saja';
    return d.toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' }).replace('.', ':') + ' WIB';
}

function formatWibDate(date) {
    if (!date) return '-';
    const d = typeof date === 'string' ? new Date(date) : (date instanceof Date ? date : new Date(date));
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short' });
}

function calcTimeAgo(date) {
    if (!date) return 'Baru saja';
    const now = new Date();
    const d = typeof date === 'string' ? new Date(date) : (date instanceof Date ? date : new Date(date));
    if (isNaN(d.getTime())) return 'Baru saja';
    const diffMs = Math.max(0, now - d);
    const diffMin = Math.floor(diffMs / (60 * 1000));
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffMin < 1) return 'Baru saja';
    if (diffMin < 60) return `${diffMin} menit lalu`;
    if (diffHour < 24) return `${diffHour} jam lalu`;
    if (diffDay === 1) return 'Kemarin';
    return `${diffDay} hari lalu`;
}

function getTickSize(price) {
    if (price < 200) return 1;
    if (price < 500) return 2;
    if (price < 2000) return 5;
    if (price < 5000) return 10;
    return 25;
}

function sanitizeTicker(ticker) {
    if (!ticker) return '';
    let clean = String(ticker).trim().toUpperCase().replace(/^[\$#]/, '').replace(/\.JK$/i, '');
    if (clean === '^JKSE' || clean === 'JKSE') return 'IHSG';
    return clean;
}

module.exports = {
    formatWibTime,
    formatWibDate,
    calcTimeAgo,
    getTickSize,
    sanitizeTicker
};
