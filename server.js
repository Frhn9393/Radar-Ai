const app = require('./app');

const PORT = process.env.PORT || 3000;

// Start Server with EADDRINUSE protection
const server = app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

server.setMaxListeners(50);

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`[ERROR] Port ${PORT} sedang digunakan oleh proses lain. Coba hentikan proses sebelumnya atau gunakan PORT berbeda.`);
    } else {
        console.error('[ERROR] Server failure:', err.message);
    }
});

// Process-level safety guards to prevent unhandled crashes
process.on('uncaughtException', (err) => {
    console.error('[CRITICAL] Uncaught Exception:', err.message || err);
});

process.on('unhandledRejection', (reason) => {
    console.error('[WARNING] Unhandled Rejection:', reason?.message || reason);
});
