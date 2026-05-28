// ========================
// CLASSROOM JS — shared
// GRADE must be set before including this file
// e.g. <script>const GRADE='p5';</script>
// ========================

const GRADE_CONFIG = {
  p5: { label: 'ประถมศึกษาปีที่ 5', short: 'ป.5', icon: '🎒', color: '#ff6b6b', rooms: 7 },
  p6: { label: 'ประถมศึกษาปีที่ 6', short: 'ป.6', icon: '📝', color: '#ffd93d', rooms: 7 },
  m4: { label: 'มัธยมศึกษาปีที่ 4', short: 'ม.4', icon: '🎓', color: '#6bcb77', rooms: 5 }
};

const cfg = GRADE_CONFIG[GRADE];
let selectedRoom = 1;
let studentName = '';
let currentTab = 'tasks'; // 'tasks' | 'submitted'
let studentNo = '';
let pendingImages = {}; // taskId -> [{name, dataUrl}]

// ดึงข้อมูลจาก auth session (ถ้ามี)
function syncFromSession() {
  const s = window.__studentSession;
  if (s && s.grade === GRADE) {
    studentName  = s.name  || '';
    studentNo    = s.no    || '';
    selectedRoom = s.room  || 1;
  }
}

// ========================
// STORAGE
// ========================
function getTasks() {
  return JSON.parse(localStorage.getItem('tasks') || '[]')
    .filter(t => t.targetGrades && t.targetGrades.includes(GRADE))
    .sort((a, b) => b.postedAt - a.postedAt);
}
function displayName() {
  return studentNo ? `เลขที่ ${studentNo} ${studentName}` : studentName;
}
function getSubmissions() {
  return JSON.parse(localStorage.getItem('submissions') || '[]');
}
function saveSubmission(sub) {
  const subs = getSubmissions();
  subs.push(sub);
  localStorage.setItem('submissions', JSON.stringify(subs));
  // Sync to Firebase in background
  if (typeof fb_saveSubmission === 'function') fb_saveSubmission(sub);
}
function isSubmitted(taskId) {
  syncFromSession();
  if (!studentName && !studentNo) return false;
  // ใช้ studentNo เป็นตัวหลัก (unique ต่อห้อง) ป้องกันชื่อซ้ำกัน
  return getSubmissions().some(s =>
    String(s.taskId) === String(taskId) &&
    String(s.studentNo) === String(studentNo) &&
    s.grade === GRADE &&
    Number(s.room) === Number(selectedRoom)
  );
}

// ========================
// INIT
// ========================
document.addEventListener('DOMContentLoaded', function () {
  syncFromSession();
  buildHeader();
  buildRoomSelector();
  buildStudentNameBar();
  buildTabs();
  renderTasks();
  setupLightbox();
});

function buildHeader() {
  const el = document.getElementById('cls-header');
  if (!el) return;
  el.style.background = `linear-gradient(135deg, ${cfg.color}22, ${cfg.color}08)`;
  el.style.border = `1px solid ${cfg.color}33`;
  el.innerHTML = `
    <div class="cls-header-top">
      <div>
        <div class="cls-grade-badge" style="background:${cfg.color}22;color:${cfg.color};border:1px solid ${cfg.color}44">${cfg.short}</div>
        <div class="cls-title">${cfg.label}</div>
        <div class="cls-desc">งานและกิจกรรมจากครู — เลือกห้องและกรอกชื่อเพื่อส่งงาน</div>
      </div>
      <div class="cls-emoji">${cfg.icon}</div>
    </div>
    <div class="cls-stats">
      <div class="cls-stat"><div class="cls-stat-num" id="stat-total">0</div><div class="cls-stat-label">งานทั้งหมด</div></div>
      <div class="cls-stat"><div class="cls-stat-num" id="stat-submitted">0</div><div class="cls-stat-label">ส่งแล้ว</div></div>
      <div class="cls-stat"><div class="cls-stat-num" id="stat-pending">0</div><div class="cls-stat-label">ยังไม่ส่ง</div></div>
    </div>`;
}

