require("dotenv").config();
const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");

const APP_URL = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
const SECRET = process.env.WHATSAPP_WORKER_SECRET;
const INTERVAL = Number(process.env.POLL_INTERVAL_MS || 15000);

if (!SECRET) {
  console.error("WHATSAPP_WORKER_SECRET belum diisi di worker/.env");
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

client.on("auth_failure", (msg) => console.error("Autentikasi gagal:", msg));
client.on("disconnected", (reason) => console.warn("Terputus:", reason));

function toChatId(phone) {
  const digits = String(phone).replace(/\D/g, "").replace(/^0/, "62");
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

client.initialize();