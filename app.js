// ============ 配置 ============
const STORAGE_KEY = 'work-records';

// ============ DOM 元素 ============
const currentDate = document.getElementById('current-date');
const currentTime = document.getElementById('current-time');
const statusLabel = document.getElementById('status-label');
const statusTime = document.getElementById('status-time');
const btnClockin = document.getElementById('btn-clockin');
const btnClockout = document.getElementById('btn-clockout');
const clockinTime = document.getElementById('clockin-time');
const clockoutTime = document.getElementById('clockout-time');
const durationValue = document.getElementById('duration-value');
const statToday = document.getElementById('stat-today');
const statWeek = document.getElementById('stat-week');
const statMonth = document.getElementById('stat-month');
const historyList = document.getElementById('history-list');
const tabs = document.querySelectorAll('.tab');
const pages = document.querySelectorAll('.page');

// ============ 状态 ============
let records = loadRecords();
let todayRecord = getTodayRecord();
let timerInterval = null;

// ============ 初始化 ============
function init() {
  updateDateTime();
  setInterval(updateDateTime, 1000);
  updateUI();
  setupEventListeners();
}

function setupEventListeners() {
  btnClockin.addEventListener('click', handleClockIn);
  btnClockout.addEventListener('click', handleClockOut);

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const page = tab.dataset.page;
      tabs.forEach(t => t.classList.remove('active'));
      pages.forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`page-${page}`).classList.add('active');
      if (page === 'stats') updateStats();
    });
  });
}

// ============ 时间显示 ============
function updateDateTime() {
  const now = new Date();
  const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  currentDate.textContent = `${now.getFullYear()}年${now.getMonth()+1}月${now.getDate()}日 ${weekDays[now.getDay()]}`;
  currentTime.textContent = formatTime(now);
}

function formatTime(date) {
  return `${padZero(date.getHours())}:${padZero(date.getMinutes())}:${padZero(date.getSeconds())}`;
}

function padZero(num) {
  return num.toString().padStart(2, '0');
}

// ============ 数据操作 ============
function loadRecords() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveRecords() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function getTodayRecord() {
  const today = getDateStr(new Date());
  return records.find(r => r.date === today);
}

function getDateStr(date) {
  return `${date.getFullYear()}-${padZero(date.getMonth()+1)}-${padZero(date.getDate())}`;
}

function ensureTodayRecord() {
  let record = getTodayRecord();
  if (!record) {
    record = {
      date: getDateStr(new Date()),
      clockIn: null,
      clockOuts: [],
      duration: 0
    };
    records.push(record);
  }
  // 兼容旧数据格式
  if (record.clockOut && !record.clockOuts) {
    record.clockOuts = [record.clockOut];
    delete record.clockOut;
  }
  if (!record.clockOuts) record.clockOuts = [];
  return record;
}

function getLatestClockOut() {
  if (!todayRecord || !todayRecord.clockOuts || todayRecord.clockOuts.length === 0) return null;
  return todayRecord.clockOuts[todayRecord.clockOuts.length - 1];
}

// ============ 打卡操作 ============
function handleClockIn() {
  const now = new Date();
  const timeStr = formatTime(now);

  todayRecord = ensureTodayRecord();

  // 如果已经有上班记录，提示
  if (todayRecord.clockIn) {
    statusTime.textContent = `今日已上班: ${todayRecord.clockIn}`;
    return;
  }

  todayRecord.clockIn = timeStr;
  saveRecords();
  updateUI();
  startTimer();
}

function handleClockOut() {
  const now = new Date();
  const timeStr = formatTime(now);

  todayRecord = ensureTodayRecord();

  if (!todayRecord.clockIn) {
    statusTime.textContent = '请先上班打卡';
    return;
  }

  // 记录多次下班打卡
  todayRecord.clockOuts.push(timeStr);

  // 工时 = 最晚下班时间 - 上班时间
  const latestOut = getLatestClockOut();
  todayRecord.duration = calcDuration(todayRecord.clockIn, latestOut);

  saveRecords();
  updateUI();
}

function calcDuration(start, end) {
  const [sh, sm, ss] = start.split(':').map(Number);
  const [eh, em, es] = end.split(':').map(Number);
  return (eh * 3600 + em * 60 + es) - (sh * 3600 + sm * 60 + ss);
}

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${padZero(h)}:${padZero(m)}:${padZero(s)}`;
}

function formatDurationShort(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h${m}m`;
  return `${m}m`;
}

