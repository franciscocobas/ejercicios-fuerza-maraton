// ══════════════════════════════════════════════
// CONFIGURATION
// ══════════════════════════════════════════════
const EX = [
  { name: 'Sentadilla',                icon: '🏋️', tgt: 15, unit: 'repeticiones',    timer: false },
  { name: 'Estocada inversa',          icon: '🦵', tgt: 10, unit: 'reps por pierna', timer: false },
  { name: 'Puente de glúteos',         icon: '💪', tgt: 20, unit: 'repeticiones',    timer: false },
  { name: 'Plancha',                   icon: '⏱️', tgt: 30, unit: 'segundos',        timer: true  },
  { name: 'Elevación de pantorrillas', icon: '👟', tgt: 20, unit: 'repeticiones',    timer: false },
];

const ROUNDS     = 3;
const REST_SET   = 60;   // seconds between exercises (within a round)
const REST_EX    = 90;   // seconds between rounds
const CIRC       = 2 * Math.PI * 44; // SVG circle circumference ≈ 276.46
const STORE_KEY  = 'runner-strength-v1';

// ══════════════════════════════════════════════
// STATE
// ══════════════════════════════════════════════
let st = {};

function resetState() {
  st = {
    roundIdx:   0,    // current round (0-based)
    exIdx:      0,    // current exercise within round (0-based)
    totalDone:  0,    // total exercises completed across all rounds
    start:      null,
    restIv:     null,
    restLeft:   0,
    restTotal:  0,
    restType:   '',
    afterRest:  null,
    plankIv:    null,
    plankLeft:  0,
    plankOn:    false,
  };
}

// ══════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════
const $    = id => document.getElementById(id);
const ex   = ()  => EX[st.exIdx];

function pct() {
  return Math.round(st.totalDone / (EX.length * ROUNDS) * 100);
}

function fmtSecs(s) {
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

function localDateStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ══════════════════════════════════════════════
// AUDIO (Web Audio API — no external files)
// ══════════════════════════════════════════════
let aCtx = null;

function getACtx() {
  if (!aCtx) aCtx = new (window.AudioContext || window.webkitAudioContext)();
  return aCtx;
}

function beep(freq, dur, vol = 0.3, type = 'sine', delay = 0) {
  try {
    const c = getACtx();
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.connect(g);
    g.connect(c.destination);
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.start(t);
    o.stop(t + dur + 0.05);
  } catch (e) { /* audio not available */ }
}

// Two-tone ascending beep: exercise completed
function sndSet() {
  beep(600, 0.07, 0.3);
  beep(880, 0.15, 0.3, 'sine', 0.1);
}

// Three-beep fanfare: rest timer ended
function sndRest() {
  beep(440, 0.07, 0.3);
  beep(440, 0.07, 0.3, 'sine', 0.13);
  beep(660, 0.22, 0.38, 'sine', 0.26);
}

// Alert triple-beep: plank done
function sndPlank() {
  beep(880, 0.1, 0.35);
  beep(880, 0.1, 0.35, 'sine', 0.18);
  beep(1100, 0.3, 0.4, 'sine', 0.36);
}

// Ascending arpeggio: workout complete
function sndDone() {
  [0, 0.12, 0.24, 0.38, 0.54].forEach((d, i) => beep(440 + i * 110, 0.2, 0.28, 'sine', d));
}

// ══════════════════════════════════════════════
// STORAGE
// ══════════════════════════════════════════════
function loadHistory() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; }
  catch { return []; }
}

function saveRun(secs) {
  const hist = loadHistory();
  const now  = new Date();
  hist.unshift({ date: localDateStr(now), ts: now.toISOString(), secs });
  localStorage.setItem(STORE_KEY, JSON.stringify(hist.slice(0, 10)));
}

function calcStreak(hist) {
  if (!hist.length) return 0;
  const dates = [...new Set(hist.map(h => h.date))].sort().reverse();
  const today = localDateStr();
  const yest  = localDateStr(new Date(Date.now() - 86400000));
  // Streak only alive if trained today or yesterday (haven't broken it yet today)
  if (dates[0] !== today && dates[0] !== yest) return 0;
  let n = 1;
  for (let i = 1; i < dates.length; i++) {
    // Use noon to avoid DST edge cases
    const a = new Date(dates[i - 1] + 'T12:00:00');
    const b = new Date(dates[i] + 'T12:00:00');
    if (Math.round((a - b) / 86400000) === 1) n++;
    else break;
  }
  return n;
}

