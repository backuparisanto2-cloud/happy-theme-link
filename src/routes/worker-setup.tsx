import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, MonitorSmartphone } from "lucide-react";
import type { ReactNode } from "react";

import { CodeBlock } from "@/components/CodeBlock";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export const Route = createFileRoute("/worker-setup")({
  head: () => ({
    meta: [
      { title: "Panduan Deploy di Windows 10 — WA Reminder Studio" },
      {
        name: "description",
        content:
          "Jalankan aplikasi pengingat WhatsApp 100% di Windows 10 dengan npm: build, worker whatsapp-web.js, penjadwal, dan auto-start pm2.",
      },
      { property: "og:title", content: "Panduan Deploy di Windows 10 — WA Reminder Studio" },
      {
        property: "og:description",
        content:
          "Langkah demi langkah: npm install, .env, npm run build:win, worker whatsapp-web.js, start-app.bat, dan pm2 auto-start.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WorkerSetupPage,
});

const genSecret = `-join ((48..57)+(97..102) | Get-Random -Count 64 | % {[char]$_})`;

const getCode = `git clone <url-repo-anda> wa-reminder
cd wa-reminder
npm install`;

const envSteps = `copy .env.example .env
notepad .env`;

const envFile = `SUPABASE_URL=https://ogghzxgocxtcmkhvqufs.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_HTPVxeLRxkm1J2z5tzOBaQ_N4pcQvns
VITE_SUPABASE_URL=https://ogghzxgocxtcmkhvqufs.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_HTPVxeLRxkm1J2z5tzOBaQ_N4pcQvns

SERVICE_ACCOUNT_EMAIL=email-akun-anda@contoh.com
SERVICE_ACCOUNT_PASSWORD=password-akun-anda

WHATSAPP_WORKER_SECRET=nilai-acak-64-karakter
PORT=3000`;

const buildRun = `npm run build:win
npm start`;

const workerRun = `cd worker
copy .env.example .env
notepad .env
npm install
node worker.js`;

const workerEnv = `APP_URL=http://localhost:3000
WHATSAPP_WORKER_SECRET=nilai-acak-64-karakter-yang-sama
POLL_INTERVAL_MS=15000
SCHEDULER_INTERVAL_MS=60000`;

const schedulerRun = `cd worker
node scheduler.js`;

const pm2Cmds = `npm install -g pm2 pm2-windows-startup
pm2-startup install
npm run build:win
pm2 start ecosystem.config.cjs
pm2 save

pm2 status
pm2 logs wa-worker`;

const firewallCmd = `netsh advfirewall firewall add rule name="WA Reminder 3000" dir=in action=allow protocol=TCP localport=3000
ipconfig`;

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-3 text-lg font-semibold text-foreground">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
          {n}
        </span>
        {title}
      </h2>
      <div className="space-y-3 pl-10 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

function WorkerSetupPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <Link
        to="/settings"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Kembali ke Pengaturan
      </Link>

      <header className="mt-6 space-y-3">
        <span className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
          <MonitorSmartphone className="h-3.5 w-3.5" />
          Windows 10 · npm
        </span>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Deploy aplikasi di Windows 10
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Tiga proses berjalan di PC Anda: <span className="font-medium text-foreground">aplikasi web</span>{" "}
          (Node), <span className="font-medium text-foreground">worker</span> whatsapp-web.js sebagai
          pengirim, dan <span className="font-medium text-foreground">penjadwal</span> yang memicu pengingat
          jatuh tempo. Database &amp; login tetap di backend cloud, jadi data sama dengan versi web.
        </p>
      </header>

      <Separator className="my-8" />

      <div className="space-y-10">
        <Step n={1} title="Prasyarat">
          <ul className="list-disc space-y-1 pl-5">
            <li>Windows 10 64-bit, akun dengan hak administrator</li>
            <li>Node.js LTS 20 atau lebih baru (installer .msi dari nodejs.org, centang Add to PATH)</li>
            <li>Git for Windows (opsional, kalau mau clone repo)</li>
            <li>Google Chrome (dipakai worker WhatsApp)</li>
            <li>Setelan daya: Control Panel → Power Options → Sleep = Never</li>
          </ul>
          <CodeBlock label="PowerShell" code={"node -v\nnpm -v"} />
        </Step>

        <Step n={2} title="Ambil kode dan install dependensi">
          <p>Clone repo proyek (atau download ZIP lalu extract), kemudian:</p>
          <CodeBlock label="PowerShell" code={getCode} />
        </Step>

        <Step n={3} title="Buat nilai WHATSAPP_WORKER_SECRET">
          <p>Satu nilai acak, dipakai di dua file: <code>.env</code> aplikasi dan <code>worker/.env</code>.</p>
          <CodeBlock label="PowerShell" code={genSecret} />
          <p>
            Simpan di password manager. Kalau berbeda, worker akan menerima 401. Setelah aplikasi berjalan
            (langkah 5), Anda juga bisa memakai{" "}
            <Link to="/worker-secret" className="font-medium text-foreground underline underline-offset-4">
              wizard secret worker
            </Link>{" "}
            di dalam aplikasi: nilai acak dibuat dan langsung ditulis ke <code>.env</code> dan{" "}
            <code>worker/.env</code> sekaligus, lalu divalidasi agar tidak mismatch.
          </p>
        </Step>

        <Step n={4} title="Isi file .env aplikasi">
          <CodeBlock label="PowerShell" code={envSteps} />
          <CodeBlock label=".env" code={envFile} />
          <p>
            <code>SERVICE_ACCOUNT_EMAIL</code> dan <code>SERVICE_ACCOUNT_PASSWORD</code> adalah akun login
            aplikasi Anda sendiri — dipakai server lokal untuk membaca pengingat dan menulis antrean pesan.
          </p>
        </Step>

        <Step n={5} title="Build dan jalankan aplikasi">
          <CodeBlock label="PowerShell" code={buildRun} />
          <p>
            Buka <code>http://localhost:3000</code> lalu login. Perintah <code>build:win</code> menghasilkan
            server Node biasa, jadi tidak butuh Docker atau layanan cloud apa pun.
          </p>
        </Step>

        <Step n={6} title="Jalankan worker WhatsApp dan scan QR">
          <p>Buka terminal baru:</p>
          <CodeBlock label="PowerShell" code={workerRun} />
          <CodeBlock label="worker/.env" code={workerEnv} />
          <p>
            QR muncul di terminal → di HP: WhatsApp → Setelan → Perangkat tertaut → Tautkan perangkat.
            Setelah muncul &quot;WhatsApp siap&quot;, worker mulai mengambil pesan. Sesi tersimpan di{" "}
            <code>worker/.wwebjs_auth</code> sehingga tidak perlu scan ulang.
          </p>
        </Step>

        <Step n={7} title="Jalankan penjadwal">
          <p>Terminal ketiga — ini yang mengubah pengingat jatuh tempo menjadi pesan di antrean:</p>
          <CodeBlock label="PowerShell" code={schedulerRun} />
        </Step>

        <Step n={8} title="Cara cepat: start-app.bat">
          <p>
            Klik dua kali <code>start-app.bat</code> di folder proyek. Script akan memeriksa Node, install
            dependensi bila perlu, build, membuka tiga jendela (App, Worker, Scheduler), lalu membuka browser.
            Scan QR di jendela Worker pada pemakaian pertama.
          </p>
        </Step>

        <Step n={9} title="Produksi 24/7 dengan pm2">
          <CodeBlock label="PowerShell (Run as administrator)" code={pm2Cmds} />
          <p>
            Ketiga proses hidup otomatis setiap Windows dinyalakan. Restart dengan{" "}
            <code>pm2 restart all</code>, hentikan dengan <code>pm2 stop all</code>.
          </p>
        </Step>

        <Step n={10} title="Opsional: akses dari HP di Wi-Fi yang sama">
          <CodeBlock label="PowerShell (admin)" code={firewallCmd} />
          <p>
            Buka <code>http://IPV4-PC-ANDA:3000</code> dari HP. Jangan ekspos port ini ke internet tanpa
            HTTPS dan pembatasan akses.
          </p>
        </Step>
      </div>

      <Card className="mt-10">
        <CardHeader>
          <CardTitle className="text-base">Troubleshooting</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">Port 3000 dipakai</span> — ubah <code>PORT</code>{" "}
            di <code>.env</code> (mis. 3100) dan <code>APP_URL</code> di <code>worker/.env</code>.
          </p>
          <p>
            <span className="font-medium text-foreground">401 Unauthorized</span> —{" "}
            <code>WHATSAPP_WORKER_SECRET</code> berbeda antara <code>.env</code> dan{" "}
            <code>worker/.env</code>. Samakan lalu restart keduanya.
          </p>
          <p>
            <span className="font-medium text-foreground">Service account sign-in failed</span> — email atau
            password di <code>.env</code> salah, atau akun tersebut belum pernah dibuat di halaman login.
          </p>
          <p>
            <span className="font-medium text-foreground">Minta scan QR terus</span> — folder{" "}
            <code>worker/.wwebjs_auth</code> terhapus atau worker dijalankan dari folder lain. Selalu
            jalankan dari folder <code>worker</code>.
          </p>
          <p>
            <span className="font-medium text-foreground">Chrome tidak ditemukan</span> — pasang Google
            Chrome, atau tambahkan{" "}
            <code>executablePath: &quot;C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe&quot;</code>{" "}
            pada opsi <code>puppeteer</code> di <code>worker/worker.js</code>.
          </p>
          <p>
            <span className="font-medium text-foreground">Pesan tidak terkirim</span> — nomor harus format
            internasional tanpa plus, mis. <code>62812xxxxxxx</code>; worker mengubahnya menjadi{" "}
            <code>62812xxxxxxx@c.us</code>. Cek halaman Riwayat untuk status <code>queued</code>/
            <code>failed</code>.
          </p>
          <p>
            <span className="font-medium text-foreground">Antrean tidak jalan</span> — pastikan{" "}
            <code>scheduler.js</code> hidup dan PC tidak sleep.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}