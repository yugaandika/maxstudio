  var API = '/api/roblox/assets/v1/';
  var MSA = window.MSAuth || {
    max: 3, list: function(){ return []; }, onChange: function(){}, info: function(){ return {}; },
    add: function(){ return Promise.resolve({ ok: false, msg: 'Penyimpanan akun tidak tersedia.' }); },
    remove: function(){ return Promise.resolve({ ok: false, msg: 'Penyimpanan akun tidak tersedia.' }); }
  };
  var sel = '', chk = null, modKey = '';
  var ukey = $('ukey'), uid = $('uid');
  function acEl(tag, cls, txt){ var e = document.createElement(tag); if (cls) e.className = cls; if (txt) e.textContent = txt; return e; }
  function accs(){ return MSA.list(); }
  function cur(){
    var a = accs(), i;
    if (a.length === 1) return a[0];
    for (i = 0; i < a.length; i++) if (a[i].u === sel) return a[i];
    return null;
  }
  function mask(k){ return '•••• ' + String(k).slice(-4); }
  function accName(a){ return a.n || ('ID ' + a.u); }

  /* foto profil (headshot) pemain, diambil lewat perantara Netlify */
  var avc = {};
  function avUrl(id){
    if (!avc[id]) avc[id] = fetch('/api/roblox/thumbs/v1/users/avatar-headshot?userIds=' + id + '&size=150x150&format=Png')
      .then(function(r){ return r.ok ? r.json() : null; })
      .then(function(j){ var d = j && j.data && j.data[0]; var u = (d && d.state === 'Completed' && d.imageUrl) || ''; if (!u) delete avc[id]; return u; })
      .catch(function(){ delete avc[id]; return ''; });
    return avc[id];
  }
  function paintAv(box, a){
    box.textContent = a ? String(a.n || a.u).charAt(0) : '?';
    box.dataset.u = a ? a.u : '';
    if (!a) return;
    avUrl(a.u).then(function(u){
      if (!u || box.dataset.u !== a.u) return;
      var im = new Image(); im.alt = '';
      im.onload = function(){ if (box.dataset.u === a.u){ box.textContent = ''; box.appendChild(im); } };
      im.src = u;
    });
  }

  function upStatus(msg, err){ ustat.textContent = msg; ustat.className = 'status' + (err ? ' err' : ''); }
  function upReady(){ upgo.disabled = !lastBlob || upBusy || !cur(); }
  function aStatus(msg, err){ var el = $('astatus'); el.textContent = msg; el.className = 'status' + (err ? ' err' : ''); }
  function aMsg(msg, err){ var el = $('amsg'); el.textContent = msg || ''; el.className = 'status' + (err ? ' err' : ''); }

  /* daftar akun (Config) dan pemilih akun untuk upload */
  function renderAccts(){
    var a = accs(), max = MSA.max || 3, c, info = MSA.info ? MSA.info() : {};
    if (sel && !a.some(function(x){ return x.u === sel; })) sel = '';
    c = cur();
    $('acount').textContent = a.length + '/' + max;
    var list = $('alist'); list.textContent = '';
    a.forEach(function(x){
      var row = acEl('div', 'arow'), av = acEl('span', 'av'), tx = acEl('div', 'atx'), del = acEl('button', 'btn', 'Hapus');
      paintAv(av, x);
      tx.appendChild(acEl('b', '', accName(x)));
      tx.appendChild(acEl('span', '', 'ID ' + x.u + ' · key ' + mask(x.k)));
      del.type = 'button';
      del.onclick = function(){
        if (!confirm('Hapus akun ' + accName(x) + ' dari penyimpanan?')) return;
        MSA.remove(x.u).then(function(r){ aMsg(r.ok ? 'Akun dihapus.' : (r.msg || 'Gagal menghapus.'), !r.ok); });
      };
      row.appendChild(av); row.appendChild(tx); row.appendChild(del);
      list.appendChild(row);
    });
    if (!a.length) list.appendChild(acEl('p', 'note', info.loading ? 'Memuat akun...' : 'Belum ada akun tersimpan. Tambahkan di bawah.'));
    if (info.warn) aMsg(info.warn, true);
    $('addbox').hidden = a.length >= max;
    $('afull').hidden = a.length < max;

    var ps = $('psel'); ps.textContent = '';
    function opt(v, t){ var o = document.createElement('option'); o.value = v; o.textContent = t; ps.appendChild(o); }
    if (!a.length) opt('', 'Belum ada akun, tambahkan di Config akun');
    else {
      if (a.length > 1) opt('', 'Pilih akun...');
      a.forEach(function(x){ opt(x.u, accName(x) + ' · ' + x.u); });
    }
    ps.value = c ? c.u : '';
    ps.disabled = !a.length;
    $('pick').classList.toggle('need', a.length > 1 && !c);
    paintAv($('pav'), c);
    $('pinfo').textContent = c ? 'ID ' + c.u + ' · key ' + mask(c.k) : (a.length > 1 ? 'Pilih dulu akun tujuan upload.' : '');
    upReady();
  }
  $('psel').addEventListener('change', function(){ sel = this.value; renderAccts(); });

  /* tambah akun: cek key dulu, baru boleh disimpan */
  function showChip(){
    var c = $('vchip'); c.textContent = '';
    $('asave').disabled = !chk;
    if (!chk){ c.hidden = true; return; }
    var av = acEl('span', 'av'), tx = acEl('div', 'atx');
    paintAv(av, chk);
    tx.appendChild(acEl('b', '', accName(chk)));
    tx.appendChild(acEl('span', '', 'ID ' + chk.u));
    c.appendChild(av); c.appendChild(tx); c.hidden = false;
  }
  function invalidate(){ chk = null; showChip(); }
  ukey.addEventListener('input', invalidate);
  uid.addEventListener('input', invalidate);
  ukey.addEventListener('change', function(){ checkAcct(); });
  uid.addEventListener('change', function(){ checkAcct(); });
  $('acheck').addEventListener('click', function(){ checkAcct(); });
  $('asave').addEventListener('click', function(){
    if (!chk) return;
    var b = $('asave'), got = chk; b.disabled = true;
    MSA.add(got).then(function(r){
      if (!r.ok){ aStatus(r.msg || 'Gagal menyimpan.', true); b.disabled = !chk; return; }
      if (ukey.value.trim() === got.k){ ukey.value = ''; uid.value = ''; invalidate(); }
      aStatus(r.updated ? 'Akun diperbarui.' : 'Akun tersimpan. Pilih akun ini di bagian upload.');
    });
  });

  /* cek akun: introspect API key (tidak memakai kuota upload) */
  var chkTok = 0;
  async function checkAcct(){
    var key = ukey.value.trim(), tok, j;
    if (chk && chk.k === key && chk.u === uid.value.trim()) return;
    tok = ++chkTok;
    chk = null; showChip();
    if (!key){ aStatus('Isi API key, akun dicek otomatis.'); return; }
    aStatus('Mengecek akun...');
    try {
      var r = await fetch('/api/roblox/api-keys/v1/introspect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey: key }) });
      j = await r.json().catch(function(){ return null; });
      if (tok !== chkTok) return;
      if (!r.ok || !j){ aStatus('Key ditolak atau tidak bisa dipakai dari jaringan ini. Cek key dan pengaturan IP-nya.', true); return; }
    } catch(e){
      if (tok === chkTok) aStatus('Key belum bisa dicek dari browser. Coba lagi, atau cek koneksi internet.', true);
      return;
    }
    if (j.enabled === false){ aStatus('Key nonaktif. Aktifkan di Creator Dashboard.', true); return; }
    if (j.expired){ aStatus('Key sudah kedaluwarsa. Buat atau perpanjang di Creator Dashboard.', true); return; }
    var owner = String(j.authorizedUserId || '');
    var sc = (j.scopes || []).filter(function(x){ return x.name === 'asset'; })[0];
    var ops = (sc && sc.operations) || [];
    if (ops.indexOf('write') < 0){ aStatus('Key belum punya izin Assets dengan operasi Write. Tambahkan di Creator Dashboard.', true); return; }
    if (!uid.value.trim() && owner) uid.value = owner;
    var mine = uid.value.trim();
    if (!/^\d+$/.test(mine)){ aStatus('User ID harus angka saja. Lihat di URL profilmu: roblox.com/users/ANGKA/profile.', true); return; }
    if (owner && mine !== owner){ aStatus('User ID tidak cocok. Pemilik key ini punya ID ' + owner + '. Ganti User ID-nya.', true); return; }
    var perm = ops.indexOf('read') >= 0 ? 'Read dan Write aktif.' : 'Write aktif. Tambahkan Read supaya status moderasi bisa dipantau.';
    chk = { k: key, u: mine, n: '' }; showChip();
    aStatus('Key valid. Izin Assets ' + perm + ' Klik Simpan akun.');
    try {
      var ur = await fetch('/api/roblox/cloud/v2/users/' + mine, { headers: { 'x-api-key': key } });
      if (ur.ok){ var u = await ur.json(); if (tok === chkTok && chk && u && u.name){ chk.n = u.name; showChip(); } }
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
    var r = await fetch(API + 'assets/' + modId, { headers: { 'x-api-key': modKey } });
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
    var acc = cur();
    if (!acc){ upStatus(accs().length ? 'Pilih akun Roblox tujuan upload dulu.' : 'Tambahkan akun Roblox di Config akun dulu.', true); return; }
    var key = acc.k, id = acc.u;
    modKey = key;
    if (lastBlob.size > 20 * 1048576){ upStatus('File lebih dari 20 MB, Roblox akan menolak. Konversi ulang dengan kualitas Hemat.', true); return; }
    resetMod(); upBusy = true; upReady();
    try {
      upStatus('Mengupload ke akun ' + accName(acc) + '...');
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

  MSA.onChange(renderAccts);
  renderAccts();

  render(); renderAmp(); buildWave();
})();
