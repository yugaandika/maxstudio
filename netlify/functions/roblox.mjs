// Perantara kecil ke Roblox Open Cloud supaya tidak diblokir CORS.
// API key hanya diteruskan, tidak disimpan dan tidak dicatat.
export const config = { path: "/api/roblox/*" };

const ALLOWED = ["assets/v1/", "api-keys/v1/introspect", "cloud/v2/users/"];

export default async (req) => {
  const url = new URL(req.url);
  const rest = url.pathname.replace(/^\/api\/roblox\//, "");
  if (!ALLOWED.some((p) => rest.startsWith(p)) || rest.includes("..")) {
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
};
