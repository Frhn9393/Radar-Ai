// ============================================================
//  MODULE: init.js
//  Application bootstrap and DOM ready initialization
// ============================================================

// ============================================================
//  APPLICATION BOOTSTRAPPER
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize UI widgets and watchlist badge
    if (typeof updateWatchlistBadge === 'function') updateWatchlistBadge();

    // 2. Fetch critical radar and news feeds
    if (typeof loadDeals === 'function') loadDeals();
    if (typeof loadMarketNews === 'function') loadMarketNews();
    if (typeof loadMarketIndices === 'function') loadMarketIndices();

    // 3. Pre-load foreign flow data for instant tab switching
    if (typeof loadForeignFlowData === 'function') loadForeignFlowData();

    // 4. Initialize institutional backtest engine
    if (typeof initBacktestModule === 'function') initBacktestModule();

    // 5. Start background auto-stream
    if (typeof startAutoStream === 'function') startAutoStream();

    // 6. Resume AudioContext on first user interaction to bypass autoplay restrictions
    const unlockAudio = () => {
        if (typeof getAudioContext === 'function') {
            const ctx = getAudioContext();
            if (ctx && ctx.state === 'suspended') {
                ctx.resume().catch(() => {});
            }
        }
        window.removeEventListener('click', unlockAudio);
        window.removeEventListener('touchstart', unlockAudio);
        window.removeEventListener('keydown', unlockAudio);
    };
    window.addEventListener('click', unlockAudio, { once: true });
    window.addEventListener('touchstart', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });
});
