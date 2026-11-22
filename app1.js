(function(){
  var $ = function(id){ return document.getElementById(id); };
  var Ctx = window.AudioContext || window.webkitAudioContext;
  var buf = null, file = null, url = null, speed = 2, gain = 1, limiter = true, busy = false;
  var PRESETS = [0.5, 0.75, 1.25, 1.5, 2, 3], MAXSEC = 419;
  var audio = $('audio'), slider = $('slider'), num = $('num'), chips = $('chips'), wave = $('wave');

  function paintRange(el){ var mn = Number(el.min), mx = Number(el.max); el.style.setProperty('--p', ((el.value - mn) / (mx - mn) * 100) + '%'); }
  function fmtTime(s){ s = Math.max(0, Math.round(s)); return Math.floor(s/60) + ':' + String(s%60).padStart(2,'0'); }
  function fmtSpeed(v){ return String(Number(v.toFixed(2))); }
  function fmtSize(b){ return b > 1048576 ? (b/1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b/1024)) + ' KB'; }
  function roblox(s){
    var r = Number((1/s).toFixed(4));
    var exact = Math.abs(r*s - 1) < 1e-9;
    return { shown: String(r), exact: exact, code: exact ? String(r) : '1 / ' + fmtSpeed(s) };
  }
  function setStatus(msg, err){ var el = $('status'); el.textContent = msg; el.className = 'status' + (err ? ' err' : ''); }

  PRESETS.forEach(function(p){
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'chip'; b.textContent = p + '×'; b.dataset.v = p;
    b.addEventListener('click', function(){ setSpeed(p); });
    chips.appendChild(b);
  });

  function setSpeed(v){
    v = Number(v);
    if (!isFinite(v)) return;
    speed = Math.min(4, Math.max(0.25, Math.round(v*100)/100));
    render(); scheduleAuto();
  }

  function render(){
    var r = roblox(speed);
    $('sv').textContent = fmtSpeed(speed) + '×';
    $('rv').textContent = r.shown;
    $('code').textContent = 'sound.PlaybackSpeed = ' + r.code;
    $('check').textContent = fmtSpeed(speed) + ' × ' + r.shown + (r.exact ? ' = 1' : ' ≈ 1');
    if (document.activeElement !== slider) slider.value = speed;
    paintRange(slider);
    if (document.activeElement !== num) num.value = fmtSpeed(speed);
    Array.prototype.forEach.call(chips.children, function(c){ c.setAttribute('aria-pressed', Number(c.dataset.v) === speed ? 'true' : 'false'); });
    var od = buf ? buf.duration / speed : 0;
    $('newdur').textContent = buf ? fmtTime(od) + (od > MAXSEC ? ($('trim').checked ? ' → dipotong ke ' + fmtTime(MAXSEC) : ' (lewat batas Roblox)') : '') : '-';
    try { audio.preservesPitch = false; audio.mozPreservesPitch = false; audio.webkitPreservesPitch = false; } catch(e){}
    audio.defaultPlaybackRate = speed;
    audio.playbackRate = speed;
  }

  /* amplify */
  var AMP_PRESETS = [0.5, 1, 1.5, 2, 3], achips = $('achips'), aslider = $('aslider'), anum = $('anum');
  var actx = null, msrc = null, gnode = null, comp = null;
  function fmtDb(g){ var d = 20 * Math.log10(g); return (d > 0 ? '+' : '') + d.toFixed(1) + ' dB'; }
  function makeLimiter(c){
    var n = c.createDynamicsCompressor();
    n.threshold.value = -3; n.knee.value = 0; n.ratio.value = 20; n.attack.value = 0.003; n.release.value = 0.1;
    return n;
  }
  AMP_PRESETS.forEach(function(p){
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'chip'; b.textContent = p + '×'; b.dataset.v = p;
    b.addEventListener('click', function(){ setGain(p); });
    achips.appendChild(b);
  });
  function clampG(v){ return Math.min(4, Math.max(0.1, Math.round(v*100)/100)); }
  var auto = true, offset = 1, autoGain = 1, autoTok = 0, autoTimer = 0, origPeak = 1, autoCache = {}, autoBusy = false, autoDirty = false;
  function stats(b){
    var sum = 0, peak = 0, n = 0;
    for (var c = 0; c < b.numberOfChannels; c++){
      var d = b.getChannelData(c);
      for (var i = 0; i < d.length; i++){ var v = d[i], a = v < 0 ? -v : v; sum += v*v; if (a > peak) peak = a; }
      n += d.length;
    }
    return { rms: n ? Math.sqrt(sum / n) : 0, peak: peak };
  }
  function excerpt(b, secs){
    var N = Math.floor(secs * b.sampleRate);
    if (b.length <= N) return b;
    try {
      var start = Math.floor((b.length - N) / 2);
      var nb = new AudioBuffer({ length: N, numberOfChannels: b.numberOfChannels, sampleRate: b.sampleRate });
      for (var c = 0; c < b.numberOfChannels; c++) nb.copyToChannel(b.getChannelData(c).subarray(start, start + N), c);
      return nb;
    } catch(e){ return b; }
  }
  /* saring frekuensi tinggi sebelum dipercepat, supaya tidak "kresek" (aliasing) */
  async function prefilter(b, s){
    var chs = b.numberOfChannels === 1 ? 1 : 2;
    var off = new OfflineAudioContext(chs, b.length, b.sampleRate);
    var src = off.createBufferSource(); src.buffer = b;
    var f1 = off.createBiquadFilter(), f2 = off.createBiquadFilter();
    f1.type = f2.type = 'lowpass';
    f1.frequency.value = f2.frequency.value = Math.max(200, 0.45 * b.sampleRate / s);
    f1.Q.value = f2.Q.value = -3;
    src.connect(f1); f1.connect(f2); f2.connect(off.destination); src.start(0);
    return off.startRendering();
  }
  async function renderSped(b, s){
    var base = s > 1 ? await prefilter(b, s) : b;
    var chs = b.numberOfChannels === 1 ? 1 : 2;
    var off = new OfflineAudioContext(chs, Math.max(1, Math.ceil(base.length / s)), base.sampleRate);
    var src = off.createBufferSource(); src.buffer = base; src.playbackRate.value = s;
    src.connect(off.destination); src.start(0);
    return off.startRendering();
  }
  /* simulasi: file dipercepat lalu diputar balik 1/speed (seperti di Roblox), bandingkan loudness dengan aslinya */
  async function runAuto(){
    var tok = ++autoTok, sp = speed;
    try {
      if (autoCache[sp] === undefined){
        var e = excerpt(buf, 8), a = stats(e);
        var sped = await renderSped(e, sp);
        var back = await renderSped(sped, 1 / sp);
        var b = stats(back);
        autoCache[sp] = Math.min(2, Math.max(0.5, b.rms > 1e-6 ? a.rms / b.rms : 1));
      }
      if (tok !== autoTok) return;
      autoGain = autoCache[sp];
    } catch(err){ autoGain = 1; }
    if (tok !== autoTok) return;
    applyAuto();
  }
  function applyAuto(){ gain = clampG(autoGain * offset); renderAmp(); }
  function scheduleAuto(){
    if (!auto) return;
    if (!buf){ autoGain = 1; applyAuto(); return; }
    if (autoBusy){ autoDirty = true; return; }
    autoBusy = true;
    runAuto().then(function(){ autoBusy = false; if (autoDirty){ autoDirty = false; scheduleAuto(); } });
  }
  function setGain(v){
    v = Number(v);
    if (!isFinite(v)) return;
    gain = clampG(v);
    if (auto) offset = Math.min(8, Math.max(0.05, gain / autoGain));
    renderAmp();
  }
  function applyGraph(){
    if (!actx) return;
    try {
      gnode.gain.value = gain;
      msrc.disconnect(); gnode.disconnect(); comp.disconnect();
      msrc.connect(gnode);
      if (limiter && gain > 1){ gnode.connect(comp); comp.connect(actx.destination); }
      else gnode.connect(actx.destination);
    } catch(e){}
  }
  function ensureGraph(){
    if (actx || !Ctx) return;
    try {
      actx = new Ctx();
      msrc = actx.createMediaElementSource(audio);
      gnode = actx.createGain();
      comp = makeLimiter(actx);
      applyGraph();
    } catch(e){ actx = null; }
  }
  function renderAmp(){
    $('av').textContent = fmtSpeed(gain) + '×';
    $('adb').textContent = fmtDb(gain);
    $('ainfo').textContent = auto ? '(auto ' + fmtSpeed(autoGain) + '×)' : '';
    if (document.activeElement !== aslider) aslider.value = gain;
    paintRange(aslider);
    if (document.activeElement !== anum) anum.value = fmtSpeed(gain);
    Array.prototype.forEach.call(achips.children, function(c){ c.setAttribute('aria-pressed', Number(c.dataset.v) === gain ? 'true' : 'false'); });
    applyGraph();
  }
  aslider.addEventListener('input', function(){ setGain(aslider.value); });
  anum.addEventListener('input', function(){ if (anum.value !== '') setGain(anum.value); });
  anum.addEventListener('blur', renderAmp);
  $('auto').addEventListener('change', function(e){ auto = e.target.checked; offset = 1; if (auto) scheduleAuto(); else renderAmp(); });
  $('limit').addEventListener('change', function(e){ limiter = e.target.checked; applyGraph(); });
  audio.addEventListener('play', function(){ ensureGraph(); if (actx && actx.state === 'suspended') actx.resume(); });

  slider.addEventListener('input', function(){ setSpeed(slider.value); });
  num.addEventListener('input', function(){ if (num.value !== '') setSpeed(num.value); });
  num.addEventListener('blur', render);
  $('loop').addEventListener('change', function(e){ audio.loop = e.target.checked; });
  $('trim').addEventListener('change', render);

  $('copy').addEventListener('click', function(){
    var text = $('code').textContent, btn = $('copy');
    function done(ok){ btn.textContent = ok ? 'TERSALIN' : 'SALIN MANUAL'; setTimeout(function(){ btn.textContent = 'SALIN'; }, 1600); }
    var fallback = function(){
      try { var r = document.createRange(); r.selectNodeContents($('code')); var s = getSelection(); s.removeAllRanges(); s.addRange(r); } catch(e){}
