// Perantara kecil ke server YouTube (SnapDeploy) supaya browser tidak kena masalah CORS.
// Melayani /api/yt/health, /search, /audio, /info. Tidak menyimpan apa pun.

const TARGET = "https://maxstudio-78341.containers.snapdeploy.app";
const ALLOWED = ["/health", "/search", "/audio", "/info"];

function json(status, obj) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

export async function onRequest({ request }) {
  if (request.method !== "GET") return json(405, { error: "Tidak diizinkan" });
  const url = new URL(request.url);
  const rest = url.pathname.replace(/^\/api\/yt/, "") || "/";
  if (!ALLOWED.includes(rest)) return json(403, { error: "Tidak diizinkan" });

  try {
    const up = await fetch(TARGET + rest + url.search, { headers: { accept: "*/*" } });
    const headers = new Headers();
    headers.set("content-type", up.headers.get("content-type") || "application/octet-stream");
    const title = up.headers.get("x-title");
    if (title) headers.set("x-title", title);
    headers.set("cache-control", "no-store");
    return new Response(up.body, { status: up.status, headers });
  } catch (e) {
    return json(502, { error: "Server YouTube belum bisa dihubungi, coba lagi sebentar." });
  }
}
