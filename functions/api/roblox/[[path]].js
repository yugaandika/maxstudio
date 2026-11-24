// Perantara kecil ke Roblox supaya tidak diblokir CORS.
// API key hanya diteruskan, tidak disimpan dan tidak dicatat.
// Versi Cloudflare Pages Functions (menggantikan netlify/functions/roblox.mjs).
// Melayani semua alamat /api/roblox/*

const ALLOWED = ["assets/v1/", "api-keys/v1/introspect", "cloud/v2/users/"];
// Foto profil (headshot) pemain, dipakai untuk avatar akun.
const THUMB = "thumbs/v1/users/avatar-headshot";
const THUMB_IDS = /^\d{1,20}(,\d{1,20}){0,9}$/;

export async function onRequest({ request }) {
  const req = request;
  const url = new URL(req.url);
  const rest = url.pathname.replace(/^\/api\/roblox\//, "");
  if (rest.includes("..")) return new Response("Tidak diizinkan", { status: 403 });

  if (rest === THUMB) {
    if (req.method !== "GET" || !THUMB_IDS.test(url.searchParams.get("userIds") || "")) {
      return new Response("Tidak diizinkan", { status: 403 });
    }
    const q = new URLSearchParams({
      userIds: url.searchParams.get("userIds"),
      size: "150x150",
      format: "Png",
      isCircular: "false",
    });
    try {
      const up = await fetch("https://thumbnails.roblox.com/v1/users/avatar-headshot?" + q);
      return new Response(up.body, {
        status: up.status,
        headers: {
          "content-type": up.headers.get("content-type") || "application/json",
          "cache-control": "public, max-age=600",
        },
      });
    } catch (e) {
      return new Response(JSON.stringify({ message: "Gagal menghubungi Roblox" }), {
        status: 502,
        headers: { "content-type": "application/json" },
      });
    }
  }

  if (!ALLOWED.some((p) => rest.startsWith(p))) {
    return new Response("Tidak diizinkan", { status: 403 });
  }
  const headers = {};
  const key = req.headers.get("x-api-key");
  if (key) headers["x-api-key"] = key;
  const ct = req.headers.get("content-type");
  if (ct) headers["content-type"] = ct;

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  try {
    const up = await fetch("https://apis.roblox.com/" + rest + url.search, {
      method: req.method,
      headers,
      body: hasBody ? await req.arrayBuffer() : undefined,
    });
    return new Response(up.body, {
      status: up.status,
      headers: { "content-type": up.headers.get("content-type") || "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ message: "Gagal menghubungi Roblox" }), {
      status: 502,
      headers: { "content-type": "application/json" },
    });
  }
}
