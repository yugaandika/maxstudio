// Server kecil: ambil audio YouTube (maks ~10 menit) lalu kirim ke web MAX STUDIO.
// Tidak menyimpan file apa pun; audio langsung dialirkan ke browser.
import http from "node:http";
import { spawn } from "node:child_process";
import { copyFileSync, existsSync } from "node:fs";

const PORT = Number(process.env.PORT || 10000);
const ORIGIN = process.env.ALLOWED_ORIGIN || "https://maxstudio-ym3g.netlify.app";
const MAX_SEC = Number(process.env.MAX_SEC || 660);
const MAX_JOBS = 2;
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
  res.setHeader("access-control-allow-origin", ORIGIN);
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

  if (u.pathname === "/audio") {
    const link = u.searchParams.get("url") || "";
    if (!okUrl(link)) return send(res, 400, { error: "Link harus dari YouTube." });
    if (jobs >= MAX_JOBS) return send(res, 429, { error: "Server sedang sibuk, coba lagi sebentar." });
    jobs++;
    let child = null;
    let finished = false;
    const done = () => { if (!finished) { finished = true; jobs--; } };
    try {
      const info = JSON.parse(await run([...BASE, "-f", FORMAT, "--dump-single-json", "--", link]));
      if (info.is_live) { done(); return send(res, 400, { error: "Live stream tidak didukung." }); }
      if (info.duration > MAX_SEC) { done(); return send(res, 400, { error: "Lagu terlalu panjang (maks " + Math.round(MAX_SEC / 60) + " menit)." }); }
      const type = info.ext === "webm" ? "audio/webm" : "audio/mp4";
      res.writeHead(200, { "content-type": type, "x-title": encodeURIComponent(info.title || "youtube") });
      child = spawn("yt-dlp", [...BASE, "-f", FORMAT, "-o", "-", "--", link]);
      const kill = setTimeout(() => child.kill("SIGKILL"), 120000);
      child.stdout.pipe(res);
      child.on("close", () => { clearTimeout(kill); done(); res.end(); });
      res.on("close", () => child.kill("SIGKILL"));
    } catch (e) {
      done();
      if (!res.headersSent) return send(res, 502, { error: friendly(e) });
      res.end();
    }
    return;
  }

  send(res, 404, { error: "Tidak ditemukan" });
});

server.listen(PORT, () => console.log("ytserver jalan di port " + PORT));
