// Ôn thi Môi giới BĐS — static quiz app
const app = document.getElementById('app');
const LETTERS = 'ABCD';
const LS_WRONG = 'bds_wrong';
const LS_STATS = 'bds_stats';

const state = {
  bank: null, mode: null, qs: [], idx: 0,
  answers: {}, score: 0, done: false,
  reveal: false, timer: null, remain: 0, shuffleOpt: true,
};

const getWrong = () => JSON.parse(localStorage.getItem(LS_WRONG) || '{}');
const setWrong = w => localStorage.setItem(LS_WRONG, JSON.stringify(w));
const markWrong = (bankKey, qi, wrong) => {
  const w = getWrong();
  w[bankKey] = w[bankKey] || {};
  wrong ? (w[bankKey][qi] = true) : delete w[bankKey][qi];
  setWrong(w);
};

const shuffle = a => a.map(v => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map(x => x[1]);

function prepQuestions(qs) {
  return qs.map(q => {
    if (!state.shuffleOpt) return { ...q };
    const order = q.o.map((_, i) => i);
    const shuffled = shuffle(order);
    return { q: q.q, o: shuffled.map(i => q.o[i]), a: shuffled.indexOf(q.a) };
  });
}

function header(txt) {
  document.getElementById('hdr-info').textContent = txt;
  document.querySelector('header h1').onclick = home;
}

// ---------- HOME ----------
function home() {
  clearInterval(state.timer);
  header('');
  const w = getWrong();
  app.innerHTML = `
    <p class="stats">Ôn thi sát hạch chứng chỉ hành nghề môi giới BĐS — trắc nghiệm, 120 phút/phần, đậu ≥70/100.</p>
    <div class="bank-grid">
      ${Object.keys(BANKS).map(k => {
        const n = BANKS[k].qs.length;
        const wn = Object.keys(w[k] || {}).length;
        return `<div class="bank-card" onclick="pickBank('${k}')">
          <h3>${BANKS[k].name}</h3>
          <p><span class="cnt">${n}</span> câu hỏi${wn ? ` · <span style="color:#f06a6a">${wn} câu sai cần ôn</span>` : ''}</p>
        </div>`;
      }).join('')}
    </div>
    <p class="stats">💡 Mẹo: thi trên giấy, đáp án có thể xáo thứ tự — học nội dung đúng, đừng học vị trí chữ cái.</p>`;
}

// ---------- BANK MENU ----------
function pickBank(k) {
  state.bank = k;
  const n = BANKS[k].qs.length;
  const w = getWrong()[k] || {};
  header(BANKS[k].name);
  app.innerHTML = `
    <h2 style="margin-bottom:6px;font-size:1.1rem">${BANKS[k].name}</h2>
    <p class="stats">${n} câu · ${Object.keys(w).length} câu từng làm sai</p>
    <div class="mode-row">
      <button class="btn" onclick="startStudy()">📖 Học (xem đáp án)</button>
      <button class="btn" onclick="quizMenu()">✏️ Luyện tập</button>
      <button class="btn" onclick="startMock()">⏱ Thi thử (50 câu / 60')</button>
      ${Object.keys(w).length ? `<button class="btn ghost" onclick="startWrong()">🔁 Ôn ${Object.keys(w).length} câu sai</button>` : ''}
    </div>
    <label class="check"><input type="checkbox" id="shuf" ${state.shuffleOpt ? 'checked' : ''} onchange="state.shuffleOpt=this.checked"> Xáo trộn thứ tự đáp án (khuyên dùng)</label>
    <div class="mode-row"><button class="btn ghost sm" onclick="home()">← Chọn bộ khác</button></div>`;
}

// ---------- STUDY MODE ----------
function startStudy(idxList) {
  state.mode = 'study';
  const base = idxList || BANKS[state.bank].qs.map((_, i) => i);
  const raw = idxList ? idxList.map(i => BANKS[state.bank].qs[i]) : BANKS[state.bank].qs;
  state.qs = prepQuestions(raw);
  state.origIdx = idxList || BANKS[state.bank].qs.map((_, i) => i);
  state.idx = 0; state.reveal = false;
  showStudy();
}

function showStudy() {
  const q = state.qs[state.idx];
  header(`${BANKS[state.bank].name} — Học`);
  app.innerHTML = `
    <div class="topbar">
      <button class="btn ghost sm" onclick="pickBank('${state.bank}')">← Menu</button>
      <span class="tag">Câu ${state.idx + 1} / ${state.qs.length}</span>
    </div>
    <div class="progress"><div style="width:${(state.idx + 1) / state.qs.length * 100}%"></div></div>
    <div class="qcard">
      <div class="qnum">Câu ${state.origIdx ? state.origIdx[state.idx] + 1 : state.idx + 1}</div>
      <div class="qtext">${q.q}</div>
      ${q.o.map((o, i) => `
        <div class="opt ${state.reveal ? (i === q.a ? 'correct' : 'dim') : ''}" onclick="state.reveal=true;showStudy()">
          <span class="let">${LETTERS[i]}.</span> ${o}
        </div>`).join('')}
      ${state.reveal ? `<div class="ans-reveal">Đáp án: ${LETTERS[q.a]}</div>` : ''}
    </div>
    <div class="nav-row">
      <button class="btn ghost" ${state.idx === 0 ? 'disabled' : ''} onclick="nav(-1)">← Trước</button>
      <button class="btn ghost" onclick="navRnd()">🎲 Ngẫu nhiên</button>
      <button class="btn" onclick="nav(1)">Sau →</button>
    </div>`;
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
  app.innerHTML = `
    <div class="topbar">
      <button class="btn ghost sm" onclick="pickBank('${state.bank}')">← Menu</button>
      <span class="tag">${answered}/${state.qs.length} đã trả lời · đúng ${state.score}</span>
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
      <div class="qnum">Câu ${state.idx + 1}</div>
      <div class="qtext">${q.q}</div>
      ${q.o.map((o, i) => {
        let cls = '';
        if (my !== undefined) {
          if (i === q.a) cls = 'correct';
          else if (i === my) cls = 'wrong';
          else cls = 'dim';
        }
        return `<button class="opt ${cls}" ${my !== undefined ? 'disabled' : ''} onclick="answer(${i})"><span class="let">${LETTERS[i]}.</span> ${o}</button>`;
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
  markWrong(state.bank, state.origIdx[state.idx], !right);
  showQuiz();
}
function qnav(d) { state.idx = Math.min(state.qs.length - 1, Math.max(0, state.idx + d)); showQuiz(); }
function finishQuiz() { state.done = true; showQuiz(); }

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
        return `<div class="rev-item"><div class="q">${q.q}</div>
          <div class="you">Bạn chọn: ${LETTERS[a]}. ${q.o[a]}</div>
          <div class="right">Đúng: ${LETTERS[q.a]}. ${q.o[q.a]}</div></div>`;
      }).join('') : '<p style="text-align:center">🎉 Không sai câu nào!</p>'}`;
}

// ---------- MOCK EXAM (50 câu / 60 phút, giống format thi thật) ----------
function startMock() {
  const all = BANKS[state.bank].qs.map((_, i) => i);
  const picked = shuffle(all).slice(0, Math.min(50, all.length));
  state.mode = 'mock';
  state.qs = prepQuestions(picked.map(i => BANKS[state.bank].qs[i]));
  state.origIdx = picked;
  state.answers = {}; state.idx = 0; state.done = false; state.remain = 60 * 60;
  clearInterval(state.timer);
  state.timer = setInterval(() => {
    state.remain--;
    if (state.remain <= 0) { finishMock(); return; }
    const el = document.getElementById('timer');
    if (el) el.textContent = fmtTime(state.remain);
  }, 1000);
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
      <div class="qnum">Câu ${state.idx + 1} / ${state.qs.length}</div>
      <div class="qtext">${q.q}</div>
      ${q.o.map((o, i) => `<button class="opt ${my === i ? 'correct' : ''}" onclick="mockAns(${i})"><span class="let">${LETTERS[i]}.</span> ${o}</button>`).join('')}
    </div>
    <div class="nav-row">
      <button class="btn ghost" ${state.idx === 0 ? 'disabled' : ''} onclick="mnav(-1)">← Trước</button>
      <button class="btn ghost" onclick="mnav(Math.floor(Math.random()*state.qs.length)-state.idx)">🎲</button>
      ${state.idx === state.qs.length - 1
        ? `<button class="btn" onclick="finishMock()">Nộp bài</button>`
        : `<button class="btn" onclick="mnav(1)">Sau →</button>`}
    </div>`;
}
function mockAns(i) { state.answers[state.idx] = i; showMock(); }
function mnav(d) { state.idx = Math.min(state.qs.length - 1, Math.max(0, state.idx + d)); showMock(); }
function confirmExit() { if (confirm('Thoát bài thi thử?')) pickBank(state.bank); }

function finishMock() {
  clearInterval(state.timer);
  state.score = 0;
  state.qs.forEach((q, i) => {
    const right = state.answers[i] === q.a;
    if (right) state.score++;
    if (state.answers[i] !== undefined) markWrong(state.bank, state.origIdx[i], !right);
  });
  state.done = true; showMock();
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
        return `<div class="rev-item"><div class="q">${q.q}</div>
          <div class="you">Bạn chọn: ${LETTERS[a]}. ${q.o[a]}</div>
          <div class="right">Đúng: ${LETTERS[q.a]}. ${q.o[q.a]}</div></div>`;
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
