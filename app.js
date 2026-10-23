// Ôn thi Môi giới BĐS — static quiz app
const app = document.getElementById('app');
const LETTERS = 'ABCD';
const LS_WRONG = 'bds_wrong';
const LS_SESSION = 'bds_session';
const LS_HIST = 'bds_hist';
const LS_SHUF = 'bds_shuf';

const state = {
  bank: null, mode: null, qs: [], idx: 0, origIdx: null,
  answers: {}, score: 0, done: false,
  reveal: false, timer: null, remain: 0,
  shuffleOpt: localStorage.getItem(LS_SHUF) !== '0',
};

// ---------- persistence ----------
const getWrong = () => JSON.parse(localStorage.getItem(LS_WRONG) || '{}');
const setWrong = w => localStorage.setItem(LS_WRONG, JSON.stringify(w));
const markWrong = (bankKey, qi, wrong) => {
  const w = getWrong();
  w[bankKey] = w[bankKey] || {};
  wrong ? (w[bankKey][qi] = true) : delete w[bankKey][qi];
  setWrong(w);
};

const LS_PROG = 'bds_prog';
const getProg = () => JSON.parse(localStorage.getItem(LS_PROG) || '{}');
const markProg = (bankKey, qi, right) => {
  const p = getProg();
  p[bankKey] = p[bankKey] || {};
  const e = p[bankKey][qi] = p[bankKey][qi] || [0, 0];
  e[right ? 0 : 1]++;
  try { localStorage.setItem(LS_PROG, JSON.stringify(p)); } catch {}
};
const bankProg = bankKey => {
  const es = Object.values(getProg()[bankKey] || {});
  const c = es.reduce((s, e) => s + e[0], 0), n = es.reduce((s, e) => s + e[0] + e[1], 0);
  return { seen: es.length, acc: n ? Math.round(c / n * 100) : 0 };
};
const progTag = () => {
  const e = (getProg()[state.bank] || {})[state.origIdx ? state.origIdx[state.idx] : state.idx];
  if (!e) return '';
  const color = e[1] && !e[0] ? '#f06a6a' : e[1] ? '#ffd166' : '#3dd68c';
  return ` · <span style="color:${color}">✓${e[0]} ✗${e[1]}</span>`;
};

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
  } catch { /* quota full — don't break rendering */ }
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
  ? `câu ${s.idx + 1}/${s.qs.length}`
  : `${Object.keys(s.answers || {}).length}/${s.qs.length} câu`;

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
  const w = getWrong();
  const sess = getSession();
  const hist = getHist();
  app.innerHTML = `
    ${sess && !sess.done ? `
      <div class="rev-item" style="border-color:#6ea8fe">
        ⏸ Phiên trước chưa xong: <b>${BANKS[sess.bank].name}</b> — ${sess.mode === 'mock' ? 'Thi thử' : sess.mode === 'quiz' ? 'Luyện tập' : 'Học'}
        (${sessProgress(sess)})
        <div class="mode-row" style="margin-top:8px">
          <button class="btn sm" onclick="resumeSession()">▶ Tiếp tục</button>
          <button class="btn ghost sm" onclick="clearSession();home()">Bỏ qua</button>
        </div>
      </div>` : ''}
    <p class="stats">Ôn thi sát hạch chứng chỉ hành nghề môi giới BĐS — trắc nghiệm, 120 phút/phần, đậu ≥70/100.</p>
    <div class="bank-grid">
      ${Object.keys(BANKS).map(k => {
        const n = BANKS[k].qs.length;
        const wn = Object.keys(w[k] || {}).length;
        const best = Math.max(0, ...hist.filter(h => h.bank === k).map(h => h.pct));
        const prog = bankProg(k);
        return `<div class="bank-card" onclick="pickBank('${k}')">
          <h3>${BANKS[k].name}</h3>
          <p><span class="cnt">${n}</span> câu hỏi${prog.seen ? ` · đã làm ${prog.seen} · <span class="${prog.acc >= 70 ? 'right' : 'you'}">${prog.acc}% đúng</span>` : ''}${wn ? ` · <span style="color:#f06a6a">${wn} câu sai cần ôn</span>` : ''}${best ? ` · điểm cao nhất ${best}` : ''}</p>
        </div>`;
      }).join('')}
    </div>
    ${hist.length ? `<h3 style="margin:18px 0 10px;font-size:.95rem">Lịch sử làm bài</h3>` +
      hist.slice(0, 8).map(h => `
        <div class="rev-item" style="display:flex;justify-content:space-between;align-items:center">
          <span>${h.mode === 'mock' ? '⏱' : '✏️'} ${BANKS[h.bank].name}</span>
          <span class="${h.pct >= 70 ? 'right' : 'you'}" style="font-weight:700">${h.pct}/100</span>
          <span style="color:#8b93a5;font-size:.75rem">${fmtDate(h.at)}</span>
        </div>`).join('') : ''}
    <p class="stats">💡 Mẹo: thi trên giấy, đáp án có thể xáo thứ tự — học nội dung đúng, đừng học vị trí chữ cái.</p>`;
}