function buildRoomSelector() {
  const el = document.getElementById('cls-room-selector');
  if (!el) return;
  const opts = Array.from({ length: cfg.rooms }, (_, i) => `<option value="${i + 1}">ห้อง ${i + 1}</option>`).join('');
  el.innerHTML = `<div class="room-selector-wrap">
    <span class="room-selector-label">📍 เลือกห้องของคุณ:</span>
    <select class="room-select" id="room-sel" onchange="changeRoom(this.value)">${opts}</select>
  </div>`;
  const saved = parseInt(localStorage.getItem('cls_room_' + GRADE) || '1');
  selectedRoom = saved;
  document.getElementById('room-sel').value = saved;
}

function changeRoom(v) {
  selectedRoom = parseInt(v);
  localStorage.setItem('cls_room_' + GRADE, v);
  // อัปเดต session ด้วย
  const s = window.__studentSession;
  if (s) { s.room = selectedRoom; sessionStorage.setItem('student_session', JSON.stringify(s)); }
  renderTasks();
}

function buildStudentNameBar() {
  // ถ้ามี session อยู่แล้ว → student-auth.js จัดการ badge เอง
  // ถ้าไม่มี session ก็ปล่อยว่าง (auth overlay จะขึ้น)
  syncFromSession();
}

// ฟังก์ชัน saveName ยังคงไว้เผื่อใช้ภายใน แต่ไม่ได้เรียกจาก UI แล้ว
function saveName() {
  syncFromSession();
  renderTasks();
}

function buildTabs() {
  const el = document.getElementById('cls-tabs');
  if (!el) return;
  el.innerHTML = `<div class="cls-tabs">
    <button class="cls-tab active" id="tab-tasks" onclick="switchTab('tasks')">📋 งานทั้งหมด</button>
    <button class="cls-tab" id="tab-submitted" onclick="switchTab('submitted')">✅ งานที่ส่งแล้ว</button>
  </div>`;
}

function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.cls-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  renderTasks();
}

// ========================
// RENDER TASKS
// ========================
function renderTasks() {
  const wrap = document.getElementById('tasks-wrap');
  if (!wrap) return;
  const tasks = getTasks();

  // Update stats
  let submitted = 0;
  tasks.forEach(t => { if (isSubmitted(t.id)) submitted++; });
  const statTotal = document.getElementById('stat-total');
  const statSub = document.getElementById('stat-submitted');
  const statPend = document.getElementById('stat-pending');
  if (statTotal) statTotal.textContent = tasks.length;
  if (statSub) statSub.textContent = submitted;
  if (statPend) statPend.textContent = tasks.length - submitted;

  let filtered = tasks;
  if (currentTab === 'submitted') filtered = tasks.filter(t => isSubmitted(t.id));

  if (!filtered.length) {
    wrap.innerHTML = `<div class="cls-empty"><div class="cls-empty-icon">${currentTab === 'submitted' ? '📭' : '🎉'}</div>
      <div style="font-weight:600;margin-bottom:0.3rem">${currentTab === 'submitted' ? 'ยังไม่มีงานที่ส่ง' : 'ยังไม่มีงานที่ครูโพสต์'}</div>
      <div style="font-size:0.85rem">คอยติดตามได้เลย!</div></div>`;
    return;
  }

  wrap.innerHTML = filtered.map(task => renderTaskCard(task)).join('');
  setupImageUploads();
}

