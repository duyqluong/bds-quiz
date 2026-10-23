// Ã”n thi MÃ´i giá»›i BÄS â€” static quiz app
const app = document.getElementById('app');
const LETTERS = 'ABCD';
const LS_PROG = 'bds_prog';
const LS_SESSION = 'bds_session';
const LS_HIST = 'bds_hist';
const LS_SHUF = 'bds_shuf';

const state = {
  bank: null, mode: null, qs: [], idx: 0, origIdx: null,
  answers: {}, score: 0, done: false,
  reveal: false, timer: null, remain: 0,
  shuffleOpt: localStorage.getItem(LS_SHUF) !== '0',
};

// ---------- persistence (single store: {bank: {qi: {c, w, f}}}) ----------
const getProg = () => JSON.parse(localStorage.getItem(LS_PROG) || '{}');
const saveProg = p => { try { localStorage.setItem(LS_PROG, JSON.stringify(p)); } catch {} };
const markResult = (bankKey, qi, right) => {
  const p = getProg();
  const b = p[bankKey] = p[bankKey] || {};
  const e = b[qi] = b[qi] || { c: 0, w: 0, f: 0 };
  right ? e.c++ : e.w++;
  e.f = right ? 0 : 1;
  saveProg(p);
};
const wrongIdx = bankKey =>
  Object.entries(getProg()[bankKey] || {}).filter(([, e]) => e.f).map(([qi]) => +qi).sort((a, b) => a - b);
const bankProg = bankKey => {
  const es = Object.values(getProg()[bankKey] || {});
  const c = es.reduce((s, e) => s + e.c, 0), n = es.reduce((s, e) => s + e.c + e.w, 0);
  return { seen: es.length, acc: n ? Math.round(c / n * 100) : 0 };
};
const progTag = () => {
  const e = (getProg()[state.bank] || {})[state.origIdx ? state.origIdx[state.idx] : state.idx];
  if (!e) return '';
  const color = e.w && !e.c ? '#c0392b' : e.w ? '#a3541d' : '#2e7d32';
  return ` Â· <span style="color:${color}">âœ“${e.c} âœ—${e.w}</span>`;
};

// one-time migration from the old separate wrong-answer store
(function migrateWrong() {
  const raw = localStorage.getItem('bds_wrong');
  if (!raw) return;
  try {
    const w = JSON.parse(raw), p = getProg();
    for (const b in w) {
      p[b] = p[b] || {};
      for (const qi in w[b]) {
        const e = p[b][qi] = p[b][qi] || { c: 0, w: 0, f: 0 };
        e.f = 1; if (!e.w) e.w = 1;
      }
    }
    saveProg(p);
  } catch {}
  localStorage.removeItem('bds_wrong');
})();

const getHist = () => JSON.parse(localStorage.getItem(LS_HIST) || '[]');
const pushHist = e => {
  const h = getHist();
  h.unshift({ ...e, at: Date.now() });
  localStorage.setItem(LS_HIST, JSON.stringify(h.slice(0, 50)));
};

function saveSession() {
  if (!state.mode || state.done) return;
  try {
    localStorage.setItem(LS_SESSION, JSON.stringify({
      bank: state.bank, mode: state.mode, qs: state.qs, origIdx: state.origIdx,
      idx: state.idx, answers: state.answers, remain: state.remain, saved: Date.now(),
    }));
  } catch { /* quota full â€” don't break rendering */ }
}
const getSession = () => {
  try {
    const s = JSON.parse(localStorage.getItem(LS_SESSION) || 'null');
    if (!s || !BANKS[s.bank] || !Array.isArray(s.qs) || !s.qs.length ||
        typeof s.idx !== 'number' || s.idx < 0 || s.idx >= s.qs.length) {
      if (s) clearSession();
      return null;
    }
    return s;
  } catch { return null; }
};
const clearSession = () => localStorage.removeItem(LS_SESSION);
const sessProgress = s => s.mode === 'study'
  ? `cÃ¢u ${s.idx + 1}/${s.qs.length}`
  : `${Object.keys(s.answers || {}).length}/${s.qs.length} cÃ¢u`;