// ---------- BANK MENU ----------
function pickBank(k) {
  clearInterval(state.timer);
  state.bank = k;
  const n = BANKS[k].qs.length;
  const w = getWrong()[k] || {};
  const sess = getSession();
  header(BANKS[k].name);
  app.innerHTML = `
    <h2 style="margin-bottom:6px;font-size:1.1rem">${BANKS[k].name}</h2>
    <p class="stats">${n} câu · ${Object.keys(w).length} câu từng làm sai${(() => { const p = bankProg(k); return p.seen ? ` · đã làm ${p.seen} · ${p.acc}% đúng` : ''; })()}</p>
    ${sess && sess.bank === k ? `<div class="rev-item" style="border-color:#6ea8fe;margin-bottom:12px">
      ⏸ Có phiên ${sess.mode === 'mock' ? 'thi thử' : sess.mode === 'quiz' ? 'luyện tập' : 'học'} đang dở — ${sessProgress(sess)}
      <div class="mode-row" style="margin-top:8px"><button class="btn sm" onclick="resumeSession()">▶ Tiếp tục</button></div>
    </div>` : ''}
    <div class="mode-row">
      <button class="btn" onclick="startStudy()">📖 Học (xem đáp án)</button>
      <button class="btn" onclick="quizMenu()">✏️ Luyện tập</button>
      <button class="btn" onclick="startMock()">⏱ Thi thử (50 câu / 60')</button>
      ${Object.keys(w).length ? `<button class="btn ghost" onclick="startWrong()">🔁 Ôn ${Object.keys(w).length} câu sai</button>` : ''}
    </div>
    <label class="check"><input type="checkbox" ${state.shuffleOpt ? 'checked' : ''} onchange="setShuf(this.checked)"> Xáo trộn thứ tự đáp án (khuyên dùng)</label>
    <div class="mode-row"><button class="btn ghost sm" onclick="home()">← Chọn bộ khác</button></div>`;
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
  header(`${BANKS[state.bank].name} — Học`);
  saveSession();
  app.innerHTML = `
    <div class="topbar">
      <button class="btn ghost sm" onclick="pickBank('${state.bank}')">← Menu</button>
      <span class="tag">Câu ${state.idx + 1} / ${state.qs.length}${answered ? ` · <span style="color:#3dd68c">✓ ${right}</span> · <span style="color:#f06a6a">✗ ${answered - right}</span>` : ''}</span>
    </div>
    <div class="progress"><div style="width:${(state.idx + 1) / state.qs.length * 100}%"></div></div>
    <div class="qcard">
      <div class="qnum">Câu ${state.origIdx ? state.origIdx[state.idx] + 1 : state.idx + 1}${progTag()}</div>
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
      ${rev ? `<div class="ans-reveal">${my !== undefined ? (my === q.a ? '✓ Đúng! ' : '✗ Sai. ') : ''}Đáp án: ${LETTERS[q.a]}</div>` : ''}
    </div>
    <div class="nav-row">
      <button class="btn ghost" ${state.idx === 0 ? 'disabled' : ''} onclick="nav(-1)">← Trước</button>
      <button class="btn ghost" onclick="navRnd()">🎲 Ngẫu nhiên</button>
      <button class="btn" onclick="nav(1)">Sau →</button>
    </div>`;
}
function studyAns(i) {
  if (state.answers[state.idx] !== undefined) { state.reveal = true; showStudy(); return; }
  state.answers[state.idx] = i;
  state.reveal = true;
  const oi = state.origIdx ? state.origIdx[state.idx] : state.idx;
  const right = i === state.qs[state.idx].a;
  markWrong(state.bank, oi, !right);
  markProg(state.bank, oi, right);
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
    <h2 style="font-size:1.05rem;margin-bottom:10px">Luyện tập — chọn số câu</h2>
    <div class="mode-row">
      ${[10, 25, 50].filter(x => x <= n).map(x => `<button class="btn ghost" onclick="startQuiz(${x})">${x} câu</button>`).join('')}
      <button class="btn ghost" onclick="startQuiz(${n})">Tất cả ${n} câu</button>
    </div>
    <div class="mode-row"><button class="btn ghost sm" onclick="pickBank('${state.bank}')">← Quay lại</button></div>`;
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
  header(`${BANKS[state.bank].name} — Luyện tập`);
  saveSession();
  app.innerHTML = `
    <div class="topbar">
      <button class="btn ghost sm" onclick="pickBank('${state.bank}')">← Menu</button>
      <span class="tag">${answered}/${state.qs.length} đã làm · <span style="color:#3dd68c">✓ ${state.score}</span> · <span style="color:#f06a6a">✗ ${answered - state.score}</span></span>
    </div>
    <div class="progress"><div style="width:${answered / state.qs.length * 100}%"></div></div>
    ${state.done ? quizResult() : quizQ()}
    ${!state.done && answered === state.qs.length ? `<div class="nav-row"><button class="btn" onclick="finishQuiz()">Xem kết quả →</button></div>` : ''}`;
}

function quizQ() {
  const q = state.qs[state.idx];
  const my = state.answers[state.idx];
  return `
    <div class="qcard">
      <div class="qnum">Câu ${state.idx + 1}${progTag()}</div>
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
      ${my !== undefined ? `<div class="ans-reveal">${my === q.a ? '✓ Đúng!' : '✗ Sai. '}Đáp án: ${LETTERS[q.a]}</div>` : ''}
    </div>
    <div class="nav-row">
      <button class="btn ghost" ${state.idx === 0 ? 'disabled' : ''} onclick="qnav(-1)">← Trước</button>
      <button class="btn" ${state.idx === state.qs.length - 1 ? 'disabled' : ''} onclick="qnav(1)">Sau →</button>
    </div>`;
}

function answer(i) {
  if (state.answers[state.idx] !== undefined) return;
  const q = state.qs[state.idx];
  state.answers[state.idx] = i;
  const right = i === q.a;
  if (right) state.score++;
  const oi = state.origIdx ? state.origIdx[state.idx] : state.idx;
  markWrong(state.bank, oi, !right);
  markProg(state.bank, oi, right);
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
      <p>${state.score}/${state.qs.length} câu đúng — ${pct >= 70 ? 'ĐẠT (≥70)' : 'chưa đạt (<70)'}</p>
      <div class="mode-row" style="justify-content:center">
        <button class="btn" onclick="startQuiz(${state.qs.length})">Làm lại</button>
        <button class="btn ghost" onclick="pickBank('${state.bank}')">Menu</button>
      </div>
    </div>
    ${wrongs.length ? `<h3 style="margin:20px 0 10px;font-size:.95rem">Các câu sai (${wrongs.length}):</h3>` +
      wrongs.map(([i, a]) => {
        const q = state.qs[i];
        return `<div class="rev-item"><div class="q">${esc(q.q)}</div>
          <div class="you">Bạn chọn: ${LETTERS[a]}. ${esc(q.o[a])}</div>
          <div class="right">Đúng: ${LETTERS[q.a]}. ${esc(q.o[q.a])}</div></div>`;
      }).join('') : '<p style="text-align:center">🎉 Không sai câu nào!</p>'}`;
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
  header(`${BANKS[state.bank].name} — Thi thử`);
  app.innerHTML = `
    <div class="topbar">
      <button class="btn ghost sm" onclick="confirmExit()">← Thoát</button>
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
      <div class="qnum">Câu ${state.idx + 1} / ${state.qs.length}${progTag()}</div>
      <div class="qtext">${esc(q.q)}</div>
      ${q.o.map((o, i) => `<button class="opt ${my === i ? 'correct' : ''}" onclick="mockAns(${i})"><span class="let">${LETTERS[i]}.</span> ${esc(o)}</button>`).join('')}
    </div>
    <div class="nav-row">
      <button class="btn ghost" ${state.idx === 0 ? 'disabled' : ''} onclick="mnav(-1)">← Trước</button>
      <button class="btn ghost" onclick="mnav(Math.floor(Math.random()*state.qs.length)-state.idx)">🎲</button>
      ${state.idx === state.qs.length - 1
        ? `<button class="btn" onclick="finishMock()">Nộp bài</button>`
        : `<button class="btn" onclick="mnav(1)">Sau →</button>`}
    </div>`;
}
function mockAns(i) { state.answers[state.idx] = i; saveSession(); showMock(); }
function mnav(d) { state.idx = Math.min(state.qs.length - 1, Math.max(0, state.idx + d)); saveSession(); showMock(); }
function confirmExit() { if (confirm('Thoát bài thi thử? (tiến độ đã lưu, có thể tiếp tục sau)')) pickBank(state.bank); }

