# Impor Proyek dari GitHub: formal-green-theme

Repo `backuparisanto2-cloud/formal-green-theme` sudah dibaca. Isinya proyek Lovable (TanStack Start + Tailwind + shadcn) berupa **penjadwal reminder WhatsApp** dengan database, autentikasi, dan endpoint publik.

Catatan: Lovable belum bisa meng-import repo GitHub yang sudah ada ke sebuah proyek. Yang bisa dilakukan: menyalin seluruh kode repo itu ke proyek ini, lalu (opsional) menyambungkan proyek ini ke GitHub lewat menu + > GitHub agar sinkron dua arah ke repo baru.

## Yang akan dibuat ulang di proyek ini

- Halaman login/daftar (`/auth`) dan area terproteksi:
  - Dashboard ringkasan
  - Kontak (kelola daftar penerima)
  - Reminder (buat/edit jadwal pengingat)
  - Log pengiriman
  - Pengaturan
- Endpoint publik integrasi WhatsApp: ambil pesan keluar, update status, dan pemicu pengiriman terjadwal (cron)
- Logika penjadwalan (kapan reminder berikutnya jatuh tempo)
- Komponen UI shadcn + tema hijau formal dari repo

## Backend

Repo memakai backend Lovable Cloud proyek lama, jadi datanya tidak ikut. Langkahnya:
1. Aktifkan Lovable Cloud di proyek ini (database, auth, secrets baru).
2. Jalankan ulang skema dari `supabase/migrations` repo (tabel kontak, reminder, log, pengaturan, roles + RLS/GRANT) sebagai migrasi baru di sini.
3. Isi ulang secret integrasi WhatsApp yang dibutuhkan (kunci dari `.env` repo lama tidak dipakai).

Akun dan data lama (kontak, reminder, log) tidak terbawa — mulai kosong.

## Teknis

- Ambil file via GitHub API (repo publik) dan tulis ke path aslinya: `src/routes/`, `src/components/`, `src/hooks/`, `src/lib/`; `src/integrations/supabase/*` dihasilkan ulang oleh Cloud, bukan disalin mentah.
- `src/routes/index.tsx` placeholder diganti: `/` mengarah ke area terproteksi seperti di repo (`_authenticated/index.tsx`).
- `package.json` dibandingkan dan dependensi yang kurang di-install; `bun.lock` tidak disalin.
- `src/styles.css` diganti token tema dari repo.
- Endpoint publik tetap di `src/routes/api/public/*` dengan verifikasi caller.
- Metadata head per halaman disesuaikan (judul/deskripsi aplikasi reminder).