// ══════════════════════════════════════════════
// SCREEN MANAGEMENT
// ══════════════════════════════════════════════
function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $(id).classList.add('active');
}

function setProgUI(txtId, pctId, barId, txt, p) {
  $(txtId).textContent = txt;
  $(pctId).textContent = p + '%';
  $(barId).style.width = p + '%';
}

// ══════════════════════════════════════════════
// HOME SCREEN
// ══════════════════════════════════════════════
function renderHome() {
  const hist   = loadHistory();
  const streak = calcStreak(hist);

  $('streak-num').textContent  = streak;
  $('streak-icon').textContent = streak >= 5 ? '🔥' : streak >= 2 ? '✨' : '⚡';
  $('streak-lbl').textContent  = streak === 1 ? 'día de racha' : 'días de racha';

  const listEl = $('hist-list');

  if (!hist.length) {
    listEl.innerHTML = '<div class="hist-empty">Aún no hay rutinas guardadas</div>';
    return;
  }

  listEl.innerHTML = hist.map(r => {
    const d       = new Date(r.ts);
    const dateStr = new Date(r.date + 'T12:00:00').toLocaleDateString('es', {
      weekday: 'short', day: 'numeric', month: 'short',
    });
    const timeStr = d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
    return `
      <div class="hist-item">
        <div>
          <div class="hist-date">${dateStr}</div>
          <div class="hist-time">${timeStr}</div>
        </div>
        <div class="hist-dur">${fmtSecs(r.secs)}</div>
      </div>`;
  }).join('');
}

function goHome() {
  clearTimers();
  renderHome();
  show('s-home');
}

// ══════════════════════════════════════════════
// WORKOUT SCREEN
// ══════════════════════════════════════════════
function startWorkout() {
  resetState();
  st.start = Date.now();
  requestWakeLock();
  renderWorkout();
  show('s-workout');
}

function renderWorkout() {
  const e   = ex();
  const p   = pct();
  const txt = `Ronda ${st.roundIdx + 1} de ${ROUNDS} · Ejercicio ${st.exIdx + 1} de ${EX.length}`;

  setProgUI('w-prog-txt', 'w-prog-pct', 'w-prog-bar', txt, p);

  $('ex-icon').textContent    = e.icon;
  $('ex-name').textContent    = e.name;
  $('ex-target').textContent  = `${e.tgt} ${e.unit}`;
  $('ex-set-lbl').textContent = `Ronda ${st.roundIdx + 1} de ${ROUNDS}`;

  // Round progress bars
  for (let i = 0; i < ROUNDS; i++) {
    const bar = $(`bar-${i}`);
    bar.className = 'set-bar';
    if (i < st.roundIdx)        bar.classList.add('done');
    else if (i === st.roundIdx) bar.classList.add('current');
  }

  // Buttons & plank timer visibility
  const btnDone  = $('btn-done');
  const btnPlank = $('btn-plank');
  const plankW   = $('plank-wrap');

  if (e.timer) {
    btnDone.style.display  = 'none';
    if (st.plankOn) {
      btnPlank.style.display = 'none';
      plankW.classList.add('on');
      updatePlankRing();
    } else {
      btnPlank.style.display = 'block';
      plankW.classList.remove('on');
    }
  } else {
    btnDone.style.display  = 'block';
    btnPlank.style.display = 'none';
    plankW.classList.remove('on');
  }

  // Trigger card animation on exercise change
  const inner = $('ex-card-inner');
  inner.style.animation = 'none';
  void inner.offsetWidth; // force reflow
  inner.style.animation = '';
}

function completeSet(silent = false) {
  if (!silent) sndSet();
  vibrate([40]);

  st.totalDone++;

  const isLastEx    = st.exIdx === EX.length - 1;
  const isLastRound = st.roundIdx === ROUNDS - 1;

  if (isLastEx && isLastRound) {
    finishWorkout();
    return;
  }

  if (isLastEx) {
    // End of round — rest before next round
    startRest(REST_EX, 'round', `Ronda ${st.roundIdx + 2} de ${ROUNDS}`, () => {
      st.roundIdx++;
      st.exIdx   = 0;
      st.plankOn = false;
      renderWorkout();
      show('s-workout');
    });
  } else {
    // Rest before next exercise in same round
    const nextEx = EX[st.exIdx + 1];
    startRest(REST_SET, 'set', `${nextEx.icon} ${nextEx.name}`, () => {
      st.exIdx++;
      st.plankOn = false;
      renderWorkout();
      show('s-workout');
    });
  }
}

