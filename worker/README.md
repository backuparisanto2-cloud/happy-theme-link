# Worker WhatsApp (whatsapp-web.js)

Dua proses kecil untuk dijalankan di komputer Windows 10 Anda:

- `worker.js` — login WhatsApp via QR, menarik pesan berstatus `queued` dari aplikasi, mengirimnya, lalu melaporkan hasilnya.
- `scheduler.js` — memicu endpoint penjadwal tiap menit (dibutuhkan saat aplikasi dijalankan lokal).

## Cara pakai

```
cd worker
copy .env.example .env
npm install
node worker.js        (scan QR sekali)
node scheduler.js     (jendela terminal terpisah)
```

`WHATSAPP_WORKER_SECRET` di `worker/.env` harus sama dengan nilai di `.env` aplikasi.
Sesi WhatsApp tersimpan di `worker/.wwebjs_auth`, jadi tidak perlu scan ulang setiap restart.

Panduan lengkap ada di halaman `/worker-setup` pada aplikasi.