require("dotenv").config();

// Pengganti cron cloud saat aplikasi berjalan lokal: memicu endpoint dispatch
// agar pengingat yang jatuh tempo masuk ke antrean pengiriman.
const APP_URL = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
const SECRET = process.env.WHATSAPP_WORKER_SECRET;
const INTERVAL = Number(process.env.SCHEDULER_INTERVAL_MS || 60000);

if (!SECRET) {
  console.error("WHATSAPP_WORKER_SECRET belum diisi di worker/.env");
  process.exit(1);
}

async function tick() {
  const res = await fetch(APP_URL + "/api/public/hooks/dispatch-reminders", {
    method: "POST",
    headers: { "content-type": "application/json", "x-worker-secret": SECRET },
    body: "{}",
  });
  const text = await res.text();
  if (!res.ok) throw new Error("dispatch gagal: " + res.status + " " + text);
  console.log(new Date().toISOString(), "dispatch:", text);
}

async function loop() {
  for (;;) {
    try {
      await tick();
    } catch (err) {
      console.error(err.message || err);
    }
    await new Promise((r) => setTimeout(r, INTERVAL));
  }
}

loop();