// ============ 计时器 ============
function startTimer() {
  if (timerInterval) clearInterval(timerInterval);
  updateDuration();
  timerInterval = setInterval(updateDuration, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function updateDuration() {
  if (!todayRecord || !todayRecord.clockIn) {
    durationValue.textContent = '00:00:00';
    return;
  }

  // 如果已下班，显示最终工时
  if (todayRecord.clockOuts && todayRecord.clockOuts.length > 0) {
    const latestOut = getLatestClockOut();
    const elapsed = calcDuration(todayRecord.clockIn, latestOut);
    durationValue.textContent = formatDuration(Math.max(0, elapsed));
    return;
  }

  // 工作中，实时更新
  const now = new Date();
  const elapsed = calcDuration(todayRecord.clockIn, formatTime(now));
  durationValue.textContent = formatDuration(Math.max(0, elapsed));
}

// ============ UI 更新 ============
function updateUI() {
  todayRecord = ensureTodayRecord();
  const hasClockIn = !!todayRecord.clockIn;
  const hasClockOut = todayRecord.clockOuts && todayRecord.clockOuts.length > 0;

  // 上班按钮状态
  if (hasClockIn) {
    btnClockin.disabled = true;
    btnClockin.classList.add('done');
    clockinTime.textContent = todayRecord.clockIn;
  } else {
    btnClockin.disabled = false;
    btnClockin.classList.remove('done');
    clockinTime.textContent = '';
  }

  // 下班按钮状态
  if (hasClockIn && !hasClockOut) {
    btnClockout.disabled = false;
    btnClockout.classList.remove('done');
    clockoutTime.textContent = '';
    startTimer();
  } else if (hasClockIn && hasClockOut) {
    btnClockout.disabled = false;
    btnClockout.classList.remove('done');
    clockoutTime.textContent = `最近: ${getLatestClockOut()}`;
    stopTimer();
    updateDuration();
  } else {
    btnClockout.disabled = true;
    btnClockout.classList.remove('done');
    clockoutTime.textContent = '';
    stopTimer();
  }

  // 状态卡片
  if (!hasClockIn) {
    statusLabel.textContent = '未打卡';
    statusTime.textContent = '请先上班打卡';
  } else if (!hasClockOut) {
    statusLabel.textContent = '已上班';
    statusTime.textContent = `上班时间: ${todayRecord.clockIn}`;
  } else {
    statusLabel.textContent = '今日已完成';
    statusTime.textContent = `上班 ${todayRecord.clockIn} / 下班 ${getLatestClockOut()}`;
  }

  // 工时显示
  if (hasClockIn && hasClockOut) {
    durationValue.textContent = formatDuration(todayRecord.duration || 0);
  } else if (hasClockIn) {
    updateDuration();
  } else {
    durationValue.textContent = '00:00:00';
  }
}

function updateStats() {
  const now = new Date();
  const today = getDateStr(now);
  const weekStart = getWeekStart(now);
  const monthStart = getMonthStart(now);

  let totalToday = 0;
  let totalWeek = 0;
  let totalMonth = 0;

  records.forEach(r => {
    const d = new Date(r.date);
    if (r.date === today && r.duration) totalToday += r.duration;
    if (d >= weekStart && r.duration) totalWeek += r.duration;
    if (d >= monthStart && r.duration) totalMonth += r.duration;
  });

  statToday.textContent = formatDurationShort(totalToday);
  statWeek.textContent = formatDurationShort(totalWeek);
  statMonth.textContent = formatDurationShort(totalMonth);

  updateHistoryList();
}

function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getMonthStart(date) {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function updateHistoryList() {
  const sorted = [...records].filter(r => r.clockIn).sort((a, b) => b.date.localeCompare(a.date));

  if (sorted.length === 0) {
    historyList.innerHTML = '<div class="empty-state">暂无打卡记录</div>';
    return;
  }

  historyList.innerHTML = sorted.slice(0, 30).map(r => {
    const d = new Date(r.date);
    const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const clockOuts = r.clockOuts || (r.clockOut ? [r.clockOut] : []);
    const latestOut = clockOuts.length > 0 ? clockOuts[clockOuts.length - 1] : null;
    const outDisplay = latestOut ? `→ ${latestOut}` : '进行中';
    return `
      <div class="history-item">
        <div>
          <div class="history-date">${r.date} ${weekDays[d.getDay()]}</div>
          <div class="history-times">${r.clockIn} ${outDisplay}</div>
        </div>
        <div class="history-duration">${formatDurationShort(r.duration || 0)}</div>
      </div>
    `;
  }).join('');
}

// ============ Service Worker ============
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

// ============ 启动 ============
init();
