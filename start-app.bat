@echo off
setlocal
title WA Reminder Studio - Windows launcher
cd /d "%~dp0"

echo === WA Reminder Studio: launcher Windows ===

where node >nul 2>nul
if errorlevel 1 (
  echo [X] Node.js tidak ditemukan. Install Node.js LTS dari https://nodejs.org lalu jalankan ulang file ini.
  pause
  exit /b 1
)

if not exist ".env" (
  echo [X] File .env belum ada. Salin .env.example menjadi .env dan isi nilainya.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [1/4] Install dependensi aplikasi...
  call npm install || goto :error
)

if not exist "worker\node_modules" (
  echo [2/4] Install dependensi worker...
  pushd worker
  call npm install || goto :error
  popd
)

echo [3/4] Build aplikasi...
set NITRO_PRESET=node-server
call npm run build || goto :error

echo [4/4] Menjalankan aplikasi, worker, dan penjadwal...
start "WA App" cmd /k "cd /d %~dp0 && set NITRO_PRESET=node-server&& npm start"
timeout /t 6 /nobreak >nul
start "WA Worker" cmd /k "cd /d %~dp0worker && node worker.js"
start "WA Scheduler" cmd /k "cd /d %~dp0worker && node scheduler.js"

timeout /t 3 /nobreak >nul
start "" http://localhost:3000

echo.
echo Selesai. Tiga jendela terminal terbuka: App, Worker (scan QR di sini), Scheduler.
echo Tutup jendela-jendela itu untuk menghentikan aplikasi.
pause
exit /b 0

:error
echo.
echo [X] Terjadi kesalahan. Baca pesan di atas.
pause
exit /b 1