function renderTaskCard(task) {
  const now = Date.now();
  const due = task.dueDate ? new Date(task.dueDate + 'T23:59:59').getTime() : null;
  const daysLeft = due ? Math.ceil((due - now) / 86400000) : null;
  let dueBadge = '';
  if (due) {
    if (daysLeft < 0) dueBadge = `<span class="due-badge due-late">⚠ เกินกำหนด ${Math.abs(daysLeft)} วัน</span>`;
    else if (daysLeft <= 3) dueBadge = `<span class="due-badge due-soon">⏰ เหลือ ${daysLeft} วัน</span>`;
    else dueBadge = `<span class="due-badge due-ok">📅 ส่งภายใน ${daysLeft} วัน</span>`;
  }

  const typeBadge = task.type === 'form'
    ? `<span class="task-type-badge badge-form">📋 Google Form</span>`
    : task.type === 'image'
    ? `<span class="task-type-badge badge-image">🖼 ส่งรูปภาพ</span>`
    : `<span class="task-type-badge badge-both">📋🖼 Form + รูป</span>`;

  const attachHTML = (task.attachments || []).length
    ? `<div class="task-attachments">${task.attachments.map(a =>
        `<a class="attach-chip" href="${a.dataUrl}" download="${a.name}">📎 ${a.name}</a>`
      ).join('')}</div>` : '';

  const alreadySubmitted = isSubmitted(task.id);
  let actionHTML = '';

  if (alreadySubmitted) {
    actionHTML = `<div class="submitted-badge">✅ ส่งงานแล้ว</div>`;
  } else {
    let formBtn = '', imgUpload = '';
    if (task.type === 'form' || task.type === 'both') {
      formBtn = `<a href="${task.formUrl}" target="_blank" class="form-link-btn" onclick="markFormSubmit('${task.id}')">📋 เปิด Google Form</a>`;
    }
    if (task.type === 'image' || task.type === 'both') {
      imgUpload = `
        <div class="image-upload-area" onclick="document.getElementById('img-${task.id}').click()" data-taskid="${task.id}">
          <div class="image-upload-icon">🖼</div>
          <div class="image-upload-text">คลิกหรือลากวางรูปภาพที่นี่</div>
          <div class="image-upload-sub">รองรับ JPG, PNG, WEBP</div>
        </div>
        <input type="file" id="img-${task.id}" accept="image/*" multiple style="display:none" onchange="handleImageSelect('${task.id}', this)"/>
        <div class="image-previews" id="prev-${task.id}"></div>
        <button class="submit-btn" id="sub-btn-${task.id}" onclick="submitImages('${task.id}')" disabled>📤 ส่งงาน</button>`;
    }
    actionHTML = `<div style="display:flex;flex-direction:column;gap:0.8rem;">${formBtn}${imgUpload}</div>`;
  }

  const postedDate = task.postedAt ? new Date(task.postedAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

  return `<div class="task-card" id="card-${task.id}">
    <div class="task-card-header">
      <div>${typeBadge}</div>
      ${dueBadge}
    </div>
    <div class="task-title">${task.title}</div>
    <div class="task-desc">${task.desc || task.description || ''}</div>
    ${attachHTML}
    <div class="task-actions">${actionHTML}</div>
    <div class="task-footer">📌 โพสต์เมื่อ ${postedDate}${task.dueDate ? ` · ครบกำหนด ${new Date(task.dueDate).toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'numeric'})}` : ''}</div>
  </div>`;
}

// ========================
// FORM SUBMISSION
// ========================
function markFormSubmit(taskId) {
  syncFromSession(); // sync session ก่อนเสมอ
  if (!studentName || !studentNo) {
    showClsToast('⚠ กรุณาเข้าสู่ระบบก่อนส่งงาน', 'error');
    return;
  }
  if (isSubmitted(taskId)) {
    showClsToast('✅ ส่งงานนี้ไปแล้ว', 'error');
    return;
  }
  // รอ 2 วิ ให้ Form เปิดก่อน แล้วบันทึก
  showClsToast('เปิด Google Form แล้ว... กลับมากดบันทึกหลังส่ง Form');
  setTimeout(() => {
    saveSubmission({ id: Date.now(), taskId: String(taskId), studentName, studentNo, grade: GRADE, room: Number(selectedRoom), submittedAt: new Date().toISOString(), type: 'form', images: [] });
    renderTasks();
    showClsToast('✅ บันทึกการส่งงานแล้ว');
  }, 2000);
}

