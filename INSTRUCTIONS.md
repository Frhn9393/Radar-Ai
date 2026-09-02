# Panduan Menjalankan Sistem IDX AI Financial Analyst

Sistem ini merupakan aplikasi hibrida yang menggunakan **Node.js** sebagai server utama dan **Python** sebagai mesin pengolah indikator teknikal (Technical Analysis Engine). Ikuti langkah-langkah di bawah ini untuk mengatur dan menjalankan sistem secara lokal di mesin Windows Anda.

## Prasyarat (Prerequisites)
Pastikan Anda telah menginstal *software* berikut di mesin Anda:
1. **Node.js** (versi 18+ disarankan)
2. **Python** (versi 3.8+ disarankan) - Pastikan Anda telah mencentang opsi "Add Python to PATH" saat proses instalasi.

## 1. Instalasi Dependensi Node.js
Buka terminal (Command Prompt atau PowerShell) dan navigasi ke direktori proyek (`e:\Radar-ai`). Jalankan perintah berikut untuk mengunduh semua pustaka Node.js yang dibutuhkan:

```bash
npm install
```

*Modul yang diinstal termasuk:*
- `express`: Framework server HTTP.
- `cors`: Middleware keamanan.
- `yahoo-finance2`: Integrasi data finansial dan pasar secara *realtime*.
- `rss-parser`: Mesin penarik berita aksi korporasi secara *realtime*.

## 2. Instalasi Dependensi Python (Technical Indicator Engine)
Sistem ini memanggil pustaka khusus di Python untuk menghitung EMA, RSI, MACD, dan ADX. Jalankan perintah berikut di terminal yang sama untuk menginstalnya:

```bash
pip install pandas pandas_ta yfinance
```

*Modul yang diinstal termasuk:*
- `yfinance`: Untuk mengunduh data riwayat (*historical data*) saham secara akurat.
- `pandas_ta`: Library Technical Analysis tingkat lanjut sebagai alternatif TA-Lib yang ramah di Windows.
- `pandas`: Library pemrosesan struktur data finansial.

## 3. Menjalankan Sistem
Setelah semua dependensi terpasang, Anda bisa langsung menjalankan server Node.js. Di terminal Anda, jalankan:

```bash
node server.js
```

Jika berhasil, terminal akan menampilkan pesan:
```
Server is running on http://localhost:3000
```

## 4. Mengakses Dashboard
- Buka *browser* web (Chrome, Edge, Firefox, dll).
- Kunjungi tautan **[http://localhost:3000](http://localhost:3000)**.
- Aplikasi sudah siap digunakan! 
  - Masukkan 4 karakter kode saham (contoh: `BBCA`, `TLKM`, `GOTO`) pada bilah pencarian.
  - Klik **"Analisis Realtime"** untuk mulai menarik dan memproses data dari *backend*.
  - Untuk menggunakan *screener*, klik *tab* **"Live Screener"** dan tekan tombol **"Jalankan Screener"**. (Harap bersabar, proses *screener* memanggil mesin Python berkali-kali untuk menyaring saham).

## Catatan Penting
- **Kecepatan Akses**: Pertama kali server Python dipanggil mungkin memerlukan waktu beberapa detik (proses *cold start*). 
- **Restart Otomatis**: Jika Anda ingin melakukan perubahan pada kode backend, disarankan untuk menginstal `nodemon` (`npm install -g nodemon`) dan menjalankannya dengan perintah `nodemon server.js`.
