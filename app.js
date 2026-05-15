// ═══════════════════════════════════════════════
//  个人仪表盘 · app.js
//  默认密码: hello
//  修改密码: 在 https://emn178.github.io/online-tools/sha256.html
//            输入新密码 → 复制哈希值 → 替换下方 PASS_HASH
// ═══════════════════════════════════════════════

const PASS_HASH = '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824';
// ^ SHA-256("hello")

// ── SHA-256 工具 ──
async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

// ── 认证 ──
const isAuthed = () => sessionStorage.getItem('auth') === '1';
const setAuth  = () => sessionStorage.setItem('auth', '1');
const clearAuth= () => { sessionStorage.removeItem('auth'); location.reload(); };

async function handleLogin(e) {
  e.preventDefault();
  const input = document.getElementById('pwd-input');
  const hash  = await sha256(input.value);

  if (hash === PASS_HASH) {
    setAuth();
    showDashboard();
  } else {
    const card = document.querySelector('.login-card');
    document.getElementById('login-error').textContent = '密码错误，请重试';
    card.classList.remove('shake');
    requestAnimationFrame(() => card.classList.add('shake'));
    input.value = '';
    input.focus();
  }
}

// ── 路由 ──
function init() {
  document.getElementById('login-form').addEventListener('submit', handleLogin);
  document.getElementById('logout-btn').addEventListener('click', clearAuth);

  if (isAuthed()) {
    showDashboard();
  } else {
    document.getElementById('login-screen').style.display = 'flex';
  }
}

async function showDashboard() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('dashboard').classList.remove('hidden');
  startClock();
  await Promise.all([loadConfig(), loadGoals(), loadTasks(), loadJournal()]);
}

// ── 时钟 & 问候 ──
function startClock() {
  const tick = () => {
    const now  = new Date();
    const days = ['周日','周一','周二','周三','周四','周五','周六'];
    const hh   = String(now.getHours()).padStart(2,'0');
    const mm   = String(now.getMinutes()).padStart(2,'0');
    document.getElementById('datetime-display').textContent =
      `${now.getFullYear()}年${now.getMonth()+1}月${now.getDate()}日 ${days[now.getDay()]}  ${hh}:${mm}`;

    const h = now.getHours();
    document.getElementById('greeting-text').textContent =
      h < 6 ? '夜深了，' : h < 11 ? '早上好，' : h < 13 ? '中午好，' : h < 18 ? '下午好，' : '晚上好，';
  };
  tick();
  setInterval(tick, 30_000);
}

// ── config.json ──
async function loadConfig() {
  try {
    const cfg = await fetchJSON('data/config.json');
    document.title = `${cfg.name} 的空间`;
    setText('header-name',   cfg.name);
    setText('profile-name',  cfg.name);
    setText('profile-title', cfg.title);
    setText('profile-bio',   cfg.bio);

    if (cfg.avatar) {
      document.getElementById('profile-avatar').innerHTML =
        `<img src="${cfg.avatar}" alt="头像">`;
    }
    if (cfg.calendar_embed_url) {
      document.getElementById('calendar-area').innerHTML =
        `<iframe id="calendar-frame" src="${cfg.calendar_embed_url}" frameborder="0"></iframe>`;
    }
  } catch(err) { console.warn('config.json', err); }
}

// ── goals.json ──
async function loadGoals() {
  try {
    const data = await fetchJSON('data/goals.json');
    document.getElementById('focus-text').textContent = data.focus || '暂无专注事项';
    document.getElementById('goals-list').innerHTML = data.goals.map(g => `
      <div class="goal-item">
        <div class="goal-top">
          <span class="goal-name">${g.title}</span>
          <div class="goal-meta">
            <span class="goal-tag">${g.category}</span>
            <span class="goal-pct">${g.progress}%</span>
          </div>
        </div>
        <div class="goal-bar">
          <div class="goal-bar-fill" style="width:0%" data-pct="${g.progress}"></div>
        </div>
      </div>
    `).join('');

    // 进度条动画（延迟触发，让 CSS transition 生效）
    requestAnimationFrame(() => requestAnimationFrame(() => {
      document.querySelectorAll('.goal-bar-fill').forEach(el => {
        el.style.width = el.dataset.pct + '%';
      });
    }));
  } catch(err) { console.warn('goals.json', err); }
}

// ── tasks.json ──
async function loadTasks() {
  try {
    const data   = await fetchJSON('data/tasks.json');
    const saved  = JSON.parse(localStorage.getItem('tasks_done') || '{}');
    const today  = todayStr();
    const tasks  = data.tasks
      .filter(t => !t.date || t.date === today || t.pinned)
      .map(t => ({ ...t, done: saved[t.id] ?? t.done }));
    renderTasks(tasks);
  } catch(err) { console.warn('tasks.json', err); }
}

function renderTasks(tasks) {
  const done  = tasks.filter(t => t.done).length;
  document.getElementById('task-count').textContent = `${done} / ${tasks.length}`;
  document.getElementById('tasks-list').innerHTML = tasks.map(t => `
    <div class="task-item ${t.done ? 'done' : ''}" onclick="toggleTask(${t.id})">
      <div class="task-check"></div>
      <span class="task-text">${t.text}</span>
    </div>
  `).join('');
}

function toggleTask(id) {
  const saved = JSON.parse(localStorage.getItem('tasks_done') || '{}');
  saved[id]   = !saved[id];
  localStorage.setItem('tasks_done', JSON.stringify(saved));
  loadTasks();
}

// ── journal.json ──
async function loadJournal() {
  try {
    const data = await fetchJSON('data/journal.json');
    const list = [...data.entries]
      .sort((a,b) => new Date(b.date) - new Date(a.date))
      .slice(0, 6);

    document.getElementById('journal-grid').innerHTML = list.map(e => `
      <div class="journal-entry">
        <div class="j-date">${fmtDate(e.date)}</div>
        <div class="j-title">${e.title}</div>
        <div class="j-content">${e.content}</div>
      </div>
    `).join('');
  } catch(err) { console.warn('journal.json', err); }
}

// ── 工具函数 ──
async function fetchJSON(url) {
  const r = await fetch(url + '?t=' + Date.now());
  if (!r.ok) throw new Error(r.status);
  return r.json();
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val || '';
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function fmtDate(str) {
  return new Date(str).toLocaleDateString('zh-CN', { year:'numeric', month:'long', day:'numeric' });
}

// ── 启动 ──
init();
