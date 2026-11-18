/* =========================================================
   Sóng Nhạc – trình phát nhạc
   ========================================================= */
(() => {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];

  // ---------- Danh sách bài hát (lấy từ playlist.js) ----------
  const PALETTE = [['#1ed4a0', '#2563eb'], ['#f97316', '#7c3aed'], ['#38bdf8', '#1e3a8a'], ['#ec4899', '#4c1d95'],
    ['#22d3ee', '#10b981'], ['#b45309', '#fbbf24'], ['#84cc16', '#0f766e'], ['#f43f5e', '#f59e0b'], ['#6366f1', '#0f172a']];
  const hashNum = (s) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); };

  const tracks = (window.PLAYLIST || []).filter((x) => x && x.src).map((x, i) => ({
    id: 'song-' + hashNum(x.src + '|' + i),
    kind: 'song',
    title: x.title || x.src.split('/').pop(),
    artist: x.artist || 'Không rõ nghệ sĩ',
    genre: x.genre || 'Khác',
    src: x.src,
    cover: x.cover || '',
    featured: !!x.featured,
    colors: PALETTE[i % PALETTE.length],
    duration: 0,
  }));
  const byId = (id) => tracks.find((t) => t.id === id);

  // ---------- Lưu cài đặt trong trình duyệt (an toàn khi bị chặn) ----------
  const store = {
    get(k, fallback) { try { const v = localStorage.getItem('songnhac:' + k); return v == null ? fallback : JSON.parse(v); } catch { return fallback; } },
    set(k, v) { try { localStorage.setItem('songnhac:' + k, JSON.stringify(v)); } catch { /* bỏ qua */ } },
  };

  const state = {
    view: 'all',
    genre: null,
    query: '',
    current: null,
    queue: tracks.map((t) => t.id),
    history: [],
    shuffle: store.get('shuffle', false),
    repeat: store.get('repeat', 'off'), // off | all | one
    favs: new Set(store.get('favs', [])),
    loading: false,
    token: 0,
  };

  const audio = $('#audio');
  const app = $('#app');

  // ---------- Tiện ích ----------
  const fmt = (s) => {
    if (!isFinite(s) || s < 0) return '0:00';
    const m = Math.floor(s / 60), r = Math.floor(s % 60);
    return `${m}:${String(r).padStart(2, '0')}`;
  };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function coverStyle(t) {
    const h = hashNum(t.id);
    const img = t.cover ? `;background:center/cover no-repeat url('${encodeURI(t.cover).replace(/'/g, '%27')}')` : '';
    return `--c1:${t.colors[0]};--c2:${t.colors[1]};--x:${20 + (h % 50)}%;--y:${15 + ((h >> 3) % 45)}%;--angle:${(h >> 5) % 180}deg${img}`;
  }

  let toastTimer;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  const HEART = '<svg viewBox="0 0 24 24"><path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 8 3.6 4.5 7.1 4.5c2 0 3.6 1.1 4.9 2.9 1.3-1.8 2.9-2.9 4.9-2.9 3.5 0 5.7 3.5 4.4 6.8-1.8 4.6-9.3 9.2-9.3 9.2z"/></svg>';
  const PLAY = '<svg class="i-play" viewBox="0 0 24 24"><path d="M7 4.5v15l13-7.5z"/></svg>';
  const PAUSE = '<svg class="i-pause" viewBox="0 0 24 24"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>';

  // ---------- Lọc ----------
  function visibleTracks() {
    const q = state.query.trim().toLowerCase();
    const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
    const nq = norm(q);
    return tracks.filter((t) => {
      if (state.view === 'fav' && !state.favs.has(t.id)) return false;
      if (state.view === 'local' && t.kind !== 'local') return false;
      if (state.genre && t.genre !== state.genre) return false;
      if (nq && !norm(`${t.title} ${t.artist} ${t.genre}`).includes(nq)) return false;
      return true;
    });
  }

  // ---------- Vẽ giao diện ----------
  function renderGenres() {
    const genres = [...new Set(tracks.map((t) => t.genre))];
    $('#genreList').innerHTML = genres.map((g) =>
      `<button class="chip ${state.genre === g ? 'active' : ''}" data-genre="${esc(g)}">${esc(g)}</button>`).join('');
  }

  function featuredTracks() {
    const f = tracks.filter((t) => t.kind === 'song' && t.featured);
    return f.length ? f : tracks.filter((t) => t.kind === 'song').slice(0, 8);
  }

  function renderCards() {
    $('#cards').innerHTML = featuredTracks().map((t) => `
      <button class="card" data-id="${t.id}" aria-label="Phát ${esc(t.title)}">
        <div class="cover" style="${coverStyle(t)}">
          <span class="card-play">${PLAY}${PAUSE}</span>
        </div>
        <strong>${esc(t.title)}</strong>
        <span>${esc(t.artist)}</span>
      </button>`).join('');
  }

  function renderList() {
    const list = visibleTracks();
    const titles = { all: 'Tất cả bài hát', fav: 'Bài hát yêu thích', local: 'Nhạc của tôi' };
    $('#listTitle').textContent = titles[state.view] + (state.genre ? ` · ${state.genre}` : '');
    $('#listSub').textContent = list.length ? `${list.length} bài · ${fmt(list.reduce((s, t) => s + (t.duration || 0), 0))}` : '';
    $('#featuredBlock').hidden = state.view !== 'all' || !!state.query || !!state.genre;

    $('#tracklist').innerHTML = list.map((t, i) => `
      <div class="row" role="listitem" tabindex="0" data-id="${esc(t.id)}">
        <div class="num"><span class="n">${i + 1}</span><span class="eq"><i></i><i></i><i></i></span><svg class="hover-play" viewBox="0 0 24 24"><path class="fill" d="M7 4.5v15l13-7.5z"/></svg></div>
        <div class="cover" style="${coverStyle(t)}"></div>
        <div class="t"><strong>${esc(t.title)}</strong><span>${esc(t.artist)}</span></div>
        <div class="g">${esc(t.genre)}</div>
        <button class="icon-btn sm fav-btn ${state.favs.has(t.id) ? 'on' : ''}" data-fav="${esc(t.id)}" aria-label="Yêu thích">${HEART}</button>
        <div class="d">${t.duration ? fmt(t.duration) : '–:––'}</div>
      </div>`).join('');

    const empty = $('#empty');
    empty.hidden = list.length > 0;
    if (!list.length) {
      $('#emptyText').textContent =
        state.query ? `Không tìm thấy bài nào khớp với “${state.query}”.` :
        state.view === 'fav' ? 'Chưa có bài yêu thích. Bấm biểu tượng trái tim để lưu bài bạn thích.' :
        state.view === 'local' ? 'Chưa có nhạc từ máy. Bấm “Thêm nhạc” hoặc kéo thả file nhạc vào trang.' :
        'Không có bài hát nào.';
    }
    markCurrent();
  }

  function renderCounts() {
    $('#favCount').textContent = state.favs.size;
    $('#localCount').textContent = tracks.filter((t) => t.kind === 'local').length;
  }

  function renderAll() { renderGenres(); renderList(); renderCounts(); }

  function markCurrent() {
    $$('.row, .card').forEach((el) => el.classList.toggle('current', el.dataset.id === state.current));
  }

  function updateNowPlaying() {
    const t = byId(state.current) || tracks[0];
    const isCur = !!state.current;
    $('#hero').hidden = !t;
    if (!t) return;
    $('#heroEyebrow').textContent = isCur ? 'Đang phát' : 'Bài hát nổi bật';
    $('#heroTitle').textContent = t.title;
    $('#heroArtist').textContent = t.artist;
    $('#heroCover').setAttribute('style', coverStyle(t));
    $('#main').style.setProperty('--hero-c1', t.colors[0]);
    const meta = [t.genre, t.duration ? fmt(t.duration) : null, t.kind === 'local' ? 'File trên máy' : null].filter(Boolean);
    $('#heroMeta').innerHTML = meta.map((m) => `<span>${esc(m)}</span>`).join('');

    if (isCur) {
      $('#pTitle').textContent = t.title;
      $('#pArtist').textContent = t.artist;
      $('#pCover').setAttribute('style', coverStyle(t));
      document.title = `${t.title} · Sóng Nhạc`;
    }
    syncFavButtons();
    markCurrent();
    updateMediaSession(t);
  }

  function syncFavButtons() {
    const t = byId(state.current) || tracks[0];
    if (!t) return;
    $('#heroFav').classList.toggle('on', state.favs.has(t.id));
    $('#pFav').classList.toggle('on', !!state.current && state.favs.has(state.current));
    $$('[data-fav]').forEach((b) => b.classList.toggle('on', state.favs.has(b.dataset.fav)));
  }

  function setPlayingUI(playing) {
    app.classList.toggle('playing', playing);
    $('#playBtn').classList.toggle('is-playing', playing);
    $('#heroPlay').classList.toggle('is-playing', playing);
    $('#playBtn').setAttribute('aria-label', playing ? 'Tạm dừng' : 'Phát');
    if (!state.loading) $('#heroPlay span').textContent = playing ? 'Tạm dừng' : 'Phát';
    if (playing) startViz();
  }

  function setLoading(on) {
    state.loading = on;
    $('#playBtn').classList.toggle('is-loading', on);
    $('#heroPlay span').textContent = on ? 'Đang tạo nhạc…' : (audio.paused ? 'Phát' : 'Tạm dừng');
  }

  // ---------- Âm thanh & hiệu ứng sóng ----------
  let actx, analyser, freqData;
  function ensureAudioGraph() {
    // Khi mở bằng file:// (bấm đúp index.html), trình duyệt có thể chặn tiếng nếu nối vào Web Audio,
    // nên chỉ bật hiệu ứng sóng khi chạy qua http(s).
    if (location.protocol === 'file:') return;
    if (actx) { if (actx.state === 'suspended') actx.resume(); return; }
    try {
      actx = new (window.AudioContext || window.webkitAudioContext)();
      const src = actx.createMediaElementSource(audio);
      analyser = actx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.8;
      freqData = new Uint8Array(analyser.frequencyBinCount);
      src.connect(analyser).connect(actx.destination);
    } catch (e) { actx = null; analyser = null; }
  }

  const canvas = $('#viz');
  const c2d = canvas.getContext('2d');
  let vizRunning = false;
  function startViz() {
    if (vizRunning || !analyser) return;
    vizRunning = true;
    requestAnimationFrame(drawViz);
  }
  function drawViz() {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== w * dpr) { canvas.width = w * dpr; canvas.height = h * dpr; }
    c2d.setTransform(dpr, 0, 0, dpr, 0, 0);
    c2d.clearRect(0, 0, w, h);
    analyser.getByteFrequencyData(freqData);
    const bars = 32, gap = 3, bw = (w - 24 - gap * (bars - 1)) / bars;
    let energy = 0;
    for (let i = 0; i < bars; i++) {
      const v = freqData[Math.floor(i * (freqData.length * 0.75) / bars)] / 255;
      energy += v;
      const bh = Math.max(3, v * h * 0.55);
      c2d.fillStyle = `rgba(255,255,255,${0.35 + v * 0.5})`;
      const x = 12 + i * (bw + gap);
      c2d.beginPath();
      c2d.roundRect ? c2d.roundRect(x, h - 12 - bh, bw, bh, 2) : c2d.rect(x, h - 12 - bh, bw, bh);
      c2d.fill();
    }
    $('#heroCover').style.transform = `scale(${1 + (energy / bars) * 0.03})`;
    if (!audio.paused) requestAnimationFrame(drawViz);
    else { vizRunning = false; c2d.clearRect(0, 0, w, h); $('#heroCover').style.transform = ''; }
  }

  // ---------- Phát nhạc ----------
  async function playTrack(id, queueIds) {
    if (queueIds) state.queue = queueIds;
    const t = byId(id);
    if (!t) return;

    if (state.current === id && audio.src) { togglePlay(); return; }

    if (state.current && state.current !== id) {
      state.history.push(state.current);
      if (state.history.length > 50) state.history.shift();
    }
    state.current = id;
    const token = ++state.token;
    ensureAudioGraph();
    audio.pause();
    updateNowPlaying();

    setLoading(true);
    audio.src = t.src;
    try { await audio.play(); } catch (e) { if (token === state.token) setPlayingUI(false); }
    if (token === state.token) setLoading(false);
  }

  function togglePlay() {
    ensureAudioGraph();
    if (!state.current) {
      const list = visibleTracks();
      if (!list.length && !tracks.length) { toast('Chưa có bài hát nào. Hãy thêm nhạc vào playlist.js'); return; }
      const first = (list[0] || tracks[0]).id;
      playTrack(first, (list.length ? list : tracks).map((t) => t.id));
      return;
    }
    if (state.loading) return;
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  }

  function nextId(auto = false) {
    const q = state.queue.filter((id) => byId(id));
    if (!q.length) return null;
    if (state.shuffle && q.length > 1) {
      let n;
      do { n = q[Math.floor(Math.random() * q.length)]; } while (n === state.current);
      return n;
    }
    const i = q.indexOf(state.current);
    if (i === -1) return q[0];
    if (i + 1 < q.length) return q[i + 1];
    return auto && state.repeat === 'off' ? null : q[0];
  }

  function next(auto = false) {
    const id = nextId(auto);
    if (id == null) { audio.currentTime = 0; setPlayingUI(false); return; }
    if (id === state.current) { audio.currentTime = 0; audio.play().catch(() => {}); return; }
    playTrack(id);
  }

  function prev() {
    if (audio.currentTime > 3) { audio.currentTime = 0; return; }
    let id;
    if (state.shuffle && state.history.length) {
      id = state.history.pop();
      if (byId(id)) { state.current = null; playTrack(id); return; }
    }
    const q = state.queue.filter((x) => byId(x));
    const i = q.indexOf(state.current);
    id = q[(i - 1 + q.length) % q.length];
    if (id) playTrack(id);
  }

  // ---------- Sự kiện audio ----------
  const seek = $('#seek');
  let seeking = false;
  const setRange = (el, frac) => el.style.setProperty('--p', `${(frac * 100).toFixed(2)}%`);

  audio.addEventListener('play', () => { ensureAudioGraph(); setPlayingUI(true); });
  audio.addEventListener('pause', () => setPlayingUI(false));
  audio.addEventListener('ended', () => {
    if (state.repeat === 'one') { audio.currentTime = 0; audio.play(); return; }
    next(true);
  });
  audio.addEventListener('error', () => {
    const t = byId(state.current);
    if (!t || !audio.getAttribute('src')) return;
    setLoading(false);
    setPlayingUI(false);
    toast(t.kind === 'local' ? 'Không phát được file này.' : `Không tìm thấy file nhạc: ${t.src}`);
  });
  audio.addEventListener('loadedmetadata', () => {
    const t = byId(state.current);
    if (t && isFinite(audio.duration)) t.duration = audio.duration;
    $('#durTime').textContent = fmt(audio.duration);
  });
  audio.addEventListener('timeupdate', () => {
    if (seeking || !isFinite(audio.duration)) return;
    const f = audio.currentTime / audio.duration;
    seek.value = Math.round(f * 1000);
    setRange(seek, f);
    $('#curTime').textContent = fmt(audio.currentTime);
  });

  seek.addEventListener('input', () => {
    seeking = true;
    const f = seek.value / 1000;
    setRange(seek, f);
    if (isFinite(audio.duration)) $('#curTime').textContent = fmt(f * audio.duration);
  });
  seek.addEventListener('change', () => {
    if (isFinite(audio.duration)) audio.currentTime = (seek.value / 1000) * audio.duration;
    seeking = false;
  });

  // âm lượng
  const vol = $('#volume');
  let lastVol = store.get('volume', 80);
  function setVolume(v, save = true) {
    v = Math.max(0, Math.min(100, v));
    vol.value = v;
    audio.volume = v / 100;
    setRange(vol, v / 100);
    $('#muteBtn').classList.toggle('muted', v === 0);
    if (save) store.set('volume', v);
  }
  vol.addEventListener('input', () => { setVolume(+vol.value); if (+vol.value > 0) lastVol = +vol.value; });
  $('#muteBtn').addEventListener('click', toggleMute);
  function toggleMute() {
    if (+vol.value > 0) { lastVol = +vol.value; setVolume(0); } else setVolume(lastVol || 80);
  }

  // ---------- Nút điều khiển ----------
  $('#playBtn').addEventListener('click', togglePlay);
  $('#heroPlay').addEventListener('click', () => {
    if (!state.current) { const t = tracks[0]; if (t) playTrack(t.id, tracks.map((x) => x.id)); }
    else togglePlay();
  });
  $('#nextBtn').addEventListener('click', () => (state.current ? next() : togglePlay()));
  $('#prevBtn').addEventListener('click', () => (state.current ? prev() : togglePlay()));

  function syncModes() {
    $('#shuffleBtn').classList.toggle('on', state.shuffle);
    const rb = $('#repeatBtn');
    rb.classList.toggle('on', state.repeat !== 'off');
    rb.classList.toggle('one-mode', state.repeat === 'one');
    const label = { off: 'tắt', all: 'tất cả', one: 'một bài' }[state.repeat];
    rb.title = `Lặp lại: ${label}`;
    rb.setAttribute('aria-label', `Lặp lại: ${label}`);
  }
  $('#shuffleBtn').addEventListener('click', () => {
    state.shuffle = !state.shuffle; store.set('shuffle', state.shuffle); syncModes();
    toast(state.shuffle ? 'Đã bật phát ngẫu nhiên' : 'Đã tắt phát ngẫu nhiên');
  });
  $('#repeatBtn').addEventListener('click', () => {
    state.repeat = { off: 'all', all: 'one', one: 'off' }[state.repeat];
    store.set('repeat', state.repeat); syncModes();
    toast({ off: 'Đã tắt lặp lại', all: 'Lặp lại tất cả', one: 'Lặp lại một bài' }[state.repeat]);
  });

  function toggleFav(id) {
    if (!id) return;
    const t = byId(id);
    if (state.favs.has(id)) { state.favs.delete(id); toast(`Đã bỏ “${t.title}” khỏi Yêu thích`); }
    else { state.favs.add(id); toast(`Đã thêm “${t.title}” vào Yêu thích`); }
    store.set('favs', [...state.favs].filter((x) => byId(x)?.kind === 'song'));
    renderCounts();
    if (state.view === 'fav') renderList();
    syncFavButtons();
  }
  $('#heroFav').addEventListener('click', () => toggleFav((byId(state.current) || tracks[0])?.id));
  $('#pFav').addEventListener('click', () => toggleFav(state.current));

  // danh sách & thẻ
  $('#tracklist').addEventListener('click', (e) => {
    const fav = e.target.closest('[data-fav]');
    if (fav) { e.stopPropagation(); toggleFav(fav.dataset.fav); return; }
    const row = e.target.closest('.row');
    if (row) playTrack(row.dataset.id, visibleTracks().map((t) => t.id));
  });
  $('#tracklist').addEventListener('keydown', (e) => {
    const row = e.target.closest('.row');
    if (row && e.target === row && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault(); e.stopPropagation();
      playTrack(row.dataset.id, visibleTracks().map((t) => t.id));
    }
  });
  $('#cards').addEventListener('click', (e) => {
    const card = e.target.closest('.card');
    if (card) playTrack(card.dataset.id, featuredTracks().map((t) => t.id));
  });

  // chế độ xem
  function setView(v) {
    state.view = v;
    $$('[data-view]').forEach((b) => b.classList.toggle('active', b.dataset.view === v));
    renderList();
    $('#main').scrollTo({ top: 0, behavior: 'smooth' });
  }
  $$('[data-view]').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
  $('#genreList').addEventListener('click', (e) => {
    const c = e.target.closest('[data-genre]');
    if (!c) return;
    state.genre = state.genre === c.dataset.genre ? null : c.dataset.genre;
    renderGenres(); renderList();
  });

  let searchTimer;
  $('#search').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { state.query = e.target.value; renderList(); }, 120);
  });

  // ---------- Thêm nhạc từ máy ----------
  const AUDIO_EXT = /\.(mp3|wav|m4a|aac|ogg|oga|opus|flac|webm)$/i;
  let localSeq = 0;

  function addFiles(fileList) {
    const files = [...fileList].filter((f) => f.type.startsWith('audio/') || AUDIO_EXT.test(f.name));
    if (!files.length) { toast('Không có file nhạc hợp lệ.'); return; }
    files.forEach((f) => {
      const base = f.name.replace(/\.[^.]+$/, '').replace(/_/g, ' ');
      const parts = base.split(/\s+-\s+/);
      const id = `local-${++localSeq}`;
      const t = {
        id, kind: 'local',
        title: parts.length > 1 ? parts.slice(1).join(' - ') : base,
        artist: parts.length > 1 ? parts[0] : 'Từ máy của bạn',
        genre: 'Nhạc của tôi',
        colors: PALETTE[hashNum(f.name) % PALETTE.length],
        src: URL.createObjectURL(f),
        duration: 0,
      };
      tracks.push(t);
      const probe = new Audio();
      probe.preload = 'metadata';
      probe.src = t.src;
      probe.addEventListener('loadedmetadata', () => { t.duration = probe.duration; renderList(); });
    });
    toast(`Đã thêm ${files.length} bài vào “Nhạc của tôi”`);
    setView('local');
    renderGenres(); renderCounts();
  }
  ['#fileInput', '#fileInput2'].forEach((s) => $(s).addEventListener('change', (e) => { addFiles(e.target.files); e.target.value = ''; }));

  // kéo thả
  const drop = $('#drop');
  let dragDepth = 0;
  const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes('Files');
  window.addEventListener('dragenter', (e) => { if (!hasFiles(e)) return; e.preventDefault(); dragDepth++; drop.hidden = false; });
  window.addEventListener('dragover', (e) => { if (hasFiles(e)) e.preventDefault(); });
  window.addEventListener('dragleave', () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) drop.hidden = true; });
  window.addEventListener('drop', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault(); dragDepth = 0; drop.hidden = true;
    addFiles(e.dataTransfer.files);
  });

  // ---------- Phím tắt ----------
  window.addEventListener('keydown', (e) => {
    const tag = e.target.tagName;
    if (tag === 'INPUT' && e.target.type !== 'range') return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.code === 'Space' && !e.target.closest('button, .row')) { e.preventDefault(); togglePlay(); }
    else if (e.key === 'ArrowRight' && tag !== 'INPUT') { if (isFinite(audio.duration)) audio.currentTime = Math.min(audio.duration, audio.currentTime + 5); }
    else if (e.key === 'ArrowLeft' && tag !== 'INPUT') { audio.currentTime = Math.max(0, audio.currentTime - 5); }
    else if (e.key.toLowerCase() === 'n') { state.current ? next() : togglePlay(); }
    else if (e.key.toLowerCase() === 'm') { toggleMute(); }
  });

  // ---------- Điều khiển từ hệ điều hành (tai nghe, màn hình khoá) ----------
  function updateMediaSession(t) {
    if (!('mediaSession' in navigator) || !state.current) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({ title: t.title, artist: t.artist, album: 'Sóng Nhạc' });
    } catch { /* bỏ qua */ }
  }
  if ('mediaSession' in navigator) {
    const ms = navigator.mediaSession;
    try {
      ms.setActionHandler('play', () => togglePlay());
      ms.setActionHandler('pause', () => audio.pause());
      ms.setActionHandler('nexttrack', () => next());
      ms.setActionHandler('previoustrack', () => prev());
    } catch { /* bỏ qua */ }
  }

  // ---------- Khởi động ----------
  setVolume(store.get('volume', 80), false);
  setRange(seek, 0);
  syncModes();
  renderCards();
  renderAll();
  updateNowPlaying();
  // đọc thời lượng từng bài (file thiếu sẽ hiện –:––)
  tracks.forEach((t) => {
    const probe = new Audio();
    probe.preload = 'metadata';
    probe.addEventListener('loadedmetadata', () => {
      t.duration = probe.duration;
      renderList();
      if (t === (byId(state.current) || tracks[0])) updateNowPlaying();
    }, { once: true });
    probe.src = t.src;
  });
})();
