      done(false);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function(){ done(true); }, fallback);
    else fallback();
  });

  /* waveform: two cached layers (dim, bright), bright is clipped to the playhead */
  var dim = null, bright = null, W = 0, H = 0;
  function buildWave(){
    var dpr = window.devicePixelRatio || 1;
    W = wave.clientWidth; H = wave.clientHeight;
    wave.width = Math.round(W*dpr); wave.height = Math.round(H*dpr);
    dim = document.createElement('canvas'); bright = document.createElement('canvas');
    dim.width = bright.width = wave.width; dim.height = bright.height = wave.height;
    var gd = dim.getContext('2d'), gb = bright.getContext('2d');
    gd.scale(dpr,dpr); gb.scale(dpr,dpr);
    gd.fillStyle = '#25402f'; gb.fillStyle = '#3ddc84';
    if (!buf){ gd.fillRect(0, H/2, W, 1); paint(); return; }
    var data = buf.getChannelData(0), bars = Math.max(1, Math.floor(W/3)), step = Math.max(1, Math.floor(data.length/bars));
    var skip = Math.max(1, step >> 6);
    for (var i = 0; i < bars; i++){
      var mx = 0;
      for (var j = 0; j < step; j += skip){ var v = Math.abs(data[i*step + j] || 0); if (v > mx) mx = v; }
      var bh = Math.max(2, mx*H*0.92);
      gd.fillRect(i*3, (H-bh)/2, 2, bh); gb.fillRect(i*3, (H-bh)/2, 2, bh);
    }
    paint();
  }
  function paint(){
    if (!dim || !dim.width || !dim.height) return;
    var g = wave.getContext('2d'), dpr = window.devicePixelRatio || 1;
    g.setTransform(1,0,0,1,0,0); g.clearRect(0,0,wave.width,wave.height);
    g.drawImage(dim,0,0);
    var d = audio.duration, x = (d && isFinite(d)) ? (audio.currentTime / d) * wave.width : 0;
    if (x > 0){ g.save(); g.beginPath(); g.rect(0,0,x,wave.height); g.clip(); g.drawImage(bright,0,0); g.restore(); g.fillStyle = '#fff'; g.fillRect(Math.round(x), 0, Math.max(1,dpr), wave.height); }
  }
  var raf = 0;
  function loop(){ paint(); raf = audio.paused ? 0 : requestAnimationFrame(loop); }
  audio.addEventListener('play', function(){ if (!raf) raf = requestAnimationFrame(loop); });
  ['pause','seeked','ended','timeupdate','loadedmetadata'].forEach(function(t){ audio.addEventListener(t, function(){ if (!raf) paint(); }); });
  wave.addEventListener('click', function(e){
    var d = audio.duration; if (!d || !isFinite(d)) return;
    var r = wave.getBoundingClientRect(); audio.currentTime = Math.min(1, Math.max(0, (e.clientX - r.left)/r.width)) * d;
  });
  var rt = 0; window.addEventListener('resize', function(){ clearTimeout(rt); rt = setTimeout(buildWave, 150); });

  /* file loading */
  var fileInput = $('file'), drop = $('drop');
  fileInput.addEventListener('change', function(){ if (fileInput.files[0]) load(fileInput.files[0]); });
  ['dragenter','dragover'].forEach(function(t){ drop.addEventListener(t, function(e){ e.preventDefault(); drop.classList.add('over'); }); });
  ['dragleave','drop'].forEach(function(t){ drop.addEventListener(t, function(e){ e.preventDefault(); drop.classList.remove('over'); }); });
  drop.addEventListener('drop', function(e){ var f = e.dataTransfer && e.dataTransfer.files[0]; if (f) load(f); });

  async function load(f){
    setStatus('Membaca file...');
    $('go').disabled = true;
    try {
      var ab = await f.arrayBuffer();
      var c = new Ctx();
      buf = await c.decodeAudioData(ab.slice(0));
      if (c.close) c.close();
    } catch(e){
      buf = null;
      setStatus('File ini tidak bisa dibaca. Coba mp3, ogg, atau wav.', true);
      return;
    }
    file = f; clearResult();
    if (url) URL.revokeObjectURL(url);
    url = URL.createObjectURL(f);
    audio.src = url;
    $('i-name').textContent = f.name;
    $('i-dur').textContent = fmtTime(buf.duration);
    $('i-ch').textContent = buf.numberOfChannels === 1 ? 'Mono' : (buf.numberOfChannels === 2 ? 'Stereo' : buf.numberOfChannels);
    $('i-sr').textContent = buf.sampleRate + ' Hz';
    $('info').hidden = false;
    $('drop-title').textContent = 'GANTI FILE';
    $('go').disabled = false;
    setStatus('Siap. Atur kecepatan, lalu konversi.');
    autoCache = {}; origPeak = stats(buf).peak; scheduleAuto();
    render(); buildWave();
  }

  /* export */
  var fmtSel = $('fmt');
  fmtSel.addEventListener('change', function(){ $('qwrap').hidden = fmtSel.value !== 'ogg'; });
  var tick = function(){ return new Promise(function(r){ setTimeout(r, 0); }); };

  async function encodeOgg(ab, q, onProg){
    if (!window.__createOggEncoder) throw new Error('no-encoder');
    var enc = await window.__createOggEncoder();
    var chs = ab.numberOfChannels;
    enc.configure({ channels: chs, sampleRate: ab.sampleRate, vbrQuality: q });
    var data = []; for (var i = 0; i < chs; i++) data.push(ab.getChannelData(i));
    var parts = [], N = ab.length, step = ab.sampleRate * 2;
    for (var s = 0; s < N; s += step){
      var e = Math.min(s + step, N);
      parts.push(enc.encode(data.map(function(d){ return d.subarray(s, e); })).slice());
      onProg(e / N); await tick();
    }
    parts.push(enc.finalize().slice());
    return new Blob(parts, { type: 'audio/ogg' });
  }

  function encodeWav(ab){
    var ch = ab.numberOfChannels, n = ab.length, sr = ab.sampleRate, bytes = n*ch*2;
    var dv = new DataView(new ArrayBuffer(44 + bytes));
    function w(o, s){ for (var i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); }
    w(0,'RIFF'); dv.setUint32(4, 36 + bytes, true); w(8,'WAVE'); w(12,'fmt ');
    dv.setUint32(16,16,true); dv.setUint16(20,1,true); dv.setUint16(22,ch,true);
    dv.setUint32(24,sr,true); dv.setUint32(28,sr*ch*2,true); dv.setUint16(32,ch*2,true); dv.setUint16(34,16,true);
    w(36,'data'); dv.setUint32(40,bytes,true);
    var chans = []; for (var c = 0; c < ch; c++) chans.push(ab.getChannelData(c));
    var o = 44;
    for (var i = 0; i < n; i++) for (var k = 0; k < ch; k++){
      var v = Math.max(-1, Math.min(1, chans[k][i]));
      dv.setInt16(o, v < 0 ? v*32768 : v*32767, true); o += 2;
    }
    return new Blob([dv], { type: 'audio/wav' });
  }

  function save(blob, name){
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){ URL.revokeObjectURL(a.href); }, 15000);
  }

  $('go').addEventListener('click', async function(){
    if (!buf || busy) return;
    busy = true; $('go').disabled = true;
    var prog = $('prog'); prog.hidden = false; prog.value = 0;
    try {
      setStatus('Mengubah kecepatan...');
      if (auto){ clearTimeout(autoTimer); await runAuto(); }
      var base = speed > 1 ? await prefilter(buf, speed) : buf;
      var chs = buf.numberOfChannels === 1 ? 1 : 2;
      var sr = Math.min(buf.sampleRate, 48000), outSec = buf.duration / speed;
      var cut = $('trim').checked && outSec > MAXSEC;
      var len = Math.max(1, cut ? Math.floor(MAXSEC * sr) : Math.ceil(outSec * sr));
      var off = new OfflineAudioContext(chs, len, sr);
      var src = off.createBufferSource();
      src.buffer = base; src.playbackRate.value = speed;
      var gn = off.createGain(); gn.gain.value = gain; src.connect(gn);
      if (cut){ gn.gain.setValueAtTime(gain, MAXSEC - 2); gn.gain.linearRampToValueAtTime(0, MAXSEC); }
      if (limiter && gain > 1){ var lm = makeLimiter(off); gn.connect(lm); lm.connect(off.destination); }
      else gn.connect(off.destination);
      src.start(0);
      var out = await off.startRendering();
      var blob, ext = fmtSel.value;
      if (ext === 'ogg'){
        setStatus('Menyandikan OGG...');
        blob = await encodeOgg(out, Number($('q').value), function(p){ prog.value = p; });
      } else {
        blob = encodeWav(out);
      }
      var base = file.name.replace(/\.[^.]+$/, '').replace(/[^\w\- ]+/g, '').trim() || 'musik';
      var name = base + '_' + fmtSpeed(speed) + 'x' + (gain !== 1 ? '_amp' + fmtSpeed(gain) + 'x' : '') + '.' + ext;
      setExported(blob, name, roblox(speed).code);
      var big = blob.size > 20 * 1048576;
      setStatus((cut ? 'Dipotong ke ' + fmtTime(MAXSEC) + ' (+fade out). ' : '') + (big ? 'Ukuran lebih dari 20 MB, Roblox akan menolak. Coba kualitas Hemat. ' : '') + 'Selesai: ' + name + ' (' + fmtSize(blob.size) + ', ' + fmtTime(out.duration) + '). Di Roblox: PlaybackSpeed = ' + roblox(speed).code + '.' + (gain !== 1 ? ' Amplify ' + fmtSpeed(gain) + '× (' + fmtDb(gain) + ') sudah di dalam file.' : ''), big);
    } catch(e){
      if (e && e.message === 'no-encoder') setStatus('Encoder OGG tidak tersedia. Pilih WAV sebagai cadangan.', true);
      else setStatus('Ekspor gagal. Coba file lain atau format WAV.', true);
    } finally {
      busy = false; $('go').disabled = !buf; prog.hidden = true;
    }
  });

  /* upload ke Roblox (Open Cloud Assets API) */
  var lastBlob = null, lastName = '', upBusy = false;
  var ukey = $('ukey'), uid = $('uid'), uname = $('uname'), upgo = $('upgo'), ustat = $('ustatus'), urem = $('uremember');
