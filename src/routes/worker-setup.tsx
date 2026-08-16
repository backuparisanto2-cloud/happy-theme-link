import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, MonitorSmartphone } from "lucide-react";

import { CodeBlock } from "@/components/CodeBlock";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export const Route = createFileRoute("/worker-setup")({
  head: () => ({
    meta: [
      { title: "Panduan Worker WhatsApp di Windows 10" },
      {
        name: "description",
        content:
          "Langkah demi langkah menjalankan worker whatsapp-web.js di Windows 10 agar pengingat terkirim otomatis dari WA Reminder Studio.",
      },
      { property: "og:title", content: "Panduan Worker WhatsApp di Windows 10" },
      {
        property: "og:description",
        content:
          "Instal Node.js, siapkan .env dengan WHATSAPP_WORKER_SECRET, jalankan worker whatsapp-web.js, dan buat berjalan otomatis.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WorkerSetupPage,
});

const APP_URL = "https://project--9b50dee3-3ce3-4a3f-ab93-f56e4cefd9c1.lovable.app";

const genSecret = `-join ((48..57)+(97..102) | Get-Random -Count 64 | % {[char]$_})`;

const installCmds = `mkdir C:\\wa-worker
cd C:\\wa-worker
npm init -y
npm install whatsapp-web.js qrcode-terminal dotenv`;

const envFile = `APP_URL=${APP_URL}
WHATSAPP_WORKER_SECRET=tempel-nilai-yang-sama-dengan-di-aplikasi
POLL_INTERVAL_MS=15000`;

const workerJs = `require("dotenv").config();
const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");

const APP_URL = process.env.APP_URL.replace(/\\/$/, "");
const SECRET = process.env.WHATSAPP_WORKER_SECRET;
const INTERVAL = Number(process.env.POLL_INTERVAL_MS || 15000);

if (!SECRET) {
  console.error("WHATSAPP_WORKER_SECRET belum diisi di .env");
  process.exit(1);
}

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: "./.wwebjs_auth" }),
  puppeteer: { headless: true, args: ["--no-sandbox"] },
});

client.on("qr", (qr) => {
  console.log("Scan QR ini dari WhatsApp > Perangkat tertaut:");
  qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
  console.log("WhatsApp siap. Mulai polling pesan...");
  loop();
});

client.on("disconnected", (reason) => console.warn("Terputus:", reason));

function toChatId(phone) {
  const digits = String(phone).replace(/\\D/g, "").replace(/^0/, "62");
  return digits + "@c.us";
}

async function pull() {
  const res = await fetch(APP_URL + "/api/public/whatsapp/pull?limit=20", {
    headers: { "x-worker-secret": SECRET },
  });
  if (!res.ok) throw new Error("pull gagal: " + res.status + " " + (await res.text()));
  const body = await res.json();
  return body.messages || [];
}

async function report(results) {
  if (!results.length) return;
  const res = await fetch(APP_URL + "/api/public/whatsapp/status", {
    method: "POST",
    headers: { "content-type": "application/json", "x-worker-secret": SECRET },
    body: JSON.stringify({ results }),
  });
  if (!res.ok) console.error("status gagal:", res.status, await res.text());
}

async function tick() {
  const messages = await pull();
  if (!messages.length) return;
  console.log("Memproses", messages.length, "pesan");

  const results = [];
  for (const msg of messages) {
    try {
      await client.sendMessage(toChatId(msg.phone), msg.message);
      results.push({ id: msg.id, status: "sent" });
      console.log("terkirim ->", msg.phone);
    } catch (err) {
      const retry = (msg.attempts || 0) < 2;
      results.push({
        id: msg.id,
        status: retry ? "queued" : "failed",
        error: String(err && err.message ? err.message : err).slice(0, 900),
      });
      console.error("gagal ->", msg.phone, err);
    }
  }
  await report(results);
}

async function loop() {
  for (;;) {
    try {
      await tick();
    } catch (err) {
      console.error(err);
    }
    await new Promise((r) => setTimeout(r, INTERVAL));
  }
}

client.initialize();`;

const runCmd = `node worker.js`;

const pm2Cmds = `npm install -g pm2 pm2-windows-startup
pm2-startup install
pm2 start worker.js --name wa-worker
pm2 save`;

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-3 text-lg font-semibold text-foreground">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
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
          Windows 10
        </span>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Deploy worker whatsapp-web.js di Windows 10
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Aplikasi ini menjadwalkan dan mengantrekan pesan. Pengiriman dilakukan oleh worker
          whatsapp-web.js yang berjalan di komputer Anda sendiri, karena butuh browser (Puppeteer).
          Ikuti langkah di bawah sekali saja.
        </p>
      </header>

      <Separator className="my-8" />

      <div className="space-y-10">
        <Step n={1} title="Prasyarat">
          <ul className="list-disc space-y-1 pl-5">
            <li>Windows 10 (64-bit) dengan hak administrator</li>
            <li>
              Node.js LTS (18 atau lebih baru) dari nodejs.org — pilih installer .msi, centang
              &quot;Add to PATH&quot;
            </li>
            <li>Google Chrome terpasang</li>
            <li>Koneksi internet stabil dan komputer tidak sleep (Power Options → Never)</li>
            <li>WhatsApp aktif di HP untuk memindai QR</li>
          </ul>
          <p>Cek instalasi di PowerShell:</p>
          <CodeBlock label="PowerShell" code={"node -v\nnpm -v"} />
        </Step>

        <Step n={2} title="Siapkan nilai WHATSAPP_WORKER_SECRET">
          <p>
            Buat satu nilai acak kuat, lalu pakai nilai yang sama di dua tempat: form aman di aplikasi
            ini dan file <code>.env</code> worker.
          </p>
          <CodeBlock label="PowerShell" code={genSecret} />
          <p>
            Simpan hasilnya di password manager. Kalau nilainya berbeda antara aplikasi dan worker,
            endpoint akan menolak dengan 401.
          </p>
        </Step>

        <Step n={3} title="Buat folder worker dan install dependensi">
          <CodeBlock label="PowerShell" code={installCmds} />
        </Step>

        <Step n={4} title="Buat file .env">
          <p>
            Di folder <code>C:\wa-worker</code>, buat file bernama <code>.env</code> (Notepad → Save
            As → All files) dengan isi:
          </p>
          <CodeBlock label=".env" code={envFile} />
        </Step>

        <Step n={5} title="Buat file worker.js">
          <p>
            Buat <code>worker.js</code> di folder yang sama, lalu tempel kode berikut. Worker akan
            menarik pesan berstatus <code>queued</code>, mengirimnya, dan melaporkan hasilnya.
          </p>
          <CodeBlock label="worker.js" code={workerJs} />
        </Step>

        <Step n={6} title="Jalankan dan scan QR">
          <CodeBlock label="PowerShell" code={runCmd} />
          <p>
            QR akan muncul di terminal. Di HP: WhatsApp → Setelan → Perangkat tertaut → Tautkan
            perangkat. Setelah muncul &quot;WhatsApp siap&quot;, worker mulai polling. Sesi tersimpan di
            folder <code>.wwebjs_auth</code> sehingga tidak perlu scan ulang setiap restart.
          </p>
        </Step>

        <Step n={7} title="Jalankan otomatis 24/7">
          <p>Opsi A — pm2 (disarankan, auto-start saat Windows menyala):</p>
          <CodeBlock label="PowerShell (admin)" code={pm2Cmds} />
          <p>
            Cek log dengan <code>pm2 logs wa-worker</code>, restart dengan{" "}
            <code>pm2 restart wa-worker</code>.
          </p>
          <p>
            Opsi B — Task Scheduler: Create Task → Triggers: At log on → Actions: Start a program →
            Program <code>node</code>, Arguments <code>worker.js</code>, Start in{" "}
            <code>C:\wa-worker</code>.
          </p>
        </Step>
      </div>

      <Card className="mt-10">
        <CardHeader>
          <CardTitle className="text-base">Troubleshooting</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">401 Unauthorized</span> — nilai{" "}
            <code>WHATSAPP_WORKER_SECRET</code> di <code>.env</code> berbeda dengan yang tersimpan di
            aplikasi. Simpan ulang lewat form aman, lalu perbarui <code>.env</code>.
          </p>
          <p>
            <span className="font-medium text-foreground">Minta scan QR terus</span> — folder{" "}
            <code>.wwebjs_auth</code> terhapus atau dijalankan dari folder berbeda. Selalu jalankan dari{" "}
            <code>C:\wa-worker</code>.
          </p>
          <p>
            <span className="font-medium text-foreground">Chrome tidak ditemukan</span> — pasang Google
            Chrome, atau tambahkan{" "}
            <code>executablePath: &quot;C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe&quot;</code>{" "}
            pada opsi <code>puppeteer</code>.
          </p>
          <p>
            <span className="font-medium text-foreground">Pesan tidak sampai</span> — nomor harus format
            internasional tanpa tanda plus, mis. <code>62812xxxxxxx</code>; worker mengubahnya menjadi{" "}
            <code>62812xxxxxxx@c.us</code>.
          </p>
          <p>
            <span className="font-medium text-foreground">Antrean menumpuk</span> — pastikan worker
            berjalan dan komputer tidak sleep; cek Riwayat untuk status <code>queued</code>/
            <code>failed</code>.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}