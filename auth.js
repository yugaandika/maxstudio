(function(){
  var URL_ = 'https://aqfeyrgwysxdouaetmat.supabase.co';
  var KEY_ = 'sb_publishable_14SgkcxUcbr2cCtF5sd-kg_lh4IyfoW';
  var LSK = 'maxstudio.roblox', GUEST = 'maxstudio.guest';
  var body = document.body;
  function $(id){ return document.getElementById(id); }
  function show(s){ body.classList.remove('boot', 's-landing', 's-app'); body.classList.add(s); }
  function isGuest(){ try { return sessionStorage.getItem(GUEST) === '1'; } catch(e){ return false; } }
  var sb = null;
  try { sb = window.supabase.createClient(URL_, KEY_, { auth: { flowType: 'pkce', persistSession: true, detectSessionInUrl: true } }); } catch(e){}
  var user = null, muted = false, timer = 0, last = '';
  var ukey = $('ukey'), uid = $('uid'), urem = $('uremember');
  function sig(k, u){ return k + '|' + u; }
  function note(t){ var n = $('syncmsg'); if (n) n.textContent = t || ''; }
  function el(tag, cls, txt){ var e = document.createElement(tag); if (cls) e.className = cls; if (txt) e.textContent = txt; return e; }

  function login(){
    if (!sb) return;
    sb.auth.signInWithOAuth({ provider: 'discord', options: { redirectTo: location.origin + location.pathname } })
      .then(function(r){ if (r && r.error) alert('Login gagal: ' + r.error.message); });
  }
  function clearFields(){
    muted = true;
    try { localStorage.removeItem(LSK); } catch(e){}
    ukey.value = ''; uid.value = ''; last = '';
    muted = false;
  }
  function logout(){
    clearFields();
    try { sessionStorage.removeItem(GUEST); } catch(e){}
    user = null; render();
    if (sb) sb.auth.signOut({ scope: 'local' });
  }
  function wipe(){
    if (!user || !confirm('Hapus API key dan User ID yang tersimpan di akunmu?')) return;
    sb.from('roblox_creds').delete().eq('user_id', user.id).then(function(r){
      note(r.error ? 'gagal menghapus' : 'dihapus dari akun');
    });
    clearFields();
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
      var w = el('button', 'btn', 'Hapus tersimpan'); w.type = 'button'; w.onclick = wipe; b.appendChild(w);
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

  function push(v){
    var o; try { o = JSON.parse(v); } catch(e){ return; }
    if (!o || !o.k || !user) return;
    var s = sig(o.k, o.u || ''); if (s === last) return;
    last = s;
    sb.from('roblox_creds').upsert({ user_id: user.id, api_key: o.k, roblox_id: o.u || '', updated_at: new Date().toISOString() })
      .then(function(r){ if (r.error) { last = ''; note('gagal menyimpan'); } else note('tersimpan di akunmu'); });
  }
  function queue(v){
    if (muted || !user || !sb) return;
    clearTimeout(timer); timer = setTimeout(function(){ push(v); }, 500);
  }
  /* semua penyimpanan key dari kode utama (saveCreds) ikut disalin ke akun */
  var _set = Storage.prototype.setItem;
  Storage.prototype.setItem = function(k, v){
    _set.apply(this, arguments);
    if (k === LSK && this === window.localStorage) queue(v);
  };

  function pull(){
    note('memuat...');
    sb.from('roblox_creds').select('api_key,roblox_id').eq('user_id', user.id).maybeSingle().then(function(r){
      if (r.error) { note('gagal memuat'); return; }
      var d = r.data;
      if (d && d.api_key) {
        ukey.value = d.api_key; uid.value = d.roblox_id || ''; urem.checked = true;
        last = sig(d.api_key, d.roblox_id || '');
        ukey.dispatchEvent(new Event('change'));
        note('terisi dari akunmu');
      } else if (ukey.value.trim()) {
        queue(JSON.stringify({ k: ukey.value.trim(), u: uid.value.trim() }));
      } else note('');
    });
  }
  function onSession(session){
    var prev = user && user.id;
    user = session ? session.user : null;
    render();
    if (user && user.id !== prev) pull();
  }

  var bl = $('btn-login'), bg = $('btn-guest');
  if (bl) bl.onclick = login;
  if (bg) bg.onclick = function(){ try { sessionStorage.setItem(GUEST, '1'); } catch(e){} render(); };
  if (!sb) { render(); return; }
  sb.auth.onAuthStateChange(function(ev, session){ setTimeout(function(){ onSession(session); }, 0); });
})();
