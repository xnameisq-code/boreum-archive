(() => {
  const audio = document.getElementById('audio');
  const trackListEl = document.getElementById('trackList');
  const npTitle = document.getElementById('npTitle');
  const npIndex = document.getElementById('npIndex');
  const playBtn = document.getElementById('playBtn');
  const playIcon = document.getElementById('playIcon');
  const pauseIcon = document.getElementById('pauseIcon');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const shuffleBtn = document.getElementById('shuffleBtn');
  const repeatBtn = document.getElementById('repeatBtn');
  const repeatLabel = document.getElementById('repeatLabel');
  const seek = document.getElementById('seek');
  const curTimeEl = document.getElementById('curTime');
  const durTimeEl = document.getElementById('durTime');
  const moonShadow = document.getElementById('moonShadow');

  let playlist = [];
  let order = [];        // array of indices into `playlist`, defines play order
  let posInOrder = -1;   // position within `order`
  let shuffleOn = false;
  let repeatMode = 'off'; // off | all | one
  let isSeeking = false;

  const fmtTime = (s) => {
    if (!isFinite(s) || s < 0) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  function baseOrder() {
    return playlist.map((_, i) => i);
  }

  function shuffledOrder() {
    const arr = baseOrder();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function buildTrackList() {
    trackListEl.innerHTML = '';
    playlist.forEach((track, i) => {
      const li = document.createElement('li');
      li.className = 'track-row';
      li.dataset.index = i;
      li.innerHTML = `
        <span class="track-num">${String(i + 1).padStart(2, '0')}</span>
        <span class="track-title">${track.title}</span>
      `;
      li.addEventListener('click', () => {
        // jump: rebuild order starting from this track, respecting shuffle state
        order = shuffleOn ? shuffledOrder() : baseOrder();
        const p = order.indexOf(i);
        posInOrder = p >= 0 ? p : 0;
        if (p < 0) order.unshift(i), posInOrder = 0;
        playAt(posInOrder);
      });
      trackListEl.appendChild(li);
    });
  }

  function highlightActive(playlistIndex) {
    [...trackListEl.children].forEach((li) => {
      li.classList.toggle('active', Number(li.dataset.index) === playlistIndex);
    });
  }

  function updateMoonPhase(playlistIndex) {
    // purely decorative: sweeps the shadow across the disc as you move through the archive
    const total = playlist.length || 1;
    const progress = (playlistIndex + 1) / total; // 0..1
    const cx = 120, r = 86;
    const x = cx - r + progress * (2 * r);
    moonShadow.setAttribute('x', x.toFixed(1));
  }

  function playAt(orderPos) {
    if (orderPos < 0 || orderPos >= order.length) return;
    posInOrder = orderPos;
    const plIndex = order[posInOrder];
    const track = playlist[plIndex];
    audio.src = track.file;
    audio.play().catch(() => {});
    npTitle.textContent = track.title;
    npIndex.textContent = `${String(plIndex + 1).padStart(2, '0')} / ${String(playlist.length).padStart(2, '0')}`;
    highlightActive(plIndex);
    updateMoonPhase(plIndex);
  }

  function togglePlay() {
    if (!audio.src) {
      if (playlist.length) {
        order = shuffleOn ? shuffledOrder() : baseOrder();
        playAt(0);
      }
      return;
    }
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  }

  function goNext(auto) {
    if (!order.length) return;
    if (repeatMode === 'one' && auto) {
      audio.currentTime = 0;
      audio.play().catch(() => {});
      return;
    }
    let next = posInOrder + 1;
    if (next >= order.length) {
      if (repeatMode === 'all') {
        next = 0;
      } else {
        // stop at end of list
        audio.pause();
        return;
      }
    }
    playAt(next);
  }

  function goPrev() {
    if (!order.length) return;
    // if we're a few seconds into the track, restart it instead of going back
    if (audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    let prev = posInOrder - 1;
    if (prev < 0) prev = repeatMode === 'all' ? order.length - 1 : 0;
    playAt(prev);
  }

  // ---- controls ----

  playBtn.addEventListener('click', togglePlay);
  nextBtn.addEventListener('click', () => goNext(false));
  prevBtn.addEventListener('click', goPrev);

  shuffleBtn.addEventListener('click', () => {
    shuffleOn = !shuffleOn;
    shuffleBtn.setAttribute('aria-pressed', String(shuffleOn));
    const currentPlIndex = order[posInOrder];
    order = shuffleOn ? shuffledOrder() : baseOrder();
    if (currentPlIndex !== undefined) {
      // keep currently playing track in place, reshuffle the rest
      const idx = order.indexOf(currentPlIndex);
      if (idx > -1) {
        order.splice(idx, 1);
        order.unshift(currentPlIndex);
      }
      posInOrder = 0;
    }
  });

  const repeatModes = ['off', 'all', 'one'];
  const repeatLabels = { off: '반복 꺼짐', all: '전체 반복', one: '한 곡 반복' };
  repeatBtn.addEventListener('click', () => {
    const idx = repeatModes.indexOf(repeatMode);
    repeatMode = repeatModes[(idx + 1) % repeatModes.length];
    repeatBtn.dataset.mode = repeatMode;
    repeatBtn.setAttribute('aria-pressed', String(repeatMode !== 'off'));
    repeatLabel.textContent = repeatLabels[repeatMode];
  });

  audio.addEventListener('play', () => {
    playIcon.style.display = 'none';
    pauseIcon.style.display = '';
  });
  audio.addEventListener('pause', () => {
    playIcon.style.display = '';
    pauseIcon.style.display = 'none';
  });
  audio.addEventListener('ended', () => goNext(true));

  audio.addEventListener('loadedmetadata', () => {
    durTimeEl.textContent = fmtTime(audio.duration);
    seek.max = audio.duration || 0;
  });
  audio.addEventListener('timeupdate', () => {
    if (isSeeking) return;
    curTimeEl.textContent = fmtTime(audio.currentTime);
    seek.value = audio.currentTime;
  });
  seek.addEventListener('input', () => { isSeeking = true; curTimeEl.textContent = fmtTime(Number(seek.value)); });
  seek.addEventListener('change', () => { audio.currentTime = Number(seek.value); isSeeking = false; });

  // keyboard: space to toggle play when not focused on the seek bar
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && document.activeElement !== seek) {
      e.preventDefault();
      togglePlay();
    }
  });

  // ---- light deterrents against casual downloading ----
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  audio.addEventListener('dragstart', (e) => e.preventDefault());

  // ---- load playlist ----
  fetch('playlist.json')
    .then((r) => r.json())
    .then((data) => {
      playlist = data;
      order = baseOrder();
      buildTrackList();
    })
    .catch(() => {
      npTitle.textContent = '재생목록을 불러오지 못했습니다';
    });
})();
