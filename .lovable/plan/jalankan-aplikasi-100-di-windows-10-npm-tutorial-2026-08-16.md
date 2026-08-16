# Jalankan Aplikasi 100% di Windows 10 (npm) + Tutorial

Target: seluruh aplikasi (web + worker WhatsApp + penjadwal) berjalan di PC Windows 10 Anda lewat `npm`, dengan database/login tetap di backend Lovable Cloud (data sama dengan versi web).

## Yang akan dibuat

**1. Build & run untuk Node/Windows**
- Konfigurasi build diarahkan ke target server Node (bukan Cloudflare) agar hasil build bisa dijalankan `node .output/server/index.mjs`.
- Script npm baru: `start` (jalankan hasil build), `deploy:win` (build lalu start), `worker`, `all` (app + worker sekaligus).
- `.env.example` berisi variabel yang perlu diisi di PC: URL & kunci publik backend, kredensial service akun, `WHATSAPP_WORKER_SECRET`, `PORT`.

**2. Akses database dari server lokal**
Kunci service-role tidak tersedia untuk diunduh, jadi endpoint worker/penjadwal di PC akan memakai satu akun layanan (email + password akun pemilik) untuk login ke backend dan bekerja dengan izin akun tersebut. Dibuat helper server tunggal yang dipakai oleh:
- `/api/public/whatsapp/pull`
- `/api/public/whatsapp/status`
- `/api/public/hooks/dispatch-reminders`

Ketiganya tetap dilindungi header `x-worker-secret`, dan penjadwal juga akan diverifikasi dengan secret yang sama.

**3. Folder `worker/` siap pakai**
- `worker/worker.js` — whatsapp-web.js: login QR, tarik pesan `queued`, kirim, laporkan status, retry.
- `worker/scheduler.js` — memanggil endpoint dispatch tiap menit (pengganti cron cloud saat jalan lokal).
- `worker/package.json`, `worker/.env.example`, `worker/README.md`.

**4. Satu klik + auto-start**
- `start-app.bat` — cek Node, install dependensi bila perlu, build, jalankan app + worker + scheduler, buka browser ke `http://localhost:3000`.
- `ecosystem.config.cjs` untuk pm2 (3 proses: app, worker, scheduler) + langkah `pm2-startup install` agar hidup otomatis setelah Windows restart.

**5. Halaman tutorial `/worker-setup` diperluas**
Menjadi panduan deploy lengkap Windows 10, semua blok kode bisa disalin:
1. Prasyarat (Node.js LTS, Git, Chrome, power settings jangan sleep)
2. Ambil kode proyek (GitHub / download ZIP) + `npm install`
3. Isi `.env` (dijelaskan tiap variabel; nilai `WHATSAPP_WORKER_SECRET` harus sama di app & worker)
4. `npm run build` lalu `npm start`, buka `http://localhost:3000`
5. Jalankan worker: `cd worker`, `npm install`, `node worker.js`, scan QR
6. Cara cepat: klik dua kali `start-app.bat`
7. Produksi 24/7 dengan pm2 (+ auto-start, `pm2 logs`)
8. Opsional: akses dari HP di jaringan yang sama (izinkan port di Windows Firewall)
9. Troubleshooting: port 3000 dipakai, 401 secret beda, QR minta scan ulang, Chrome tidak ditemukan, format nomor `62…@c.us`, antrean menumpuk

## Teknis

- `vite.config.ts`: tambah opsi preset Nitro `node-server` (tetap kompatibel dengan build/preview Lovable; diverifikasi dengan build lokal).
- Helper baru `src/lib/service-db.server.ts`: pakai `supabaseAdmin` bila `SUPABASE_SERVICE_ROLE_KEY` ada (mode hosting Lovable), jika tidak login `signInWithPassword` memakai `SERVICE_ACCOUNT_EMAIL`/`SERVICE_ACCOUNT_PASSWORD` dan cache sesinya. Tiga route API di atas memakai helper ini, bukan `supabaseAdmin` langsung.
- `dispatch-reminders` mulai memeriksa `x-worker-secret`; migrasi cron di database diperbarui agar tetap mengirim header itu, supaya versi web juga tetap jalan.
- File baru: `.env.example`, `start-app.bat`, `ecosystem.config.cjs`, folder `worker/`.
- Halaman panduan tetap publik di `/worker-setup` dengan `head()` sendiri; komponen `CodeBlock` yang sudah ada dipakai ulang.
- Tidak ada perubahan skema tabel.
