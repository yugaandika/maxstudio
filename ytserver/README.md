# Server YouTube MAX STUDIO

1. Di GitHub, folder `ytserver` ini ikut di-commit bersama web-mu.
2. Buka render.com, buat akun, New > Web Service, pilih repo `maxstudio`.
3. Root Directory: `ytserver`. Runtime: Docker. Instance: Free. Deploy.
4. Setelah jadi, salin URL-nya (contoh: https://maxstudio-yt.onrender.com).
5. Buka `app2.js`, ganti `GANTI-DENGAN-URL-SERVER-KAMU.onrender.com` dengan URL itu, commit. Netlify otomatis update.
6. Cek `URL-server/health`, harus muncul {"ok":true}.

Kalau YouTube menolak server (muncul pesan "dianggap bot"): ekspor cookies.txt dari browser,
lalu di Render > Environment > Secret Files, buat file `cookies.txt` (path /etc/secrets/cookies.txt).
Server gratis Render tidur kalau lama tidak dipakai, jadi permintaan pertama bisa sampai 30 detik.
