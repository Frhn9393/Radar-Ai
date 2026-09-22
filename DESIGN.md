# Panduan Desain STOCKRADAR AI

Arah desain dan sistem visual untuk antarmuka STOCKRADAR AI (Desktop dan Mobile).

## Identitas & Arah Desain
- **Produk**: Terminal intelijen finansial waktu nyata dan penyaring saham kuantitatif untuk Bursa Efek Indonesia (IDX).
- **Target Pengguna**: Trader harian, scalper, analis teknikal, dan investor ritel Indonesia.
- **Dial**: ENERGY 2 / RHYTHM 2 / MOTION 1
  - **ENERGY 2**: Tampilan fintech berimbang, fokus data, kontras tajam tanpa silau berlebihan.
  - **RHYTHM 2**: Komposisi kartu data dan tabel terstruktur dengan jeda hierarki yang jelas.
  - **MOTION 1**: Transisi antarmuka fungsional dan cepat (0.2s), tanpa animasi dekoratif yang memperlambat respon.

## Palet Warna
- **Background Utama**: `#07090e` (Radar dark background)
- **Background Kartu**: `#0d131f` dan `#0b101a`
- **Border & Pembatas**: `#1c2638` dan `#172033`
- **Aksen Bullish / Cuan**: `#00e699` (Neon Green) dan `#10b981` (Emerald)
- **Aksen Bearish / Loss**: `#f43f5e` (Rose / Red)
- **Aksen Peringatan / Deal**: `#f59e0b` (Gold Amber)
- **Aksen Asing / Flow**: `#06b6d4` (Cyan)
- **Aksen Backtest / Quant**: `#a855f7` (Purple / Violet)

## Tipografi
- **Headings & Body**: Plus Jakarta Sans
- **Data, Harga & Simbol**: JetBrains Mono

## Aturan Mobile-First
- Tampilan mobile memprioritaskan keterbacaan data instan dan kemudahan akses jempol (thumb-friendly).
- Navigasi utama mobile berada di Bottom Navigation Bar.
- Header mobile dibuat ringkas dan padat.
- Tabel kuantitatif dilengkapi kolom kode saham yang terkunci (sticky) saat digeser secara horizontal.
- Target sentuh minimal 44 x 44 piksel pada seluruh tombol dan kontrol interaktif.
