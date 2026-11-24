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

  /* foto profil (headshot) pemain, diambil lewat perantara */
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

  /* pantau status moderasi versi lama (satu lagu). Dipakai hanya kalau auth.js lama belum punya riwayat. */
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
    var theBlob = lastBlob, theName = lastName, dname = (uname.value.trim() || lastName).slice(0, 50);
    try {
      upStatus('Mengupload ke akun ' + accName(acc) + '...');
      var fd = new FormData();
      fd.append('request', JSON.stringify({
        assetType: 'Audio',
        displayName: dname,
        description: 'Dibuat dengan MAX STUDIO PLAYBACKSPEED',
        creationContext: { creator: { userId: id } }
      }));
      fd.append('fileContent', new Blob([theBlob], { type: /\.wav$/.test(theName) ? 'audio/wav' : 'audio/ogg' }), theName);
      var res = await fetch(API + 'assets', { method: 'POST', headers: { 'x-api-key': key }, body: fd });
      var op = await res.json().catch(function(){ return {}; });
      if (!res.ok){ upStatus(apiMsg(res, op), true); return; }
      upStatus('Diproses Roblox...');
      var assetId = '', opPath = op.path || '';
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
        if (op.path) opPath = op.path;
      }
      if (assetId){
        upStatus('Berhasil diupload. Asset ID: ' + assetId + '.' + (H ? ' Statusnya dipantau di Riwayat upload, kamu boleh langsung lanjut lagu berikutnya.' : ''));
        if (H) addHist(acc, dname, assetId, opPath);
        else { modId = assetId; watchMod(); }
      } else if (H && opPath){
        addHist(acc, dname, '', opPath);
        upStatus('Masih diproses Roblox. Sudah masuk Riwayat upload, ID muncul otomatis nanti. Kamu boleh lanjut lagu berikutnya.');
      } else upStatus('Masih diproses Roblox. Cek di Creator Dashboard, Development Items, Audio.');
    } catch(e){
      upStatus('Upload gagal: ' + ((e && e.message) || String(e)) + '. Coba sekali lagi. Kalau tetap gagal, upload manual lewat Creator Dashboard.', true);
    } finally {
      upBusy = false; upReady();
    }
  }
  upgo.addEventListener('click', doUpload);

  /* ---------- riwayat upload: banyak lagu bisa menunggu moderasi sekaligus ---------- */
  var H = MSA.hist || null;
  var hsel = {}, hsig = '', hTimer = 0, hBusy = false, hBackoff = false;
  var hlistEl = null, hmsgEl = null, hcountEl = null, hnoteEl = null, hdelselEl = null;
  var ST = { pending: 'Menunggu moderasi', approved: 'Diterima', rejected: 'Ditolak' };
  var ICON_COPY = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></svg>';
  var ICON_OK = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 13l4 4L19 7"/></svg>';

  function hMsg(msg, err){ if (!hmsgEl) return; hmsgEl.textContent = msg || ''; hmsgEl.className = 'status' + (err ? ' err' : ''); }
  function fmtWhen(t){
    try { return new Date(t).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); }
    catch(e){ return ''; }
  }
  function copyText(t, done){
    function fb(){
      var ta = document.createElement('textarea');
      ta.value = t; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
      document.body.appendChild(ta); ta.select();
      var ok = false; try { ok = document.execCommand('copy'); } catch(e){}
      ta.remove(); done(ok);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(function(){ done(true); }, fb);
    else fb();
  }
  function updSel(){
    if (!hdelselEl) return;
    var n = Object.keys(hsel).length;
    hdelselEl.textContent = n ? 'Hapus terpilih (' + n + ')' : 'Hapus terpilih';
  }

  function buildHist(){
    var s = document.createElement('style');
    s.textContent = [
      '.hlist{max-height:320px;overflow-y:auto;display:grid;gap:8px;padding-right:4px;overscroll-behavior:contain}',
      '.hrow{display:grid;grid-template-columns:auto 1fr;gap:10px;align-items:start;border:1px solid var(--line,#2e2e2e);border-radius:12px;padding:10px;background:#050a07}',
      '.hrow input[type=checkbox]{margin-top:3px;width:18px;height:18px;accent-color:var(--acc,#3ddc84)}',
      '.hmain{min-width:0;display:grid;gap:5px}',
      '.htitle{font-weight:700;line-height:1.3;overflow-wrap:anywhere}',
      '.hmeta{display:flex;flex-wrap:wrap;gap:4px 10px;align-items:center;font-size:.8rem;color:var(--mut,#9b9b9b)}',
      '.hid{color:var(--acc,#3ddc84);font-family:var(--mono,monospace);font-weight:600;font-size:.9rem}',
      '.hcopy{display:inline-grid;place-items:center;width:30px;height:30px;padding:0;border-radius:8px;border:1px solid var(--acc-line,#1f5a3a);background:transparent;color:var(--acc,#3ddc84);cursor:pointer}',
      '.hbadge{padding:2px 8px;border-radius:99px;border:1px solid;font-size:.72rem;font-weight:700}',
      '.hbadge.pending{color:#f5c542;border-color:#6b5a1f}',
      '.hbadge.approved{color:var(--acc,#3ddc84);border-color:var(--acc-line,#1f5a3a)}',
      '.hbadge.rejected{color:#ff6b6b;border-color:#6b2a2a}'
    ].join('\n');
    document.head.appendChild(s);

    var box = acEl('div', 'amp'); box.id = 'hist';
    var head = acEl('div', 'amp-head');
    head.appendChild(acEl('span', 'label', 'Riwayat upload'));
    hcountEl = acEl('span', 'amp-val', '0'); head.appendChild(hcountEl);
    box.appendChild(head);
    hlistEl = acEl('div', 'hlist'); hlistEl.setAttribute('role', 'list'); box.appendChild(hlistEl);
    hmsgEl = acEl('p', 'status'); hmsgEl.setAttribute('role', 'status'); hmsgEl.setAttribute('aria-live', 'polite'); box.appendChild(hmsgEl);
    var row = acEl('div', 'row');
    var b1 = acEl('button', 'btn', 'Cek status'); b1.type = 'button'; b1.onclick = function(){ hMsg('Mengecek status...'); pollOnce(true); };
    hdelselEl = acEl('button', 'btn', 'Hapus terpilih'); hdelselEl.type = 'button'; hdelselEl.onclick = hDelSel;
    var b3 = acEl('button', 'btn', 'Hapus semua'); b3.type = 'button'; b3.onclick = hDelAll;
    row.appendChild(b1); row.appendChild(hdelselEl); row.appendChild(b3);
    box.appendChild(row);
    hnoteEl = acEl('p', 'note'); box.appendChild(hnoteEl);
    var acct = $('acct');
    if (acct && acct.parentNode) acct.parentNode.insertBefore(box, acct);
    else { var r = $('res'); r.parentNode.insertBefore(box, r.nextSibling); }
  }

  function renderHist(force){
    if (!H || !hlistEl) return;
    var rows = H.list(), info = H.info ? H.info() : {};
    var ids = {}; rows.forEach(function(r){ ids[r.id] = 1; });
    Object.keys(hsel).forEach(function(k){ if (!ids[k]) delete hsel[k]; });
    var sig = JSON.stringify(rows) + '|' + Object.keys(hsel).join(',') + '|' + (info.cloud ? 1 : 0) + '|' + (info.warn || '') + '|' + (info.login ? 1 : 0);
    if (sig === hsig && !force) return;
    hsig = sig;
    var st = hlistEl.scrollTop;
    hlistEl.textContent = '';
    var pend = rows.filter(function(r){ return r.s === 'pending'; }).length;
    hcountEl.textContent = rows.length + (pend ? ' · ' + pend + ' menunggu' : '');
    if (!rows.length) hlistEl.appendChild(acEl('p', 'note', 'Belum ada riwayat. Setelah upload, lagu muncul di sini.'));
    rows.forEach(function(r){
      var row = acEl('div', 'hrow'); row.setAttribute('role', 'listitem');
      var cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = !!hsel[r.id];
      cb.setAttribute('aria-label', 'Pilih riwayat ' + (r.n || r.a));
      cb.onchange = function(){ if (cb.checked) hsel[r.id] = 1; else delete hsel[r.id]; updSel(); };
      var main = acEl('div', 'hmain');
      main.appendChild(acEl('div', 'htitle', r.n || '(tanpa nama)'));
      var line = acEl('div', 'hmeta');
      if (r.a){
        line.appendChild(acEl('span', 'hid', r.a));
        var cp = acEl('button', 'hcopy'); cp.type = 'button'; cp.title = 'Salin ID'; cp.setAttribute('aria-label', 'Salin ID ' + r.a);
        cp.innerHTML = ICON_COPY;
        cp.onclick = function(){
          copyText(r.a, function(ok){
            cp.innerHTML = ok ? ICON_OK : ICON_COPY;
            setTimeout(function(){ cp.innerHTML = ICON_COPY; }, 1200);
          });
        };
        line.appendChild(cp);
      } else line.appendChild(acEl('span', '', 'ID belum tersedia'));
      line.appendChild(acEl('span', 'hbadge ' + r.s, ST[r.s] || r.s));
      var meta = acEl('div', 'hmeta');
      meta.appendChild(acEl('span', '', 'Akun: ' + (r.un || ('ID ' + r.u))));
      meta.appendChild(acEl('span', '', fmtWhen(r.t)));
      main.appendChild(line); main.appendChild(meta);
      row.appendChild(cb); row.appendChild(main);
      hlistEl.appendChild(row);
    });
    hlistEl.scrollTop = st;
    updSel();
    hnoteEl.textContent = info.cloud
      ? 'Riwayat tersimpan di akun Discord-mu (maksimal ' + (H.max || 100) + ' terbaru). Menghapus riwayat tidak menghapus audio di Roblox.'
      : (info.login ? 'Riwayat sementara disimpan di perangkat ini.' : 'Riwayat disimpan di perangkat ini. Login Discord supaya tersimpan di akunmu dan muncul di semua perangkat.');
    if (info.warn) hMsg(info.warn, true);
  }

  function hDelSel(){
    var ids = Object.keys(hsel);
    if (!ids.length){ hMsg('Centang dulu riwayat yang mau dihapus.'); return; }
    if (!confirm('Hapus ' + ids.length + ' riwayat terpilih? Audio di Roblox tidak ikut terhapus.')) return;
    H.remove(ids).then(function(r){
      hsel = {};
      hMsg(r && r.ok === false ? (r.msg || 'Gagal menghapus.') : 'Riwayat terpilih dihapus.', r && r.ok === false);
      renderHist(true);
    });
  }
  function hDelAll(){
    if (!H.list().length){ hMsg('Riwayat sudah kosong.'); return; }
    if (!confirm('Hapus SEMUA riwayat upload? Audio di Roblox tidak ikut terhapus.')) return;
    H.clear().then(function(r){
      hsel = {};
      hMsg(r && r.ok === false ? (r.msg || 'Gagal menghapus.') : 'Semua riwayat dihapus.', r && r.ok === false);
      renderHist(true);
    });
  }

  function addHist(acc, name, assetId, opPath){
    if (!H) return;
    H.add({ u: acc.u, un: acc.n || '', n: name, a: assetId, o: opPath, s: 'pending' }).then(function(r){
      if (r && r.ok === false) hMsg(r.msg || 'Riwayat gagal disimpan.', true);
    });
  }

  /* pemantau: cek semua yang masih menunggu, tiap 15 detik selama halaman terbuka */
  function keyFor(u){ var a = accs(); for (var i = 0; i < a.length; i++) if (a[i].u === u) return a[i].k; return ''; }
  async function readOp(path, key){
    var r = await fetch(API + path, { headers: { 'x-api-key': key } });
    var j = await r.json().catch(function(){ return {}; });
    if (r.status === 429) return { rate: true };
    if (!r.ok) return { err: r.status };
    return { op: j };
  }
  async function readMod(aid, key){
    var r = await fetch(API + 'assets/' + encodeURIComponent(aid), { headers: { 'x-api-key': key } });
    var j = await r.json().catch(function(){ return {}; });
    if (r.status === 429) return { rate: true };
    if (!r.ok) return { err: r.status };
    return { st: (j.moderationResult && j.moderationResult.moderationState) || 'Reviewing' };
  }
  function hasPending(){ return H && H.list().some(function(r){ return r.s === 'pending'; }); }
  function hSchedule(first){
    clearTimeout(hTimer);
    if (!hasPending()) return;
    hTimer = setTimeout(function(){ pollOnce(false); }, first ? 2500 : (hBackoff ? 60000 : 15000));
  }
  async function pollOnce(manual){
    if (!H || hBusy) return;
    hBusy = true; hBackoff = false;
    var changed = 0, nokey = 0, total = 0;
    try {
      var rows = H.list().filter(function(r){ return r.s === 'pending'; });
      total = rows.length;
      for (var i = 0; i < rows.length; i++){
        var r = rows[i], key = keyFor(r.u);
        if (!key){ nokey++; continue; }
        try {
          var a = r.a;
          if (!a && r.o){
            var o1 = await readOp(r.o, key);
            if (o1.rate){ hBackoff = true; break; }
            if (o1.op && o1.op.done){
              if (o1.op.error){ H.update(r.id, { s: 'rejected' }); changed++; continue; }
              var rp = o1.op.response || {};
              a = String(rp.assetId || String(rp.path || '').split('/')[1] || '');
              if (a) H.update(r.id, { a: a });
            }
          }
          if (a){
            var m = await readMod(a, key);
            if (m.rate){ hBackoff = true; break; }
            if (m.st === 'Approved'){ H.update(r.id, { s: 'approved' }); changed++; }
            else if (m.st === 'Rejected'){ H.update(r.id, { s: 'rejected' }); changed++; }
          }
        } catch(e){}
        await wait(700);
      }
    } finally { hBusy = false; }
    if (manual){
      if (!total) hMsg('Tidak ada yang sedang menunggu moderasi.');
      else if (hBackoff) hMsg('Roblox membatasi permintaan. Coba lagi sebentar.', true);
      else if (changed) hMsg(changed + ' status berubah.');
      else if (nokey === total) hMsg('Akun Roblox untuk riwayat ini tidak ada di Config akun, jadi statusnya tidak bisa dicek.', true);
      else hMsg('Belum ada perubahan, masih menunggu moderasi.');
    }
    hSchedule();
  }

  if (H){
    buildHist();
    H.onChange(function(){ renderHist(); if (!hBusy) hSchedule(true); });
    MSA.onChange(function(){ if (!hBusy) hSchedule(true); });
    renderHist(true);
    hSchedule(true);
  }

  MSA.onChange(renderAccts);
  renderAccts();

  render(); renderAmp(); buildWave();
})();
