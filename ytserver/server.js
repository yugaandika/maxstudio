// Server kecil: ambil audio YouTube (maks ~15 menit) lalu kirim ke web MAX STUDIO.
// Tidak menyimpan file apa pun; audio langsung dialirkan ke browser.
import http from "node:http";
import { spawn } from "node:child_process";
import { copyFileSync, existsSync } from "node:fs";

const PORT = Number(process.env.PORT || 10000);
// Alamat website yang boleh memanggil server ini (pisahkan dengan koma).
// Bisa diubah lewat environment variable ALLOWED_ORIGIN di SnapDeploy.
const ORIGINS = (
  process.env.ALLOWED_ORIGIN ||
  "https://maxstudio-cn9.pages.dev"
).split(",").map((s) => s.trim()).filter(Boolean);
const MAX_SEC = Number(process.env.MAX_SEC || 900);
const MAX_JOBS = 1; // server gratis kecil: satu lagu sekali jalan
const FIRST_BYTE_MS = 120000; // kalau 2 menit belum ada data, menyerah
const TOTAL_MS = 240000;
const HOSTS = ["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"];

// Opsional: cookies YouTube (Render > Secret Files > cookies.txt) kalau YouTube menolak server.
let cookieArgs = [];
if (existsSync("/etc/secrets/cookies.txt")) {
  copyFileSync("/etc/secrets/cookies.txt", "/tmp/cookies.txt");
  cookieArgs = ["--cookies", "/tmp/cookies.txt"];
}
const BASE = ["--no-playlist", "--no-warnings", "--js-runtimes", "node", ...cookieArgs];
const FORMAT = "bestaudio[ext=m4a]/bestaudio";

let jobs = 0;

function send(res, status, obj) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(obj));
}

function okUrl(s) {
  try {
    const u = new URL(s);
    return (u.protocol === "https:" || u.protocol === "http:") && HOSTS.includes(u.hostname);
  } catch { return false; }
}

function run(args, timeoutMs = 45000) {
  return new Promise((resolve, reject) => {
    const p = spawn("yt-dlp", args);
    let out = "", err = "";
    const t = setTimeout(() => p.kill("SIGKILL"), timeoutMs);
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("close", (code) => {
      clearTimeout(t);
      code === 0 ? resolve(out) : reject(new Error(err.slice(-400) || "yt-dlp gagal"));
    });
  });
}

function friendly(e) {
  const m = String(e.message || e);
  if (/sign in|bot|cookies/i.test(m)) return "YouTube menolak server ini (dianggap bot). Lihat petunjuk cookies di README.";
  if (/unavailable|private|removed/i.test(m)) return "Video tidak tersedia.";
  return "Gagal mengambil dari YouTube.";
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  if (ORIGINS.includes(origin)) res.setHeader("access-control-allow-origin", origin);
  res.setHeader("vary", "origin");
  res.setHeader("access-control-expose-headers", "x-title");
  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }
  const u = new URL(req.url, "http://x");

  if (u.pathname === "/health") return send(res, 200, { ok: true });

  if (u.pathname === "/search") {
    const q = (u.searchParams.get("q") || "").trim().slice(0, 100);
    if (!q) return send(res, 400, { error: "Ketik judul lagunya." });
    try {
      const out = await run([...BASE, "--flat-playlist", "--dump-json", "ytsearch5:" + q]);
      const list = out.split("\n").filter(Boolean).map((l) => JSON.parse(l))
        .filter((v) => !v.duration || v.duration <= MAX_SEC)
        .map((v) => ({ id: v.id, title: v.title, duration: v.duration || 0, channel: v.channel || v.uploader || "" }));
      return send(res, 200, list);
    } catch (e) { return send(res, 502, { error: friendly(e) }); }
  }

  if (u.pathname === "/info") {
    const link = u.searchParams.get("url") || "";
    if (!okUrl(link)) return send(res, 400, { error: "Link harus dari YouTube." });
    try {
      const r = await fetch("https://www.youtube.com/oembed?format=json&url=" + encodeURIComponent(link), { signal: AbortSignal.timeout(8000) });
      if (!r.ok) return send(res, 404, { error: "Video tidak ditemukan atau tidak bisa diakses." });
      const j = await r.json();
      return send(res, 200, { title: j.title || "", channel: j.author_name || "" });
    } catch (e) { return send(res, 502, { error: "Gagal membaca info video." }); }
  }

  if (u.pathname === "/audio") {
    const link = u.searchParams.get("url") || "";
    if (!okUrl(link)) return send(res, 400, { error: "Link harus dari YouTube." });
    if (jobs >= MAX_JOBS) return send(res, 429, { error: "Server sedang sibuk, coba lagi sebentar." });
    jobs++;
    const t0 = Date.now();
    let finished = false, started = false, timedOut = false, bytes = 0, err = "";
    const done = () => { if (!finished) { finished = true; jobs--; } };
    console.log("[audio] mulai " + link);
    // Satu kali jalan saja (hemat CPU): filter live/durasi dicek langsung oleh yt-dlp.
    const child = spawn("yt-dlp", [...BASE, "--match-filters", "!is_live & duration<=?" + MAX_SEC, "-f", FORMAT, "-o", "-", "--", link]);
    child.stderr.on("data", (d) => { err = (err + d).slice(-600); });
    const first = setTimeout(() => { if (!started) { timedOut = true; child.kill("SIGKILL"); } }, FIRST_BYTE_MS);
    const kill = setTimeout(() => { timedOut = true; child.kill("SIGKILL"); }, TOTAL_MS);
    child.stdout.on("data", (chunk) => {
      if (!started) {
        started = true; clearTimeout(first);
        const webm = chunk[0] === 0x1a && chunk[1] === 0x45 && chunk[2] === 0xdf && chunk[3] === 0xa3;
        res.writeHead(200, { "content-type": webm ? "audio/webm" : "audio/mp4", "cache-control": "no-store" });
        console.log("[audio] data pertama setelah " + Math.round((Date.now() - t0) / 1000) + " dtk");
      }
      bytes += chunk.length;
      if (!res.write(chunk)) { child.stdout.pause(); res.once("drain", () => child.stdout.resume()); }
    });
    child.on("close", (code) => {
      clearTimeout(first); clearTimeout(kill); done();
      console.log("[audio] selesai kode=" + code + " byte=" + bytes + " waktu=" + Math.round((Date.now() - t0) / 1000) + " dtk" + (code ? " err=" + err.slice(-200).replace(/\s+/g, " ") : ""));
      if (started) return res.end();
      if (res.headersSent) return res.end();
      if (timedOut) return send(res, 504, { error: "Terlalu lama diproses server, coba lagi." });
      if (/does not pass filter/i.test(err)) return send(res, 400, { error: "Live stream tidak didukung, atau lagu lebih panjang dari " + Math.round(MAX_SEC / 60) + " menit." });
      return send(res, 502, { error: friendly(new Error(err)) });
    });
    child.on("error", () => { done(); if (!res.headersSent) send(res, 502, { error: "Gagal menjalankan pengunduh." }); });
    res.on("close", () => child.kill("SIGKILL"));
    return;
  }

  send(res, 404, { error: "Tidak ditemukan" });
});

server.listen(PORT, () => console.log("ytserver jalan di port " + PORT));