function resumeSession() {
  const s = getSession();
  if (!s) return home();
  state.bank = s.bank; state.mode = s.mode; state.qs = s.qs;
  state.origIdx = s.origIdx || s.qs.map((_, i) => i);
  state.idx = s.idx; state.answers = s.answers || {};
  state.done = false; state.reveal = false;
  clearInterval(state.timer);
  if (s.mode === 'mock') {
    state.remain = s.remain || 3600;
    state.score = 0;
    startTimer();
    showMock();
  } else if (s.mode === 'quiz') {
    state.score = Object.entries(state.answers).filter(([i, a]) => a === state.qs[i].a).length;
    showQuiz();
  } else {
    showStudy();
  }
}

const shuffle = a => a.map(v => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map(x => x[1]);

function prepQuestions(qs) {
  return qs.map(q => {
    if (!state.shuffleOpt) return { ...q };
    const shuffled = shuffle(q.o.map((_, i) => i));
    return { q: q.q, o: shuffled.map(i => q.o[i]), a: shuffled.indexOf(q.a) };
  });
}

function header(txt) {
  document.getElementById('hdr-info').textContent = txt;
  document.querySelector('header h1').onclick = home;
}
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const fmtDate = t => new Date(t).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

// ---------- HOME ----------
function home() {
  clearInterval(state.timer);
  header('');
  const sess = getSession();
  const hist = getHist();
  app.innerHTML = `
    ${sess && !sess.done ? `
      <div class="rev-item" style="border-color:#1e5c46">
        â¸ PhiÃªn trÆ°á»›c chÆ°a xong: <b>${BANKS[sess.bank].name}</b> â€” ${sess.mode === 'mock' ? 'Thi thá»­' : sess.mode === 'quiz' ? 'Luyá»‡n táº­p' : 'Há»c'}
        (${sessProgress(sess)})
        <div class="mode-row" style="margin-top:8px">
          <button class="btn sm" onclick="resumeSession()">â–¶ Tiáº¿p tá»¥c</button>
          <button class="btn ghost sm" onclick="clearSession();home()">Bá» qua</button>
        </div>
      </div>` : ''}
    <p class="stats">Ã”n thi sÃ¡t háº¡ch chá»©ng chá»‰ hÃ nh nghá» mÃ´i giá»›i BÄS â€” tráº¯c nghiá»‡m, 120 phÃºt/pháº§n, Ä‘áº­u â‰¥70/100.</p>
    <div class="bank-grid">
      ${Object.keys(BANKS).map(k => {
        const n = BANKS[k].qs.length;
        const wn = wrongIdx(k).length;
        const best = Math.max(0, ...hist.filter(h => h.bank === k).map(h => h.pct));
        const prog = bankProg(k);
        return `<div class="bank-card" onclick="pickBank('${k}')">
          <h3>${BANKS[k].name}</h3>
          <p><span class="cnt">${n}</span> cÃ¢u há»i${prog.seen ? ` Â· Ä‘Ã£ lÃ m ${prog.seen} Â· <span class="${prog.acc >= 70 ? 'right' : 'you'}">${prog.acc}% Ä‘Ãºng</span>` : ''}${wn ? ` Â· <span style="color:#c0392b">${wn} cÃ¢u sai cáº§n Ã´n</span>` : ''}${best ? ` Â· Ä‘iá»ƒm cao nháº¥t ${best}` : ''}</p>
        </div>`;
      }).join('')}
    </div>
    ${hist.length ? `<h3 style="margin:18px 0 10px;font-size:.95rem">Lá»‹ch sá»­ lÃ m bÃ i</h3>` +
      hist.slice(0, 8).map(h => `
        <div class="rev-item" style="display:flex;justify-content:space-between;align-items:center">
          <span>${h.mode === 'mock' ? 'â±' : 'âœï¸'} ${BANKS[h.bank].name}</span>
          <span class="${h.pct >= 70 ? 'right' : 'you'}" style="font-weight:700">${h.pct}/100</span>
          <span style="color:#8b93a5;font-size:.75rem">${fmtDate(h.at)}</span>
        </div>`).join('') : ''}
    <p class="stats">ðŸ’¡ Máº¹o: thi trÃªn giáº¥y, Ä‘Ã¡p Ã¡n cÃ³ thá»ƒ xÃ¡o thá»© tá»± â€” há»c ná»™i dung Ä‘Ãºng, Ä‘á»«ng há»c vá»‹ trÃ­ chá»¯ cÃ¡i.</p>`;
}

// ---------- BANK MENU ----------
function pickBank(k) {
  clearInterval(state.timer);
  state.bank = k;
  const n = BANKS[k].qs.length;
  const wn = wrongIdx(k).length;
  const sess = getSession();
  header(BANKS[k].name);
  app.innerHTML = `
    <h2 style="margin-bottom:6px;font-size:1.1rem">${BANKS[k].name}</h2>
    <p class="stats">${n} cÃ¢u Â· ${wn} cÃ¢u tá»«ng lÃ m sai${(() => { const p = bankProg(k); return p.seen ? ` Â· Ä‘Ã£ lÃ m ${p.seen} Â· ${p.acc}% Ä‘Ãºng` : ''; })()}</p>
    ${sess && sess.bank === k ? `<div class="rev-item" style="border-color:#1e5c46;margin-bottom:12px">
      â¸ CÃ³ phiÃªn ${sess.mode === 'mock' ? 'thi thá»­' : sess.mode === 'quiz' ? 'luyá»‡n táº­p' : 'há»c'} Ä‘ang dá»Ÿ â€” ${sessProgress(sess)}
      <div class="mode-row" style="margin-top:8px"><button class="btn sm" onclick="resumeSession()">â–¶ Tiáº¿p tá»¥c</button></div>
    </div>` : ''}
    <div class="mode-row">
      <button class="btn" onclick="startStudy()">ðŸ“– Há»c (xem Ä‘Ã¡p Ã¡n)</button>
      <button class="btn" onclick="quizMenu()">âœï¸ Luyá»‡n táº­p</button>
      <button class="btn" onclick="startMock()">â± Thi thá»­ (50 cÃ¢u / 60')</button>
      ${wn ? `<button class="btn ghost" onclick="startWrong()">ðŸ” Ã”n ${wn} cÃ¢u sai</button>` : ''}
    </div>
    <label class="check"><input type="checkbox" ${state.shuffleOpt ? 'checked' : ''} onchange="setShuf(this.checked)"> XÃ¡o trá»™n thá»© tá»± Ä‘Ã¡p Ã¡n (khuyÃªn dÃ¹ng)</label>
    <div class="mode-row"><button class="btn ghost sm" onclick="home()">â† Chá»n bá»™ khÃ¡c</button></div>`;
}
function setShuf(v) { state.shuffleOpt = v; localStorage.setItem(LS_SHUF, v ? '1' : '0'); }

// ---------- STUDY MODE ----------
function startStudy(idxList) {
  clearSession();
  state.mode = 'study';
  const raw = idxList ? idxList.map(i => BANKS[state.bank].qs[i]) : BANKS[state.bank].qs;
  state.qs = prepQuestions(raw);
  state.origIdx = idxList || BANKS[state.bank].qs.map((_, i) => i);
  state.idx = 0; state.reveal = false; state.answers = {};
  showStudy();
}

function showStudy() {
  const q = state.qs[state.idx];
  const my = state.answers[state.idx];
  const rev = state.reveal || my !== undefined;
  const answered = Object.keys(state.answers).length;
  const right = Object.entries(state.answers).filter(([i, a]) => a === state.qs[i].a).length;
  header(`${BANKS[state.bank].name} â€” Há»c`);
  saveSession();
  app.innerHTML = `
    <div class="topbar">
      <button class="btn ghost sm" onclick="pickBank('${state.bank}')">â† Menu</button>
      <span class="tag">CÃ¢u ${state.idx + 1} / ${state.qs.length}${answered ? ` Â· <span style="color:#2e7d32">âœ“ ${right}</span> Â· <span style="color:#c0392b">âœ— ${answered - right}</span>` : ''}</span>
    </div>
    <div class="progress"><div style="width:${(state.idx + 1) / state.qs.length * 100}%"></div></div>
    <div class="qcard">
      <div class="qnum">CÃ¢u ${state.origIdx ? state.origIdx[state.idx] + 1 : state.idx + 1}${progTag()}</div>
      <div class="qtext">${esc(q.q)}</div>
      ${q.o.map((o, i) => {
        let cls = '';
        if (rev) {
          if (i === q.a) cls = 'correct';
          else if (i === my) cls = 'wrong';
          else cls = 'dim';
        }
        return `<div class="opt ${cls}" onclick="studyAns(${i})">
          <span class="let">${LETTERS[i]}.</span> ${esc(o)}
        </div>`;
      }).join('')}
      ${rev ? `<div class="ans-reveal">${my !== undefined ? (my === q.a ? 'âœ“ ÄÃºng! ' : 'âœ— Sai. ') : ''}ÄÃ¡p Ã¡n: ${LETTERS[q.a]}</div>` : ''}
    </div>
    <div class="nav-row">
      <button class="btn ghost" ${state.idx === 0 ? 'disabled' : ''} onclick="nav(-1)">â† TrÆ°á»›c</button>
      <button class="btn ghost" onclick="navRnd()">ðŸŽ² Ngáº«u nhiÃªn</button>
      <button class="btn" onclick="nav(1)">Sau â†’</button>
    </div>`;
}
function studyAns(i) {
  if (state.answers[state.idx] !== undefined) { state.reveal = true; showStudy(); return; }
  state.answers[state.idx] = i;
  state.reveal = true;
  const oi = state.origIdx ? state.origIdx[state.idx] : state.idx;
  markResult(state.bank, oi, i === state.qs[state.idx].a);
  showStudy();
}
function nav(d) {
  state.idx = (state.idx + d + state.qs.length) % state.qs.length;
  state.reveal = false; showStudy();
}
function navRnd() {
  state.idx = Math.floor(Math.random() * state.qs.length);
  state.reveal = false; showStudy();
}

// ---------- QUIZ MODE ----------
function quizMenu() {
  const n = BANKS[state.bank].qs.length;
  app.innerHTML = `
    <h2 style="font-size:1.05rem;margin-bottom:10px">Luyá»‡n táº­p â€” chá»n sá»‘ cÃ¢u</h2>
    <div class="mode-row">
      ${[10, 25, 50].filter(x => x <= n).map(x => `<button class="btn ghost" onclick="startQuiz(${x})">${x} cÃ¢u</button>`).join('')}
      <button class="btn ghost" onclick="startQuiz(${n})">Táº¥t cáº£ ${n} cÃ¢u</button>
    </div>
    <div class="mode-row"><button class="btn ghost sm" onclick="pickBank('${state.bank}')">â† Quay láº¡i</button></div>`;
}

function startQuiz(n) {
  clearSession();
  const all = BANKS[state.bank].qs.map((_, i) => i);
  const picked = n >= all.length ? all : shuffle(all).slice(0, n);
  state.mode = 'quiz';
  state.qs = prepQuestions(picked.map(i => BANKS[state.bank].qs[i]));
  state.origIdx = picked;
  state.answers = {}; state.score = 0; state.done = false; state.idx = 0;
  showQuiz();
}

function showQuiz() {
  const answered = Object.keys(state.answers).length;
  header(`${BANKS[state.bank].name} â€” Luyá»‡n táº­p`);
  saveSession();
  app.innerHTML = `
    <div class="topbar">
      <button class="btn ghost sm" onclick="pickBank('${state.bank}')">â† Menu</button>
      <span class="tag">${answered}/${state.qs.length} Ä‘Ã£ lÃ m Â· <span style="color:#2e7d32">âœ“ ${state.score}</span> Â· <span style="color:#c0392b">âœ— ${answered - state.score}</span></span>
    </div>
    <div class="progress"><div style="width:${answered / state.qs.length * 100}%"></div></div>
    ${state.done ? quizResult() : quizQ()}
    ${!state.done && answered === state.qs.length ? `<div class="nav-row"><button class="btn" onclick="finishQuiz()">Xem káº¿t quáº£ â†’</button></div>` : ''}`;
}

function quizQ() {
  const q = state.qs[state.idx];
  const my = state.answers[state.idx];
  return `
    <div class="qcard">
      <div class="qnum">CÃ¢u ${state.idx + 1}${progTag()}</div>
      <div class="qtext">${esc(q.q)}</div>
      ${q.o.map((o, i) => {
        let cls = '';
        if (my !== undefined) {
          if (i === q.a) cls = 'correct';
          else if (i === my) cls = 'wrong';
          else cls = 'dim';
        }
        return `<button class="opt ${cls}" ${my !== undefined ? 'disabled' : ''} onclick="answer(${i})"><span class="let">${LETTERS[i]}.</span> ${esc(o)}</button>`;
      }).join('')}
      ${my !== undefined ? `<div class="ans-reveal">${my === q.a ? 'âœ“ ÄÃºng!' : 'âœ— Sai. '}ÄÃ¡p Ã¡n: ${LETTERS[q.a]}</div>` : ''}
    </div>
    <div class="nav-row">
      <button class="btn ghost" ${state.idx === 0 ? 'disabled' : ''} onclick="qnav(-1)">â† TrÆ°á»›c</button>
      <button class="btn" ${state.idx === state.qs.length - 1 ? 'disabled' : ''} onclick="qnav(1)">Sau â†’</button>
    </div>`;
}

function answer(i) {
  if (state.answers[state.idx] !== undefined) return;
  const q = state.qs[state.idx];
  state.answers[state.idx] = i;
  const right = i === q.a;
  if (right) state.score++;
  const oi = state.origIdx ? state.origIdx[state.idx] : state.idx;
  markResult(state.bank, oi, right);
  showQuiz();
}
function qnav(d) { state.idx = Math.min(state.qs.length - 1, Math.max(0, state.idx + d)); showQuiz(); }
function finishQuiz() {
  state.done = true;
  clearSession();
  pushHist({ bank: state.bank, mode: 'quiz', score: state.score, total: state.qs.length, pct: Math.round(state.score / state.qs.length * 100) });
  showQuiz();
}

function quizResult() {
  const pct = Math.round(state.score / state.qs.length * 100);
  const wrongs = Object.entries(state.answers).filter(([i, a]) => a !== state.qs[i].a);
  return `
    <div class="result">
      <div class="score ${pct >= 70 ? 'pass' : 'fail'}">${pct}/100</div>
      <p>${state.score}/${state.qs.length} cÃ¢u Ä‘Ãºng â€” ${pct >= 70 ? 'Äáº T (â‰¥70)' : 'chÆ°a Ä‘áº¡t (<70)'}</p>
      <div class="mode-row" style="justify-content:center">
        <button class="btn" onclick="startQuiz(${state.qs.length})">LÃ m láº¡i</button>
        <button class="btn ghost" onclick="pickBank('${state.bank}')">Menu</button>
      </div>
    </div>
    ${wrongs.length ? `<h3 style="margin:20px 0 10px;font-size:.95rem">CÃ¡c cÃ¢u sai (${wrongs.length}):</h3>` +
      wrongs.map(([i, a]) => {
        const q = state.qs[i];
        return `<div class="rev-item"><div class="q">${esc(q.q)}</div>
          <div class="you">Báº¡n chá»n: ${LETTERS[a]}. ${esc(q.o[a])}</div>
          <div class="right">ÄÃºng: ${LETTERS[q.a]}. ${esc(q.o[q.a])}</div></div>`;
      }).join('') : '<p style="text-align:center">ðŸŽ‰ KhÃ´ng sai cÃ¢u nÃ o!</p>'}`;
}

// ---------- MOCK EXAM ----------
function startTimer() {
  clearInterval(state.timer);
  state.timer = setInterval(() => {
    state.remain--;
    if (state.remain <= 0) { finishMock(); return; }
    const el = document.getElementById('timer');
    if (el) el.textContent = fmtTime(state.remain);
    if (state.remain % 10 === 0) saveSession();
  }, 1000);
}

function startMock() {
  clearSession();
  const all = BANKS[state.bank].qs.map((_, i) => i);
  const picked = shuffle(all).slice(0, Math.min(50, all.length));
  state.mode = 'mock';
  state.qs = prepQuestions(picked.map(i => BANKS[state.bank].qs[i]));
  state.origIdx = picked;
  state.answers = {}; state.idx = 0; state.done = false; state.remain = 60 * 60;
  startTimer();
  showMock();
}

const fmtTime = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

function showMock() {
  const answered = Object.keys(state.answers).length;
  header(`${BANKS[state.bank].name} â€” Thi thá»­`);
  app.innerHTML = `
    <div class="topbar">
      <button class="btn ghost sm" onclick="confirmExit()">â† ThoÃ¡t</button>
      <span class="timer" id="timer">${fmtTime(state.remain)}</span>
      <span class="tag">${answered}/${state.qs.length}</span>
    </div>
    <div class="progress"><div style="width:${answered / state.qs.length * 100}%"></div></div>
    ${state.done ? mockResult() : mockQ()}`;
}

function mockQ() {
  const q = state.qs[state.idx];
  const my = state.answers[state.idx];
  return `
    <div class="qcard">
      <div class="qnum">CÃ¢u ${state.idx + 1} / ${state.qs.length}${progTag()}</div>
      <div class="qtext">${esc(q.q)}</div>
      ${q.o.map((o, i) => `<button class="opt ${my === i ? 'correct' : ''}" onclick="mockAns(${i})"><span class="let">${LETTERS[i]}.</span> ${esc(o)}</button>`).join('')}
    </div>
    <div class="nav-row">
      <button class="btn ghost" ${state.idx === 0 ? 'disabled' : ''} onclick="mnav(-1)">â† TrÆ°á»›c</button>
      <button class="btn ghost" onclick="mnav(Math.floor(Math.random()*state.qs.length)-state.idx)">ðŸŽ²</button>
      ${state.idx === state.qs.length - 1
        ? `<button class="btn" onclick="finishMock()">Ná»™p bÃ i</button>`
        : `<button class="btn" onclick="mnav(1)">Sau â†’</button>`}
    </div>`;
}
function mockAns(i) { state.answers[state.idx] = i; saveSession(); showMock(); }
function mnav(d) { state.idx = Math.min(state.qs.length - 1, Math.max(0, state.idx + d)); saveSession(); showMock(); }
function confirmExit() { if (confirm('ThoÃ¡t bÃ i thi thá»­? (tiáº¿n Ä‘á»™ Ä‘Ã£ lÆ°u, cÃ³ thá»ƒ tiáº¿p tá»¥c sau)')) pickBank(state.bank); }

function finishMock() {
  clearInterval(state.timer);
  state.score = 0;
  state.qs.forEach((q, i) => {
    const right = state.answers[i] === q.a;
    if (right) state.score++;
    if (state.answers[i] !== undefined) markResult(state.bank, state.origIdx ? state.origIdx[i] : i, right);
  });
  state.done = true;
  clearSession();
  pushHist({ bank: state.bank, mode: 'mock', score: state.score, total: state.qs.length, pct: Math.round(state.score / state.qs.length * 100) });
  showMock();
}

function mockResult() {
  const pct = Math.round(state.score / state.qs.length * 100);
  const wrongs = Object.entries(state.answers).filter(([i, a]) => a !== state.qs[i].a);
  const unans = state.qs.length - Object.keys(state.answers).length;
  return `
    <div class="result">
      <div class="score ${pct >= 70 ? 'pass' : 'fail'}">${pct}/100</div>
      <p>${state.score}/${state.qs.length} Ä‘Ãºng${unans ? ` Â· ${unans} cÃ¢u bá» trá»‘ng` : ''} â€” ${pct >= 70 ? 'Äáº T' : 'CHÆ¯A Äáº T'}</p>
      <div class="mode-row" style="justify-content:center">
        <button class="btn" onclick="startMock()">Thi láº¡i</button>
        <button class="btn ghost" onclick="pickBank('${state.bank}')">Menu</button>
      </div>
    </div>
    ${wrongs.length ? `<h3 style="margin:20px 0 10px;font-size:.95rem">CÃ¡c cÃ¢u sai (${wrongs.length}):</h3>` +
      wrongs.map(([i, a]) => {
        const q = state.qs[i];
        return `<div class="rev-item"><div class="q">${esc(q.q)}</div>
          <div class="you">Báº¡n chá»n: ${LETTERS[a]}. ${esc(q.o[a])}</div>
          <div class="right">ÄÃºng: ${LETTERS[q.a]}. ${esc(q.o[q.a])}</div></div>`;
      }).join('') : ''}`;
}

// ---------- WRONG-QUESTIONS REVIEW ----------
function startWrong() {
  const idx = wrongIdx(state.bank);
  if (!idx.length) return pickBank(state.bank);
  startStudy(idx);
}

home();