function finishMock() {
  clearInterval(state.timer);
  state.score = 0;
  state.qs.forEach((q, i) => {
    const right = state.answers[i] === q.a;
    if (right) state.score++;
    if (state.answers[i] !== undefined) {
      const oi = state.origIdx ? state.origIdx[i] : i;
      markWrong(state.bank, oi, !right);
      markProg(state.bank, oi, right);
    }
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
      <p>${state.score}/${state.qs.length} đúng${unans ? ` · ${unans} câu bỏ trống` : ''} — ${pct >= 70 ? 'ĐẠT' : 'CHƯA ĐẠT'}</p>
      <div class="mode-row" style="justify-content:center">
        <button class="btn" onclick="startMock()">Thi lại</button>
        <button class="btn ghost" onclick="pickBank('${state.bank}')">Menu</button>
      </div>
    </div>
    ${wrongs.length ? `<h3 style="margin:20px 0 10px;font-size:.95rem">Các câu sai (${wrongs.length}):</h3>` +
      wrongs.map(([i, a]) => {
        const q = state.qs[i];
        return `<div class="rev-item"><div class="q">${esc(q.q)}</div>
          <div class="you">Bạn chọn: ${LETTERS[a]}. ${esc(q.o[a])}</div>
          <div class="right">Đúng: ${LETTERS[q.a]}. ${esc(q.o[q.a])}</div></div>`;
      }).join('') : ''}`;
}

// ---------- WRONG-QUESTIONS REVIEW ----------
function startWrong() {
  const w = getWrong()[state.bank] || {};
  const idx = Object.keys(w).map(Number).sort((a, b) => a - b);
  if (!idx.length) return pickBank(state.bank);
  startStudy(idx);
}

home();