// ══════════════════════════════════════════════
// PLANK TIMER
// ══════════════════════════════════════════════
function startPlank() {
  st.plankOn   = true;
  st.plankLeft = ex().tgt; // 30 seconds
  renderWorkout();

  st.plankIv = setInterval(() => {
    st.plankLeft--;
    updatePlankRing();

    if (st.plankLeft <= 0) {
      clearInterval(st.plankIv);
      st.plankIv = null;
      st.plankOn = false;
      sndPlank();
      vibrate([80, 60, 80]);
      completeSet(true); // silent: don't double-play
    }
  }, 1000);
}

function updatePlankRing() {
  $('plank-secs').textContent = st.plankLeft;
  const offset = CIRC * (1 - st.plankLeft / ex().tgt);
  $('plank-ring').style.strokeDashoffset = offset;
}

// ══════════════════════════════════════════════
// REST SCREEN
// ══════════════════════════════════════════════
function startRest(total, type, nextLabel, cb) {
  st.restLeft  = total;
  st.restTotal = total;
  st.restType  = type;
  st.afterRest = cb;

  const p   = pct();
  const txt = `Ronda ${st.roundIdx + 1} de ${ROUNDS} · Ejercicio ${st.exIdx + 1} de ${EX.length}`;
  setProgUI('r-prog-txt', 'r-prog-pct', 'r-prog-bar', txt, p);

  $('rest-title').textContent = type === 'round'
    ? 'Descansando entre rondas'
    : 'Descansando entre ejercicios';
  $('rest-next').textContent = nextLabel;

  // Reset ring immediately (no transition for the initial reset)
  $('rest-ring').style.transition = 'none';
  $('rest-ring').style.strokeDashoffset = '0';
  void $('rest-ring').offsetWidth;
  $('rest-ring').style.transition = 'stroke-dashoffset 0.95s linear';

  $('rest-secs').textContent = st.restLeft;
  show('s-rest');

  st.restIv = setInterval(() => {
    st.restLeft--;
    $('rest-secs').textContent = st.restLeft;
    const offset = CIRC * (1 - st.restLeft / st.restTotal);
    $('rest-ring').style.strokeDashoffset = offset;

    if (st.restLeft <= 0) {
      clearInterval(st.restIv);
      st.restIv = null;
      sndRest();
      vibrate([60, 40, 60]);
      st.afterRest && st.afterRest();
    }
  }, 1000);
}

function skipRest() {
  clearInterval(st.restIv);
  st.restIv = null;
  st.afterRest && st.afterRest();
}

// ══════════════════════════════════════════════
// FINISH
// ══════════════════════════════════════════════
function finishWorkout() {
  const secs = Math.round((Date.now() - st.start) / 1000);
  saveRun(secs);
  releaseWakeLock();
  sndDone();
  vibrate([100, 60, 100, 60, 200]);

  const streak = calcStreak(loadHistory());

  $('done-time').textContent = fmtSecs(secs);
  $('done-streak').textContent = streak > 0
    ? `🔥 Racha: ${streak} ${streak === 1 ? 'día' : 'días'} consecutivos`
    : '';

  // Show exercise summary chips
  $('done-exercises').innerHTML = EX.map(e =>
    `<div class="done-ex-chip">${e.icon} ${e.name}</div>`
  ).join('');

  show('s-done');
}

// ══════════════════════════════════════════════
// WAKE LOCK (keep screen on during workout)
// ══════════════════════════════════════════════
let wakeLock = null;

async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
    }
  } catch (e) {}
}

function releaseWakeLock() {
  try { if (wakeLock) { wakeLock.release(); wakeLock = null; } }
  catch (e) {}
}

// Re-acquire after tab becomes visible again
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible' && st.start && !wakeLock) {
    await requestWakeLock();
  }
});

// ══════════════════════════════════════════════
// HAPTIC FEEDBACK
// ══════════════════════════════════════════════
function vibrate(pattern) {
  try { navigator.vibrate && navigator.vibrate(pattern); }
  catch (e) {}
}

// ══════════════════════════════════════════════
// CLEANUP
// ══════════════════════════════════════════════
function clearTimers() {
  if (st.restIv)  { clearInterval(st.restIv);  st.restIv  = null; }
  if (st.plankIv) { clearInterval(st.plankIv); st.plankIv = null; }
  releaseWakeLock();
}

// ══════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════
resetState();
renderHome();
