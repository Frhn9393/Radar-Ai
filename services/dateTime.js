const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
const customParseFormat = require('dayjs/plugin/customParseFormat');

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);

const MARKET_TIME_ZONE = 'Asia/Jakarta';
const DATE_FORMAT = 'YYYY-MM-DD';

function nowJakarta() {
    return dayjs().tz(MARKET_TIME_ZONE);
}

function formatJakartaDate(date = dayjs()) {
    return dayjs(date).tz(MARKET_TIME_ZONE).format(DATE_FORMAT);
}

function daysAgoJakarta(days, base = nowJakarta()) {
    return dayjs(base).tz(MARKET_TIME_ZONE).subtract(days, 'day').format(DATE_FORMAT);
}

function parseTradingDate(value) {
    if (typeof value !== 'string' || !dayjs(value, DATE_FORMAT, true).isValid()) return null;
    return dayjs.tz(value, DATE_FORMAT, MARKET_TIME_ZONE);
}

function tradingDateBounds(startDate, endDate) {
    const start = parseTradingDate(startDate);
    const end = parseTradingDate(endDate);
    if (!start || !end || start.isAfter(end, 'day')) return null;
    return {
        startDate: start.format(DATE_FORMAT),
        endDate: end.format(DATE_FORMAT),
        startAt: start.startOf('day').format('YYYY-MM-DDTHH:mm:ss.SSSZ'),
        endAt: end.endOf('day').format('YYYY-MM-DDTHH:mm:ss.SSSZ'),
        timeZone: MARKET_TIME_ZONE
    };
}

module.exports = { MARKET_TIME_ZONE, nowJakarta, formatJakartaDate, daysAgoJakarta, parseTradingDate, tradingDateBounds };
