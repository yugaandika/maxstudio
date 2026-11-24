(function(){
  var URL_ = 'https://aqfeyrgwysxdouaetmat.supabase.co';
  var KEY_ = 'sb_publishable_14SgkcxUcbr2cCtF5sd-kg_lh4IyfoW';
  var GUEST = 'maxstudio.guest', LOCAL = 'maxstudio.accounts', OLD = 'maxstudio.roblox', MAX = 3;
  var HKEY = 'maxstudio.history', HMAX = 100;
  var body = document.body;
  function $(id){ return document.getElementById(id); }
  function show(s){ body.classList.remove('boot', 's-landing', 's-app'); body.classList.add(s); }
  function isGuest(){ try { return sessionStorage.getItem(GUEST) === '1'; } catch(e){ return false; } }
  var sb = null;
  try { sb = window.supabase.createClient(URL_, KEY_, { auth: { flowType: 'pkce', persistSession: true, detectSessionInUrl: true } }); } catch(e){}
  var user = null, cloud = false, loading = false, warn = '', subs = [], accs = [];
  function note(t){ var n = $('syncmsg'); if (n) n.textContent = t || ''; }
  function el(tag, cls, txt){ var e = document.createElement(tag); if (cls) e.className = cls; if (txt) e.textContent = txt; return e; }

  /* ---------- akun Roblox: maksimal 3 per akun Discord ---------- */
  function valid(a){ return !!(a && typeof a.k === 'string' && a.k && /^\d+$/.test(String(a.u || ''))); }
  function lget(){
    try { var a = JSON.parse(localStorage.getItem(LOCAL) || '[]'); return Array.isArray(a) ? a.filter(valid).slice(0, MAX) : []; }
    catch(e){ return []; }
  }
  function lset(a){ try { if (a.length) localStorage.setItem(LOCAL, JSON.stringify(a)); else localStorage.removeItem(LOCAL); } catch(e){} }
  /* data lama (satu akun) dipindah ke daftar baru */
  try {
    var old = JSON.parse(localStorage.getItem(OLD) || 'null');
    if (old) {
      var cur0 = lget();
      if (valid({ k: old.k, u: old.u }) && cur0.length < MAX && !cur0.some(function(x){ return x.u === String(old.u); })) {
        cur0.push({ k: String(old.k), u: String(old.u), n: '' }); lset(cur0);
      }
      localStorage.removeItem(OLD);
    }
  } catch(e){}

  function emit(){ subs.forEach(function(f){ try { f(); } catch(e){} }); }
  function setAccs(a){ accs = a.slice(0, MAX); emit(); }
  function find(u){ for (var i = 0; i < accs.length; i++) if (accs[i].u === u) return i; return -1; }
  function clean(a){ return { k: String(a.k || '').trim(), u: String(a.u || '').trim(), n: String(a.n || '').trim() }; }

  function add(a){
    a = clean(a);
    if (!valid(a)) return Promise.resolve({ ok: false, msg: 'Data akun belum lengkap.' });
    var i = find(a.u);
    if (i < 0 && accs.length >= MAX) return Promise.resolve({ ok: false, msg: 'Sudah ' + MAX + ' akun. Hapus salah satu dulu.' });
    var next = accs.slice(); if (i < 0) next.push(a); else next[i] = a;
    if (!cloud) { lset(next); setAccs(next); return Promise.resolve({ ok: true, updated: i >= 0 }); }
    var q = i < 0
      ? sb.from('roblox_accounts').insert({ user_id: user.id, roblox_id: a.u, api_key: a.k, name: a.n })
      : sb.from('roblox_accounts').update({ api_key: a.k, name: a.n, updated_at: new Date().toISOString() }).eq('user_id', user.id).eq('roblox_id', a.u);
    return Promise.resolve(q).then(function(r){
      if (r.error) return { ok: false, msg: /MAKS_3/.test(r.error.message || '') ? 'Sudah ' + MAX + ' akun. Hapus salah satu dulu.' : 'Gagal menyimpan ke akunmu: ' + r.error.message };
      setAccs(next); return { ok: true, updated: i >= 0 };
    });
  }
  function remove(u){
    var i = find(u); if (i < 0) return Promise.resolve({ ok: true });
    var next = accs.slice(); next.splice(i, 1);
    if (!cloud) { lset(next); setAccs(next); return Promise.resolve({ ok: true }); }
    return Promise.resolve(sb.from('roblox_accounts').delete().eq('user_id', user.id).eq('roblox_id', u)).then(function(r){
      if (r.error) return { ok: false, msg: 'Gagal menghapus: ' + r.error.message };
      setAccs(next); return { ok: true };
    });
  }
  function removeAll(){
    if (!cloud) { lset([]); setAccs([]); return Promise.resolve({ ok: true }); }
    return Promise.resolve(sb.from('roblox_accounts').delete().eq('user_id', user.id)).then(function(r){
      if (r.error) return { ok: false, msg: 'Gagal menghapus: ' + r.error.message };
      setAccs([]); return { ok: true };
    });
  }

  /* ---------- riwayat upload: tersimpan di akun Discord (tabel upload_history), atau di perangkat kalau tanpa login ---------- */
  var hist = [], hsubs = [], hcloud = false, hwarn = '';
  function isLocalId(id){ return String(id).charAt(0) === 'l'; }
  function hlget(){
    try {
      var a = JSON.parse(localStorage.getItem(HKEY) || '[]');
      return Array.isArray(a) ? a.filter(function(r){ return r && r.id && r.u; }).slice(0, HMAX) : [];
    } catch(e){ return []; }
  }
  function hlset(a){ try { if (a.length) localStorage.setItem(HKEY, JSON.stringify(a)); else localStorage.removeItem(HKEY); } catch(e){} }
  function persistLocal(){ hlset(hist.filter(function(r){ return isLocalId(r.id); })); }
  function hemit(){ hsubs.forEach(function(f){ try { f(); } catch(e){} }); }
  function hset(a){ hist = a.slice(0, HMAX); hemit(); }
  function hfind(id){ for (var i = 0; i < hist.length; i++) if (hist[i].id === id) return i; return -1; }
  function hrow(d){
    return { id: d.id, u: String(d.roblox_id), un: d.roblox_name || '', n: d.name || '', a: d.asset_id || '', o: d.operation_id || '', s: d.status || 'pending', t: Date.parse(d.created_at) || Date.now() };
  }
  hist = hlget();

  function hpull(){
    if (!sb || !user) return Promise.resolve();
    var uid0 = user.id;
    return Promise.resolve(
      sb.from('upload_history').select('id,roblox_id,roblox_name,name,asset_id,operation_id,status,created_at').order('created_at', { ascending: false }).limit(HMAX)
    ).then(function(r){
      if (!user || user.id !== uid0) return;
      if (r.error) {
        hcloud = false;
        hwarn = 'Riwayat belum bisa disimpan di akunmu (' + (r.error.message || 'error') + '). Riwayat sementara disimpan di perangkat ini.';
        hset(hlget()); return;
      }
      hcloud = true; hwarn = '';
      hset((r.data || []).map(hrow));
    });
  }
  function hadd(e){
    var row = { id: 'l' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), u: String(e.u || ''), un: String(e.un || ''), n: String(e.n || '').slice(0, 50), a: String(e.a || ''), o: String(e.o || ''), s: e.s || 'pending', t: Date.now() };
    function local(){
      hist = [row].concat(hist).slice(0, HMAX); persistLocal(); hemit();
      return { ok: true, row: row };
    }
    if (!hcloud || !user) return Promise.resolve(local());
    return Promise.resolve(
      sb.from('upload_history').insert({ roblox_id: row.u, roblox_name: row.un, name: row.n, asset_id: row.a || null, operation_id: row.o || null, status: row.s }).select('id,created_at').single()
    ).then(function(r){
      if (r.error || !r.data) {
        hwarn = 'Riwayat gagal disimpan ke akunmu (' + ((r.error && r.error.message) || 'error') + '). Disimpan di perangkat ini.';
        return local();
      }
      row.id = r.data.id; row.t = Date.parse(r.data.created_at) || row.t;
      hset([row].concat(hist));
      return { ok: true, row: row };
    });
  }
  function hupdate(id, p){
    var i = hfind(id); if (i < 0) return Promise.resolve({ ok: false });
    var next = hist.slice(), r = {};
    for (var k in next[i]) r[k] = next[i][k];
    for (var k2 in p) r[k2] = p[k2];
    next[i] = r;
    hist = next;
    if (isLocalId(id)) { persistLocal(); hemit(); return Promise.resolve({ ok: true }); }
    hemit();
    var q = { updated_at: new Date().toISOString() };
    if (p.s !== undefined) q.status = p.s;
    if (p.a !== undefined) q.asset_id = p.a || null;
    if (p.o !== undefined) q.operation_id = p.o || null;
    return Promise.resolve(sb.from('upload_history').update(q).eq('id', id)).then(function(res){
      return res.error ? { ok: false, msg: res.error.message } : { ok: true };
    });
  }
  function hremove(ids){
    var set = {}; ids.forEach(function(x){ set[x] = 1; });
    var cl = ids.filter(function(x){ return !isLocalId(x); });
    hist = hist.filter(function(r){ return !set[r.id]; });
    persistLocal(); hemit();
    if (!cl.length || !user) return Promise.resolve({ ok: true });
    return Promise.resolve(sb.from('upload_history').delete().in('id', cl)).then(function(res){
      return res.error ? { ok: false, msg: 'Gagal menghapus dari akunmu: ' + res.error.message } : { ok: true };
    });
  }
  function hclear(){
    var hadCloud = hist.some(function(r){ return !isLocalId(r.id); });
    hist = []; hlset([]); hemit();
    if (!hadCloud || !user) return Promise.resolve({ ok: true });
    return Promise.resolve(sb.from('upload_history').delete().eq('user_id', user.id)).then(function(res){
      return res.error ? { ok: false, msg: 'Gagal menghapus dari akunmu: ' + res.error.message } : { ok: true };
    });
  }

  window.MSAuth = {
    max: MAX,
    list: function(){ return accs.slice(); },
    add: add,
    remove: remove,
    onChange: function(f){ subs.push(f); },
    info: function(){ return { cloud: cloud, loading: loading, warn: warn, login: !!user }; },
    hist: {
      max: HMAX,
      list: function(){ return hist.slice(); },
      add: hadd,
      update: hupdate,
      remove: hremove,
      clear: hclear,
      onChange: function(f){ hsubs.push(f); },
      info: function(){ return { cloud: hcloud, warn: hwarn, login: !!user }; }
    }
  };

  function importLocal(loc){
    var p = Promise.resolve();
    loc.slice(0, MAX).forEach(function(a){
      p = p.then(function(){ return sb.from('roblox_accounts').insert({ user_id: user.id, roblox_id: a.u, api_key: a.k, name: a.n || '' }); });
    });
    return p.then(function(){ return pull(true); }, function(){ return pull(true); });
  }
  function pull(noImport){
    loading = true; warn = ''; note('memuat...'); emit();
    var uid0 = user && user.id;
    return Promise.resolve(sb.from('roblox_accounts').select('roblox_id,api_key,name').order('created_at')).then(function(r){
      if (!user || user.id !== uid0) return;
      loading = false;
      if (r.error) {
        cloud = false;
        warn = 'Penyimpanan di akun Discord belum siap (' + (r.error.message || 'error') + '). Akun Roblox sementara disimpan di perangkat ini.';
        note('gagal memuat'); setAccs(lget()); return;
      }
      cloud = true;
      var rows = (r.data || []).map(function(d){ return { u: String(d.roblox_id), k: d.api_key, n: d.name || '' }; });
      if (!rows.length && !noImport) { var loc = lget(); if (loc.length) return importLocal(loc); }
      note(rows.length ? rows.length + ' akun tersimpan di akunmu' : '');
      setAccs(rows);
    });
  }

  /* ---------- login Discord ---------- */
  function login(){
    if (!sb) return;
    sb.auth.signInWithOAuth({ provider: 'discord', options: { redirectTo: location.origin + location.pathname } })
      .then(function(r){ if (r && r.error) alert('Login gagal: ' + r.error.message); });
  }
  function logout(){
    lset([]); hlset([]);
    try { sessionStorage.removeItem(GUEST); } catch(e){}
    user = null; cloud = false; warn = ''; hcloud = false; hwarn = '';
    setAccs([]); hset([]); render();
    if (sb) sb.auth.signOut({ scope: 'local' });
  }
  function wipe(){
    if (!accs.length || !confirm('Hapus semua akun Roblox yang tersimpan?')) return;
    removeAll().then(function(r){ note(r.ok ? 'semua akun dihapus' : 'gagal menghapus'); });
  }

  function bar(){
    var b = $('userbar'); if (!b) return;
    b.textContent = '';
    if (!sb) return;
    if (user) {
      var m = user.user_metadata || {};
      var name = (m.custom_claims && m.custom_claims.global_name) || m.full_name || m.name || 'Discord';
      if (m.avatar_url) { var im = el('img'); im.alt = ''; im.src = m.avatar_url; b.appendChild(im); }
      b.appendChild(el('span', 'un', name));
      b.appendChild(el('span', 'sync')).id = 'syncmsg';
      var w = el('button', 'btn', 'Hapus semua akun'); w.type = 'button'; w.onclick = wipe; b.appendChild(w);
      var o = el('button', 'btn', 'Logout'); o.type = 'button'; o.onclick = logout; b.appendChild(o);
    } else {
      b.appendChild(el('span', 'un', 'Tanpa login'));
      var i = el('button', 'btn', 'Login Discord'); i.type = 'button'; i.onclick = login; b.appendChild(i);
    }
  }
  function render(){
    if (user || isGuest() || !sb) show('s-app'); else show('s-landing');
    bar();
  }

  function onSession(session){
    var prev = user && user.id;
    user = session ? session.user : null;
    render();
    if (user && user.id !== prev) { pull(); hpull(); }
    else if (!user) { cloud = false; warn = ''; hcloud = false; hwarn = ''; setAccs(lget()); hset(hlget()); }
  }

  var bl = $('btn-login'), bg = $('btn-guest');
  if (bl) bl.onclick = login;
  if (bg) bg.onclick = function(){ try { sessionStorage.setItem(GUEST, '1'); } catch(e){} render(); };
  accs = lget();
  if (!sb) { render(); return; }
  sb.auth.onAuthStateChange(function(ev, session){ setTimeout(function(){ onSession(session); }, 0); });
})();
