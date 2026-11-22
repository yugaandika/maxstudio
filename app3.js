  var LS = 'maxstudio.roblox', API = '/api/roblox/assets/v1/';
  try { var sv = JSON.parse(localStorage.getItem(LS) || 'null'); if (sv){ ukey.value = sv.k || ''; uid.value = sv.u || ''; } } catch(e){}
  function saveCreds(){
    try {
      if (urem.checked) localStorage.setItem(LS, JSON.stringify({ k: ukey.value.trim(), u: uid.value.trim() }));
      else localStorage.removeItem(LS);
    } catch(e){}
  }
  urem.addEventListener('change', saveCreds);
  ukey.addEventListener('change', function(){ saveCreds(); checkAcct(); });
  uid.addEventListener('change', function(){ saveCreds(); checkAcct(); });
  $('acheck').addEventListener('click', function(){ saveCreds(); checkAcct(); });
  function upStatus(msg, err){ ustat.textContent = msg; ustat.className = 'status' + (err ? ' err' : ''); }
  function upReady(){ upgo.disabled = !lastBlob || upBusy; }
  /* cek akun: introspect API key (tidak memakai kuota upload) */
  function aStatus(msg, err){ var el = $('astatus'); el.textContent = msg; el.className = 'status' + (err ? ' err' : ''); }
  var chkTok = 0;
  async function checkAcct(){
    var key = ukey.value.trim(), tok = ++chkTok, j;
    if (!key){ aStatus('Isi API key, akun dicek otomatis.'); return; }
    aStatus('Mengecek akun...');
    try {
      var r = await fetch('/api/roblox/api-keys/v1/introspect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey: key }) });
      j = await r.json().catch(function(){ return null; });
      if (tok !== chkTok) return;
      if (!r.ok || !j){ aStatus('Key ditolak atau tidak bisa dipakai dari jaringan ini. Cek key dan pengaturan IP-nya.', true); return; }
    } catch(e){
      if (tok === chkTok) aStatus('Key belum bisa dicek dari browser (CORS). Kamu tetap bisa coba langsung lewat Upload ke Roblox.');
      return;
    }
    if (j.enabled === false){ aStatus('Key nonaktif. Aktifkan di Creator Dashboard.', true); return; }
    if (j.expired){ aStatus('Key sudah kedaluwarsa. Buat atau perpanjang di Creator Dashboard.', true); return; }
    var owner = String(j.authorizedUserId || '');
    var sc = (j.scopes || []).filter(function(x){ return x.name === 'asset'; })[0];
    var ops = (sc && sc.operations) || [];
    if (ops.indexOf('write') < 0){ aStatus('Key belum punya izin Assets dengan operasi Write. Tambahkan di Creator Dashboard.', true); return; }
    if (!uid.value.trim() && owner){ uid.value = owner; saveCreds(); }
    var mine = uid.value.trim();
    if (owner && mine !== owner){ aStatus('User ID tidak cocok. Pemilik key ini punya ID ' + owner + '. Ganti User ID-nya.', true); return; }
    var perm = ops.indexOf('read') >= 0 ? 'Read dan Write aktif.' : 'Write aktif. Tambahkan Read supaya status moderasi bisa dipantau.';
    aStatus('Terhubung. Akun ID ' + mine + ', izin Assets ' + perm);
    try {
      var ur = await fetch('/api/roblox/cloud/v2/users/' + mine, { headers: { 'x-api-key': key } });
      if (ur.ok){ var u = await ur.json(); if (tok === chkTok && u && u.name) aStatus('Terhubung sebagai ' + u.name + ' (ID ' + mine + '). Izin Assets ' + perm); }
    } catch(e){}
  }

  var resUrl = null;
  function clearResult(){
    lastBlob = null; lastName = '';
    var ra = $('raudio'); ra.pause(); ra.removeAttribute('src'); ra.load();
    if (resUrl){ URL.revokeObjectURL(resUrl); resUrl = null; }
    resetMod(); $('res').hidden = true; upStatus(''); upReady();
  }
  function setExported(blob, name, code){
    lastBlob = blob; lastName = name;
    if (resUrl) URL.revokeObjectURL(resUrl);
    resUrl = URL.createObjectURL(blob);
    $('raudio').src = resUrl;
    $('upfile').textContent = name + ' (' + fmtSize(blob.size) + ')';
    $('rnote').textContent = 'Ini file hasil konversi, jadi terdengar dengan speed baru. Di Roblox set PlaybackSpeed = ' + code + ' supaya suaranya normal.';
    uname.value = name.replace(/\.[^.]+$/, '').slice(0, 50);
    resetMod(); $('res').hidden = false; upStatus(''); upReady();
  }
  $('dl').addEventListener('click', function(){ if (lastBlob) save(lastBlob, lastName); });
  var wait = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  function apiMsg(r, j){
    var m = (j && (j.message || (j.error && j.error.message))) || '';
    if (r.status === 401) return 'API key ditolak. Cek lagi key-nya.';
    if (r.status === 403) return 'Izin ditolak. Pastikan key punya izin Assets (Read dan Write), alamat IP diizinkan, dan User ID benar.';
    if (r.status === 429) return 'Terlalu banyak upload, atau kuota bulanan habis.';
    return 'Roblox menolak (kode ' + r.status + '). ' + m;
  }
  /* pantau status moderasi: cek tiap 5 detik, maksimal 3 menit, berhenti sendiri saat ada hasil */
  var modId = '', modTok = 0;
  function mStatus(msg, err){ var el = $('mstatus'); el.textContent = msg; el.className = 'status' + (err ? ' err' : ''); }
  function resetMod(){ modTok++; modId = ''; $('mod').hidden = true; mStatus(''); }
  async function fetchMod(){
    var r = await fetch(API + 'assets/' + modId, { headers: { 'x-api-key': ukey.value.trim() } });
    var j = await r.json().catch(function(){ return {}; });
    if (!r.ok) return { err: r.status === 403 ? 'Key belum punya izin Assets Read, jadi status belum bisa dicek. Tambahkan izin Read di Creator Dashboard.' : apiMsg(r, j) };
    return { st: (j.moderationResult && j.moderationResult.moderationState) || 'Reviewing' };
  }
  async function watchMod(){
    if (!modId) return;
    var tok = ++modTok;
    $('mod').hidden = false; mStatus('Menunggu moderasi...');
    for (var i = 0; i < 36; i++){
      var o;
      try { o = await fetchMod(); } catch(e){ o = { err: 'Status belum bisa dicek (koneksi atau CORS). Coba klik Cek status.' }; }
      if (tok !== modTok) return;
      if (o.err){ mStatus(o.err, true); return; }
      if (o.st === 'Approved'){ mStatus('Diterima, siap dipakai (rbxassetid://' + modId + ')'); return; }
      if (o.st === 'Rejected'){ mStatus('Ditolak', true); return; }
      mStatus('Menunggu moderasi...');
      await wait(5000);
      if (tok !== modTok) return;
    }
    mStatus('Masih menunggu moderasi. Klik Cek status nanti.');
  }
  $('mcheck').addEventListener('click', watchMod);

  async function doUpload(){
    if (!lastBlob || upBusy) return;
    var key = ukey.value.trim(), id = uid.value.trim();
    if (!key){ upStatus('Isi API key dulu.', true); return; }
    if (!/^\d+$/.test(id)){ upStatus('User ID harus angka saja. Lihat di URL profilmu: roblox.com/users/ANGKA/profile.', true); return; }
    if (lastBlob.size > 20 * 1048576){ upStatus('File lebih dari 20 MB, Roblox akan menolak. Konversi ulang dengan kualitas Hemat.', true); return; }
    saveCreds(); resetMod(); upBusy = true; upReady();
    try {
      upStatus('Mengupload ke Roblox...');
      var fd = new FormData();
      fd.append('request', JSON.stringify({
        assetType: 'Audio',
        displayName: (uname.value.trim() || lastName).slice(0, 50),
        description: 'Dibuat dengan MAX STUDIO PLAYBACKSPEED',
        creationContext: { creator: { userId: id } }
      }));
      fd.append('fileContent', new Blob([lastBlob], { type: /\.wav$/.test(lastName) ? 'audio/wav' : 'audio/ogg' }), lastName);
      var res = await fetch(API + 'assets', { method: 'POST', headers: { 'x-api-key': key }, body: fd });
      var op = await res.json().catch(function(){ return {}; });
      if (!res.ok){ upStatus(apiMsg(res, op), true); return; }
      upStatus('Diproses Roblox...');
      var assetId = '';
      for (var i = 0; i < 30; i++){
        if (op.done){
          if (op.error){ upStatus('Upload ditolak: ' + (op.error.message || 'alasan tidak diketahui'), true); return; }
          var rp = op.response || {};
          assetId = String(rp.assetId || String(rp.path || '').split('/')[1] || '');
          break;
        }
        await wait(2000);
        var r2 = await fetch(API + op.path, { headers: { 'x-api-key': key } });
        op = await r2.json().catch(function(){ return {}; });
        if (!r2.ok){ upStatus(apiMsg(r2, op), true); return; }
      }
      if (assetId){ upStatus('Berhasil diupload. Asset ID: ' + assetId + '.'); modId = assetId; watchMod(); }
      else upStatus('Masih diproses Roblox. Cek di Creator Dashboard, Development Items, Audio.');
    } catch(e){
      upStatus('Terblokir browser (CORS) atau internet putus. Coba sekali lagi. Kalau tetap gagal, upload manual lewat Creator Dashboard.', true);
    } finally {
      upBusy = false; upReady();
    }
  }
  upgo.addEventListener('click', doUpload);

  if (ukey.value.trim()) checkAcct();

  render(); renderAmp(); buildWave();
})();
