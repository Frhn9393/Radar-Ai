// ============================================================
//  MODULE: utils.js
//  Utility helpers: relative time formatters and audio synthesizer chime
// ============================================================

// ============================================================
//  UTILITY: Relative Time Formatter
// ============================================================
function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[char]));
}

function safeExternalUrl(value, fallback = '#') {
    try {
        const url = new URL(String(value || ''), window.location.origin);
        return ['http:', 'https:'].includes(url.protocol) ? url.href : fallback;
    } catch {
        return fallback;
    }
}

function timeAgo(dateStr) {
    if (!dateStr) return 'Baru saja';
    const now = new Date();
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffMin < 1) return 'Baru saja';
    if (diffMin < 60) return `${diffMin} menit lalu`;
    if (diffHour < 24) return `${diffHour} jam lalu`;
    if (diffDay === 1) return 'Kemarin';
    if (diffDay < 7) return `${diffDay} hari lalu`;
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

// ============================================================
//  UTILITY: Audio Synthesizer Chime (Singleton AudioContext)
// ============================================================
let _sharedAudioCtx = null;

function getAudioContext() {
    if (typeof window === 'undefined') return null;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;

    if (!_sharedAudioCtx) {
        try {
            _sharedAudioCtx = new AudioCtx();
        } catch (e) {
            return null;
        }
    }
    if (_sharedAudioCtx && _sharedAudioCtx.state === 'suspended') {
        _sharedAudioCtx.resume().catch(() => {});
    }
    return _sharedAudioCtx;
}

function playSoundChime() {
    if (typeof soundEnabled !== 'undefined' && !soundEnabled) return;
    try {
        const ctx = getAudioContext();
        if (!ctx) return;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.08); // A5
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
    } catch (e) {
        // audio context blocked or unsupported
    }
}

// ============================================================
//  UTILITY: Centralized Currency Formatter (Rp)
//  - Nilai >= 1 Triliun  -> Rp X,XX T
//  - Nilai >= 1 Miliar   -> Rp X,XX M
//  - Nilai < 1 Miliar    -> Rp X
// ============================================================
function formatCurrency(value, options = {}) {
    if (value === null || value === undefined || value === '' || (typeof value === 'number' && isNaN(value))) {
        return options.fallback !== undefined ? options.fallback : 'Rp 0';
    }

    let num = value;
    if (typeof value === 'string') {
        const cleanStr = value.trim();
        const match = cleanStr.match(/^([+-]?)\s*(?:Rp\.?|IDR)?\s*([\d.,]+)\s*(Triliun|Miliar|Juta|Billion|Million|T|M|B)?/i);
        if (match && (match[3] || cleanStr.toLowerCase().includes('triliun') || cleanStr.toLowerCase().includes('miliar') || cleanStr.toLowerCase().includes('t') || cleanStr.toLowerCase().includes('m'))) {
            const sign = match[1] === '-' ? -1 : 1;
            const rawNumStr = match[2].replace(/\./g, '').replace(',', '.');
            const parsedNum = parseFloat(rawNumStr);
            if (!isNaN(parsedNum)) {
                const unit = (match[3] || '').toUpperCase();
                let multiplier = 1;
                if (unit === 'T' || unit.startsWith('TRIL')) multiplier = 1e12;
                else if (unit === 'M' || unit.startsWith('MIL') || unit.startsWith('BIL')) multiplier = 1e9;
                else if (unit === 'JUTA' || unit.startsWith('JUT') || unit.startsWith('MILL')) multiplier = 1e6;
                num = sign * parsedNum * multiplier;
            }
        } else {
            const parsed = Number(cleanStr.replace(/[^0-9.-]/g, ''));
            if (!isNaN(parsed) && cleanStr.length > 0) num = parsed;
        }
    }

    if (isNaN(num)) return typeof value === 'string' ? value : 'Rp 0';

    const n = Number(num);
    const abs = Math.abs(n);
    const sign = n < 0 ? '-' : (options.showPlus && n > 0 ? '+' : '');

    const idFormat = new Intl.NumberFormat('id-ID', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
    const idIntFormat = new Intl.NumberFormat('id-ID', {
        maximumFractionDigits: 0
    });

    if (abs >= 1e12) {
        return `${sign}Rp ${idFormat.format(abs / 1e12)} T`;
    }
    if (abs >= 1e9) {
        return `${sign}Rp ${idFormat.format(abs / 1e9)} M`;
    }
    return `${sign}Rp ${idIntFormat.format(Math.round(abs))}`;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        escapeHtml,
        safeExternalUrl,
        timeAgo,
        playSoundChime,
        formatCurrency
    };
}
