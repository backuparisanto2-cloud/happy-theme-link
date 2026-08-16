# Simpan WHATSAPP_WORKER_SECRET + Tutorial Worker di Windows 10

## 1. Simpan secret dengan aman

Saya buka form aman untuk `WHATSAPP_WORKER_SECRET`. Nilainya harus Anda buat sendiri (bukan digenerate sistem), karena nilai yang sama harus dipakai di worker whatsapp-web.js Anda.

Cara membuat nilai acak kuat di Windows 10 (PowerShell):

```text
-join ((48..57)+(97..102) | Get-Random -Count 64 | % {[char]$_})
```

Salin hasilnya ke dua tempat:
- form aman di Lovable (jadi environment variable backend)
- file `.env` worker di komputer/server Anda

Endpoint yang memakai secret ini (header `x-worker-secret`) sudah ada:
- `GET /api/public/whatsapp/pull`
- `POST /api/public/whatsapp/status`

## 2. Halaman tutorial di aplikasi

Tambahkan halaman baru `/worker-setup` (tertaut dari Pengaturan → kartu "Koneksi WhatsApp") berisi panduan langkah demi langkah khusus Windows 10:

- Prasyarat: Node.js LTS, Google Chrome, koneksi internet stabil
- Buat folder worker, `npm init -y`, install `whatsapp-web.js qrcode-terminal dotenv`
- Isi `.env`: `APP_URL`, `WHATSAPP_WORKER_SECRET`, `POLL_INTERVAL_MS`
- Kode `worker.js` lengkap (bisa dicopy): login QR, polling `pull`, kirim pesan, lapor ke `status`, retry sederhana
- Jalankan: `node worker.js`, scan QR dari WhatsApp di HP
- Jalankan terus-menerus: opsi `pm2` + `pm2-windows-startup`, atau Task Scheduler saat login
- Troubleshooting: 401 (secret beda), sesi hilang (`.wwebjs_auth`), Chrome tidak ditemukan, nomor format `62…@c.us`

Semua blok kode punya tombol salin.

## Teknis

- Route baru `src/routes/worker-setup.tsx` (publik, agar bisa dibuka saat setting server), dengan `head()` sendiri: judul/deskripsi/og khusus panduan worker.
- Komponen kecil `src/components/CodeBlock.tsx` untuk blok kode + tombol salin (pakai token tema, tanpa warna hardcoded).
- Di `src/routes/_authenticated/settings.tsx`, tambahkan tombol/link "Panduan setup worker (Windows)" pada kartu Koneksi WhatsApp; teks endpoint yang sudah ada dipertahankan.
- Tidak ada perubahan skema database atau logika penjadwalan.
