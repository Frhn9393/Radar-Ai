# Panduan Hosting Website Secara Gratis

Panduan ini akan menjelaskan cara meng-online-kan (hosting) website kamu secara gratis. Karena setiap website memiliki kebutuhan yang berbeda, panduan ini dibagi menjadi dua bagian: **Website Statis** (hanya HTML, CSS, JavaScript) dan **Website Dinamis/Backend** (Node.js, Express, Python).

---

## Opsi 1: Hosting Website Statis (HTML, CSS, JS Biasa)
Jika website kamu hanya berupa tampilan depan (seperti portfolio atau landing page tanpa database/backend), opsi terbaik adalah **Vercel** atau **Netlify**. Keduanya 100% gratis, sangat cepat, dan mudah digunakan.

### Menggunakan Vercel (Paling Direkomendasikan)
1. **Buat Akun GitHub**: Pastikan kode website kamu sudah di-upload ke repository GitHub (https://github.com/).
2. **Daftar ke Vercel**: Buka [vercel.com](https://vercel.com/) dan daftar menggunakan akun GitHub kamu.
3. **Pilih Proyek**:
   - Setelah masuk ke dashboard Vercel, klik tombol **"Add New"** > **"Project"**.
   - Vercel akan menampilkan daftar repository dari GitHub kamu.
4. **Deploy (Terbitkan)**:
   - Cari nama repository website kamu dan klik tombol **"Import"**.
   - Biarkan pengaturan bawaan (default) seperti apa adanya, lalu klik **"Deploy"**.
5. **Selesai!**: Tunggu sekitar 1-2 menit. Vercel akan memberikan link gratis (contoh: `nama-website.vercel.app`) yang bisa diakses oleh siapa saja di internet.

---

## Opsi 2: Hosting Website Backend / Fullstack (Node.js, Express, Python)
Website yang memiliki sistem di belakang layar (seperti aplikasi Radar-ai ini yang menggunakan Node.js dan Python) membutuhkan komputer server yang bisa menjalankan program secara terus-menerus. Pilihan gratis terbaik saat ini adalah **Render** atau **Railway**.

### Menggunakan Render (Paling Populer untuk Gratisan)
1. **Upload ke GitHub**: Sama seperti sebelumnya, pastikan seluruh kode proyek (termasuk `package.json` atau `requirements.txt`) sudah ada di GitHub.
2. **Daftar ke Render**: Buka [render.com](https://render.com/) dan daftar menggunakan akun GitHub.
3. **Buat Web Service Baru**:
   - Di dashboard, klik tombol **"New"** lalu pilih **"Web Service"**.
   - Pilih opsi **"Build and deploy from a Git repository"** dan klik Next.
4. **Hubungkan Repository**: Cari repository proyek kamu dari daftar GitHub yang muncul, lalu klik **"Connect"**.
5. **Pengaturan Hosting**:
   - **Name**: Isi dengan nama aplikasi kamu.
   - **Region**: Pilih yang paling dekat, misalnya Singapore (jika ada) atau US.
   - **Environment**: Pilih `Node` (jika aplikasi Express) atau `Python` (jika Flask/FastAPI).
   - **Build Command**: Perintah untuk menginstal library. Untuk Node.js, biasanya `npm install`.
   - **Start Command**: Perintah untuk menjalankan aplikasi. Untuk Node.js, biasanya `node server.js` atau `npm start`.
6. **Pilih Paket Gratis**: Scroll ke bawah dan pastikan kamu memilih paket **"Free"** ($0/month).
7. **Deploy**: Klik tombol **"Create Web Service"**.
8. **Proses Loading**: Render akan mulai menginstal dan menjalankan aplikasi kamu. Proses ini mungkin memakan waktu 3-5 menit. Jika berhasil, kamu akan mendapatkan link gratis (contoh: `nama-aplikasi.onrender.com`).

> **Catatan Penting untuk Paket Gratis Render:**
> Aplikasi yang menggunakan paket gratis di Render akan "tertidur" (sleep) jika tidak ada yang membuka website selama 15 menit. Saat ada pengunjung baru yang membuka link-nya, website akan butuh waktu sekitar 30 detik untuk "bangun" dan loading. Ini adalah hal wajar untuk hosting gratis.

---

## Tips Tambahan agar Hosting Berjalan Lancar
- **Gunakan Port Dinamis**: Pastikan di dalam kode backend kamu (contoh: `server.js`), port tidak dikunci di angka tertentu. Gunakan kode seperti ini:
  ```javascript
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
      console.log(`Server jalan di port ${PORT}`);
  });
  ```
- **Sembunyikan Data Penting**: Jangan pernah meng-upload file berisi password atau API Key (seperti data rahasia dari Yahoo Finance atau database) langsung ke GitHub. Gunakan file `.env` dan masukkan variabel tersebut ke menu **"Environment Variables"** di dashboard Vercel atau Render.
- **Git Ignore**: Pastikan ada file `.gitignore` di proyek kamu yang berisi tulisan `node_modules/` agar folder library yang berat tidak ikut ter-upload ke GitHub.

Semoga panduan ini membantu kamu untuk segera merilis website ke internet!
