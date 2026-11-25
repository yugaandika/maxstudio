(function(){
  var $ = function(id){ return document.getElementById(id); };
  var app = $('app'); if (!app || !$('permpane')) return;
  var MSA = window.MSAuth || { list: function(){ return []; }, onChange: function(){} };
  var API = '/api/roblox/';
  /* Versi percobaan: alamat dan bentuk permintaan ini perlu dicocokkan dengan dokumentasi Roblox. */
  var PERM = { path: 'asset-permissions-api/v1/assets/permissions', alt: function(id){ return 'asset-permissions-api/v1/assets/' + id + '/permissions'; }, action: 'Use' };
  var wait = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  function mk(tag, cls, txt){ var e = document.createElement(tag); if (cls) e.className = cls; if (txt) e.textContent = txt; return e; }
  function say(el, msg, err){ el.textContent = msg || ''; el.className = 'status' + (err ? ' err' : ''); }

  /* tab */
  var tabs = { ps: $('tab-ps'), perm: $('tab-perm') };
  function setTab(t){
    app.setAttribute('data-tab', t);
    Object.keys(tabs).forEach(function(k){ tabs[k].setAttribute('aria-pressed', k === t ? 'true' : 'false'); });
    if (t === 'ps') setTimeout(function(){ window.dispatchEvent(new Event('resize')); }, 30);
  }
  tabs.ps.onclick = function(){ setTab('ps'); };
  tabs.perm.onclick = function(){ setTab('perm'); };
  setTab('ps');

  /* akun pemilik audio */
  var sel = $('pacc'), selId = '';
  function accs(){ return MSA.list(); }
  function cur(){ var a = accs(); if (a.length === 1) return a[0]; for (var i = 0; i < a.length; i++) if (a[i].u === selId) return a[i]; return null; }
  function nm(a){ return a.n || ('ID ' + a.u); }
  function renderAcc(){
    var a = accs(), c; if (selId && !a.some(function(x){ return x.u === selId; })) selId = '';
    c = cur(); sel.textContent = '';
    function opt(v, t){ var o = mk('option', '', t); o.value = v; sel.appendChild(o); }
    if (!a.length) opt('', 'Belum ada akun, tambahkan di tab Playbackspeed');
    else { if (a.length > 1) opt('', 'Pilih akun...'); a.forEach(function(x){ opt(x.u, nm(x) + ' · ' + x.u); }); }
    sel.value = c ? c.u : ''; sel.disabled = !a.length;
    $('pinfo2').textContent = c ? 'ID ' + c.u + ' · key •••• ' + String(c.k).slice(-4) : '';
    ready(); recheck();
  }
  sel.onchange = function(){ selId = sel.value; renderAcc(); };
  MSA.onChange(renderAcc);

  /* tujuan: username atau group */
  var type = 'user', tgt = null, tin = $('ptarget'), chip = $('pchip');
  function setType(t){
    type = t; tgt = null; tin.value = ''; showChip(); say($('pnote'), ''); say($('pconn'), '');
    $('pt-user').setAttribute('aria-pressed', t === 'user' ? 'true' : 'false');
    $('pt-group').setAttribute('aria-pressed', t === 'group' ? 'true' : 'false');
    tin.placeholder = t === 'user' ? 'Ketik username Roblox' : 'Ketik Group ID (angka)';
    ready();
  }
  $('pt-user').onclick = function(){ setType('user'); };
  $('pt-group').onclick = function(){ setType('group'); };
  function showChip(){
    chip.textContent = ''; if (!tgt){ chip.hidden = true; return; }
    var av = mk('span', 'av', tgt.name.charAt(0)), tx = mk('div', 'atx');
    tx.appendChild(mk('b', '', tgt.name)); tx.appendChild(mk('span', '', (tgt.sub ? tgt.sub + ' · ' : '') + 'ID ' + tgt.id));
    chip.appendChild(av); chip.appendChild(tx); chip.hidden = false;
    if (type === 'user') fetch(API + 'thumbs/v1/users/avatar-headshot?userIds=' + tgt.id + '&size=150x150&format=Png')
      .then(function(r){ return r.ok ? r.json() : null; })
      .then(function(j){ var d = j && j.data && j.data[0]; if (d && d.state === 'Completed' && d.imageUrl){ var im = new Image(); im.alt = ''; im.onload = function(){ av.textContent = ''; av.appendChild(im); }; im.src = d.imageUrl; } })
      .catch(function(){});
  }
  async function jget(path, opt){ var r = await fetch(API + path, opt); var j = null; try { j = await r.json(); } catch(e){} return { r: r, j: j }; }
  async function lookup(){
    var v = tin.value.trim().replace(/^@/, ''); if (!v) return;
    tgt = null; showChip(); say($('pnote'), 'Mencari...'); say($('pconn'), '');
    try {
      if (type === 'user'){
        var o = await jget('lookup/usernames', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usernames: [v], excludeBannedUsers: true }) });
        var u = o.j && o.j.data && o.j.data[0];
        if (!o.r.ok || !u){ say($('pnote'), o.r.ok ? 'Username tidak ditemukan.' : 'Pencarian ditolak (kode ' + o.r.status + '). Coba lagi sebentar.', true); return; }
        tgt = { id: String(u.id), name: u.name, sub: u.displayName && u.displayName !== u.name ? u.displayName : '' };
      } else {
        if (!/^\d+$/.test(v)){ say($('pnote'), 'Group ID harus angka.', true); return; }
        var g = await jget('lookup/group/' + v);
        if (!g.r.ok || !g.j || !g.j.name){ say($('pnote'), 'Group tidak ditemukan.', true); return; }
        tgt = { id: String(g.j.id || v), name: g.j.name, sub: 'Group' };
      }
    } catch(e){ say($('pnote'), 'Gagal mencari. Cek internet lalu coba lagi.', true); return; }
    say($('pnote'), ''); showChip(); ready(); recheck();
  }
  $('pfind').onclick = lookup;
  tin.addEventListener('keydown', function(e){ if (e.key === 'Enter') lookup(); });
  tin.addEventListener('input', function(){ if (tgt){ tgt = null; showChip(); say($('pconn'), ''); ready(); } });

  /* cek koneksi: teman (akun) atau anggota (group). Hanya perkiraan dari data publik Roblox. */
  var ctok = 0;
  async function recheck(){
    var a = cur(), st = $('pconn'), tk = ++ctok;
    if (!tgt || !a){ say(st, ''); return; }
    say(st, 'Mengecek koneksi...');
    try {
      if (type === 'user'){
        if (tgt.id === a.u){ say(st, 'Ini akun pemilik audio sendiri.', true); return; }
        var f = await jget('lookup/friends/' + tgt.id); if (tk !== ctok) return;
        if (!f.r.ok || !f.j || !Array.isArray(f.j.data)){ say(st, 'Koneksi belum bisa dicek (daftar teman privat atau Roblox membatasi). Tetap bisa dicoba.'); return; }
        var ok = f.j.data.some(function(x){ return String(x.id) === a.u; });
        say(st, ok ? 'Terkoneksi (berteman).' : 'Belum terkoneksi. Roblox kemungkinan menolak izin ke akun ini.', !ok);
      } else {
        var m = await jget('lookup/memberships/' + a.u); if (tk !== ctok) return;
        if (!m.r.ok || !m.j || !Array.isArray(m.j.data)){ say(st, 'Keanggotaan belum bisa dicek. Tetap bisa dicoba.'); return; }
        var inG = m.j.data.some(function(x){ return x.group && String(x.group.id) === tgt.id; });
        say(st, inG ? 'Akun ini anggota group.' : 'Akun ini bukan anggota group, kemungkinan ditolak.', !inG);
      }
    } catch(e){ if (tk === ctok) say(st, 'Koneksi belum bisa dicek. Tetap bisa dicoba.'); }
  }

  /* daftar ID audio */
  var ta = $('pids');
  function ids(){ var seen = {}, out = []; ta.value.split(/[\s,;]+/).forEach(function(x){ if (/^\d{1,20}$/.test(x) && !seen[x]){ seen[x] = 1; out.push(x); } }); return out; }
  var busy = false;
  function ready(){ var n = ids().length; $('pcount').textContent = '(' + n + ' ID)'; $('pgo').disabled = busy || !n || !tgt || !cur(); }
  ta.addEventListener('input', ready);
  $('pclear').onclick = function(){ ta.value = ''; $('plog').textContent = ''; ready(); };

  /* kirim izin satu per satu supaya hasil tiap ID jelas */
  function errText(r, j, t){
    var m = (j && (j.message || (j.error && (j.error.message || j.error)) || (j.errors && j.errors[0] && (j.errors[0].message || j.errors[0])))) || (t || '').slice(0, 160);
    if (r.status === 401) return 'API key ditolak.';
    if (r.status === 403) return 'Izin ditolak. Key perlu asset-permissions (write) dan akun ini harus pemilik audionya. ' + (typeof m === 'string' ? m : '');
    if (r.status === 429) return 'Terlalu banyak permintaan.';
    return 'Kode ' + r.status + (m ? ': ' + (typeof m === 'string' ? m : JSON.stringify(m)) : '');
  }
  async function send(path, obj, key){
    var r = await fetch(API + path, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-api-key': key }, body: JSON.stringify(obj) });
    var t = await r.text(), j = null; try { j = JSON.parse(t); } catch(e){}
    return { r: r, j: j, t: t };
  }
  /* Roblox menolak "User" sebagai SubjectType, jadi beberapa penulisan dicoba otomatis. Yang berhasil diingat. */
  var VAR = { user: ['User', 'USER', 'user', 'SUBJECT_TYPE_USER'], group: ['Group', 'GROUP', 'group', 'SUBJECT_TYPE_GROUP'] };
  var okVar = {};
  async function grant(assetId, key){
    var list = okVar[type] ? [okVar[type]] : VAR[type], o = null, tried = [], good = false;
    for (var i = 0; i < list.length; i++){
      tried.push(list[i]);
      var item = { subjectType: list[i], subjectId: tgt.id, action: PERM.action };
      o = await send(PERM.path, { requests: [Object.assign({ assetId: assetId }, item)] }, key);
      if (o.r.status === 404 || o.r.status === 405) o = await send(PERM.alt(assetId), { requests: [item] }, key);
      var bad = o.j && Array.isArray(o.j.errors) && o.j.errors.length;
      if (o.r.ok && !bad){ good = true; okVar[type] = list[i]; break; }
      if (!(o.r.status === 400 && /subjecttype/i.test(o.t || ''))) break;
    }
    return { ok: good, status: o.r.status, msg: good ? '' : errText(o.r, o.j, o.t) + (tried.length > 1 ? ' (dicoba: ' + tried.join(', ') + ')' : '') };
  }
  $('pgo').onclick = async function(){
    var a = cur(), list = ids(), log = $('plog'), prog = $('pprog');
    if (busy || !a || !tgt || !list.length) return;
    if (!confirm('Beri izin ' + list.length + ' audio ke ' + tgt.name + '?')) return;
    busy = true; ready(); log.textContent = ''; prog.hidden = false; prog.value = 0;
    var ok = 0, fail = 0;
    for (var i = 0; i < list.length; i++){
      var line = mk('div', 'pl'), res;
      try { res = await grant(list[i], a.k); } catch(e){ res = { ok: false, status: 0, msg: 'Tidak bisa menghubungi Roblox.' }; }
      line.textContent = (res.ok ? '✓ ' : '✗ ') + list[i] + (res.ok ? ' diberi izin' : ' — ' + res.msg);
      if (!res.ok) line.className = 'pl err';
      log.appendChild(line); log.scrollTop = log.scrollHeight;
      if (res.ok) ok++; else fail++;
      prog.value = (i + 1) / list.length;
      if (res.status === 429){ log.appendChild(mk('div', 'pl err', 'Berhenti: Roblox membatasi permintaan. Coba lagi nanti untuk sisanya.')); break; }
      if (res.status === 401){ break; }
      await wait(700);
    }
    log.appendChild(mk('div', 'pl', 'Selesai: ' + ok + ' berhasil, ' + fail + ' gagal.'));
    busy = false; prog.hidden = true; ready();
  };

  renderAcc(); ready();
})();