// ========================
// IMAGE UPLOAD
// ========================
function setupImageUploads() {
  document.querySelectorAll('.image-upload-area').forEach(area => {
    const tid = area.dataset.taskid;
    area.addEventListener('dragover', e => { e.preventDefault(); area.classList.add('drag-over'); });
    area.addEventListener('dragleave', () => area.classList.remove('drag-over'));
    area.addEventListener('drop', e => {
      e.preventDefault(); area.classList.remove('drag-over');
      const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
      processImages(tid, files);
    });
  });
}

function handleImageSelect(taskId, input) {
  const files = Array.from(input.files);
  processImages(taskId, files);
  input.value = '';
}

function processImages(taskId, files) {
  const key = String(taskId);
  if (!pendingImages[key]) pendingImages[key] = [];
  let loaded = 0;
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = e => {
      pendingImages[key].push({ name: file.name, dataUrl: e.target.result });
      loaded++;
      if (loaded === files.length) renderPreviews(String(taskId));
    };
    reader.readAsDataURL(file);
  });
}

function renderPreviews(taskId) {
  const wrap = document.getElementById('prev-' + taskId);
  const btn = document.getElementById('sub-btn-' + taskId);
  if (!wrap) return;
  const imgs = pendingImages[taskId] || [];
  wrap.innerHTML = imgs.map((img, i) => `
    <div class="image-preview-item">
      <img src="${img.dataUrl}" alt="${img.name}" onclick="openLightbox('${img.dataUrl}')"/>
      <button class="image-preview-remove" onclick="removeImage('${taskId}',${i})">✕</button>
    </div>`).join('');
  if (btn) btn.disabled = imgs.length === 0;
}

function removeImage(taskId, idx) {
  if (pendingImages[taskId]) { pendingImages[taskId].splice(idx, 1); renderPreviews(taskId); }
}

function submitImages(taskId) {
  syncFromSession(); // sync session ก่อนเสมอ
  if (!studentName || !studentNo) {
    showClsToast('⚠ กรุณาเข้าสู่ระบบก่อนส่งงาน', 'error');
    document.getElementById('cls-name-bar')?.scrollIntoView({ behavior: 'smooth' });
    return;
  }
  if (isSubmitted(taskId)) {
    showClsToast('✅ ส่งงานนี้ไปแล้ว', 'error');
    return;
  }
  const imgs = pendingImages[String(taskId)] || [];
  if (!imgs.length) { showClsToast('กรุณาเลือกรูปภาพก่อน', 'error'); return; }
  saveSubmission({ id: Date.now(), taskId: String(taskId), studentName, studentNo, grade: GRADE, room: Number(selectedRoom), submittedAt: new Date().toISOString(), type: 'image', images: imgs });
  pendingImages[String(taskId)] = [];
  renderTasks();
  showClsToast('ส่งงานสำเร็จ! ✅');
}

// ========================
// LIGHTBOX
// ========================
function setupLightbox() {
  const lb = document.getElementById('lightbox');
  if (lb) lb.addEventListener('click', e => { if (e.target === lb) lb.classList.remove('open'); });
}
function openLightbox(src) {
  const lb = document.getElementById('lightbox');
  const img = document.getElementById('lightbox-img');
  if (lb && img) { img.src = src; lb.classList.add('open'); }
}

// ========================
// TOAST
// ========================
function showClsToast(msg, type = 'success') {
  let t = document.getElementById('cls-toast');
  if (!t) { t = document.createElement('div'); t.id = 'cls-toast'; t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.className = 'toast ' + type + ' show';
  clearTimeout(t._tid);
  t._tid = setTimeout(() => t.classList.remove('show'), 2800);
}
