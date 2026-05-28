// =====================
// AUTH GUARD
// =====================
if (sessionStorage.getItem('admin_logged_in') !== 'true') {
  window.location.href = 'login.html';
}
async function logout() {
  if (typeof sb_adminSignOut === 'function') await sb_adminSignOut();
  sessionStorage.removeItem('admin_logged_in');
  window.location.href = 'login.html';
}

// =====================
// GRADE/ROOM CONFIG
// =====================
const GRADES = {
  p5: { label: 'ป.5', icon: '🎒', rooms: 7, color: 'var(--p5-color)' },
  p6: { label: 'ป.6', icon: '📝', rooms: 7, color: 'var(--p6-color)' },
  m4: { label: 'ม.4', icon: '🎓', rooms: 5, color: 'var(--m4-color)' }
};
function getRooms(grade) {
  return Array.from({ length: GRADES[grade].rooms }, (_, i) => i + 1);
}
function roomKey(grade, room) { return grade + '_' + room; }
function roomLabel(grade, room) { return GRADES[grade].label + '/' + room; }

// =====================
// STATE
// =====================
let currentStudentGrade = 'p5';
let currentStudentRoom = 1;
let currentAttendGrade = 'p5';
let currentAttendRoom = 1;
let currentTaskFilter = 'all';
let importData = [];
let taskAttachments = []; // pending attachments when creating task
const TODAY = new Date().toISOString().split('T')[0];

// =====================
// STORAGE
// =====================
function getStudents(grade, room) {
  return JSON.parse(localStorage.getItem('students_' + roomKey(grade, room)) || '[]');
}
function setStudents(grade, room, arr) {
  localStorage.setItem('students_' + roomKey(grade, room), JSON.stringify(arr));
  if (typeof fb_saveStudents === 'function') fb_saveStudents(grade, room, arr);
}
function getAttendance(grade, room, date) {
  return JSON.parse(localStorage.getItem('attend_' + roomKey(grade, room) + '_' + date) || '{}');
}
function setAttendance(grade, room, date, data) {
  localStorage.setItem('attend_' + roomKey(grade, room) + '_' + date, JSON.stringify(data));
  let logs = JSON.parse(localStorage.getItem('attend_logs') || '[]');
  const key = roomKey(grade, room) + '_' + date;
  if (!logs.includes(key)) { logs.unshift(key); if (logs.length > 200) logs = logs.slice(0, 200); }
  localStorage.setItem('attend_logs', JSON.stringify(logs));
  if (typeof fb_saveAttendance === 'function') fb_saveAttendance(grade, room, date, data);
}

// =====================
// TOAST
// =====================
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast ' + type + ' show';
  clearTimeout(t._tid);
  t._tid = setTimeout(() => t.classList.remove('show'), 2800);
}

// =====================
// PAGE NAV
// =====================
function showPage(name, el) {
  document.querySelectorAll('.page-content').forEach(p => p.style.display = 'none');
  document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
  document.getElementById('page-' + name).style.display = '';
  if (el) el.classList.add('active');
  if (name === 'dashboard') renderDashboard();
  if (name === 'attendance') initAttendPage();
  if (name === 'students') initStudentPage();
  if (name === 'assignments') renderTasksAdmin();
}

// =====================
// ROOM TAB BUILDER
// =====================
function buildRoomTabs(containerId, grade, activeRoom, onClickFn) {
  const wrap = document.getElementById(containerId);
  if (!wrap) return;
  wrap.innerHTML = getRooms(grade).map(r =>
    `<button class="room-tab ${r === activeRoom ? 'active' : ''}" onclick="${onClickFn}(${r},this)">ห้อง ${r}</button>`
  ).join('');
}

// =====================
// DASHBOARD
// =====================
function renderDashboard() {
  const today = document.getElementById('today-date');
  if (today) today.textContent = 'วันที่ ' + new Date().toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  let totalStudents = 0, totalPresent = 0, totalAbsent = 0, totalLate = 0;
  const overviewEl = document.getElementById('db-grade-overview');
  let overviewHTML = '';

  Object.entries(GRADES).forEach(([grade, cfg]) => {
    let gradeStudents = 0, gradePresent = 0, gradeAbsent = 0, gradeLate = 0, gradeBiz = 0, gradeSick = 0;
    let roomCards = '';
    getRooms(grade).forEach(room => {
      const students = getStudents(grade, room);
      const att = getAttendance(grade, room, TODAY);
      let p = 0, a = 0, l = 0, biz = 0, sick = 0;
      students.forEach(s => {
        const st = att[s.no] || '';
        if (st === 'present') p++; else if (st === 'absent') a++; else if (st === 'late') l++; else if (st === 'biz') biz++; else if (st === 'sick') sick++;
      });
      gradeStudents += students.length; gradePresent += p; gradeAbsent += a; gradeLate += l; gradeBiz += biz; gradeSick += sick;
      const pct = students.length > 0 ? Math.round(p / students.length * 100) : 0;
      roomCards += `<div class="room-mini-card">
        <div class="room-mini-name">${cfg.label}/${room}</div>
        <div class="room-mini-count">${students.length} คน · มา ${p}</div>
        <div class="room-mini-bar"><div class="room-mini-fill" style="width:${pct}%;background:${cfg.color}"></div></div>
      </div>`;
    });
    totalStudents += gradeStudents; totalPresent += gradePresent; totalAbsent += gradeAbsent; totalLate += gradeLate;
    overviewHTML += `<div style="margin-bottom:1.5rem">
      <div class="grade-label">${cfg.icon} ${cfg.label} <span style="font-size:0.82rem;color:var(--text-secondary);font-weight:400">${gradeStudents} คน · มา ${gradePresent} · ขาด ${gradeAbsent} · สาย ${gradeLate} · ลากิจ ${gradeBiz} · ลาป่วย ${gradeSick}</span></div>
      <div class="grade-rooms-grid">${roomCards}</div>
    </div>`;
  });

  if (overviewEl) overviewEl.innerHTML = overviewHTML;
  document.getElementById('db-total-students').textContent = totalStudents;
  document.getElementById('db-present-today').textContent = totalPresent;
  document.getElementById('db-absent-today').textContent = totalAbsent;
  document.getElementById('db-late-today').textContent = totalLate;
  const pct = totalStudents > 0 ? Math.round(totalPresent / totalStudents * 100) : 0;
  document.getElementById('db-present-pct').textContent = pct + '% ของนักเรียนทั้งหมด';
  renderRecentLog();
  renderSubmissionStats();
}

function renderRecentLog() {
  const logs = JSON.parse(localStorage.getItem('attend_logs') || '[]');
  const wrap = document.getElementById('recent-log-wrap');
  if (!wrap) return;
  if (!logs.length) {
    wrap.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📭</div><div>ยังไม่มีข้อมูลการเช็คชื่อ</div></div>';
    return;
  }
  const rows = logs.slice(0, 15).map(key => {
    const parts = key.split('_');
    const date = parts[parts.length - 1];
    const grade = parts[0];
    const room = parts[1];
    const students = getStudents(grade, parseInt(room));
    const att = getAttendance(grade, parseInt(room), date);
    let p = 0, a = 0, l = 0, biz = 0, sick = 0;
    students.forEach(s => { const st = att[s.no] || ''; if (st === 'present') p++; else if (st === 'absent') a++; else if (st === 'late') l++; else if (st === 'biz') biz++; else if (st === 'sick') sick++; });
    const cfg = GRADES[grade] || {};
    return `<tr>
      <td>${(cfg.icon || '') + ' ' + (cfg.label || grade) + '/' + room}</td>
      <td>${formatThaiDate(date)}</td>
      <td>${students.length}</td>
      <td><span class="status-present">✅ ${p}</span></td>
      <td><span class="status-absent">❌ ${a}</span></td>
      <td><span class="status-late">⏰ ${l}</span></td>
      <td><span class="status-biz">📋 ${biz}</span></td>
      <td><span class="status-sick">🤒 ${sick}</span></td>
    </tr>`;
  }).join('');
  wrap.innerHTML = `<table class="data-table"><thead><tr><th>ห้อง</th><th>วันที่</th><th>ทั้งหมด</th><th>มา</th><th>ขาด</th><th>สาย</th><th>ลากิจ</th><th>ลาป่วย</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function formatThaiDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
}

// =====================
// ATTENDANCE PAGE
// =====================
function initAttendPage() {
  const di = document.getElementById('attend-date');
  if (di && !di.value) di.value = TODAY;
  const dl = document.getElementById('attend-date-label');
  if (dl) dl.textContent = 'วันที่ ' + new Date().toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  buildRoomTabs('attend-room-tabs', currentAttendGrade, currentAttendRoom, 'switchAttendRoom');
  renderAttendTable();
}

function switchAttendGrade(grade, el) {
  currentAttendGrade = grade;
  currentAttendRoom = 1;
  document.querySelectorAll('#page-attendance .class-tab').forEach(t => t.classList.remove('active'));
  if (el) el.classList.add('active');
  buildRoomTabs('attend-room-tabs', grade, 1, 'switchAttendRoom');
  renderAttendTable();
}

function switchAttendRoom(room, el) {
  currentAttendRoom = room;
  document.querySelectorAll('#attend-room-tabs .room-tab').forEach(t => t.classList.remove('active'));
  if (el) el.classList.add('active');
  renderAttendTable();
}

function renderAttendTable() {
  const wrap = document.getElementById('attend-table-wrap');
  if (!wrap) return;
  const grade = currentAttendGrade, room = currentAttendRoom;
  const students = getStudents(grade, room);
  const date = document.getElementById('attend-date')?.value || TODAY;
  const att = getAttendance(grade, room, date);
  const label = roomLabel(grade, room);

  if (!students.length) {
    wrap.innerHTML = `<div class="empty-state"><div class="empty-state-icon">👤</div><div>ยังไม่มีรายชื่อ ${label}</div><div style="font-size:0.82rem;color:var(--text-muted);margin-top:0.5rem">เพิ่มรายชื่อในเมนู "รายชื่อนักเรียน"</div></div>`;
    return;
  }
  const rows = students.map(s => {
    const st = att[s.no] || '';
    const stBadge = st === 'present' ? '<span class="status-present">✅ มา</span>' : st === 'absent' ? '<span class="status-absent">❌ ขาด</span>' : st === 'late' ? '<span class="status-late">⏰ สาย</span>' : st === 'biz' ? '<span class="status-biz">📋 ลากิจ</span>' : st === 'sick' ? '<span class="status-sick">🤒 ลาป่วย</span>' : '<span style="color:var(--text-muted);font-size:0.82rem">ยังไม่เช็ค</span>';
    return `<tr>
      <td>${s.no}</td><td>${s.name}</td>
      <td><div class="attend-btn-group">
        <button class="attend-btn p ${st === 'present' ? 'active-p' : ''}" onclick="setAttend('${s.no}','present')">✅ มา</button>
        <button class="attend-btn a ${st === 'absent' ? 'active-a' : ''}" onclick="setAttend('${s.no}','absent')">❌ ขาด</button>
        <button class="attend-btn l ${st === 'late' ? 'active-l' : ''}" onclick="setAttend('${s.no}','late')">⏰ สาย</button>
        <button class="attend-btn biz ${st === 'biz' ? 'active-biz' : ''}" onclick="setAttend('${s.no}','biz')">📋 ลากิจ</button>
        <button class="attend-btn sick ${st === 'sick' ? 'active-sick' : ''}" onclick="setAttend('${s.no}','sick')">🤒 ลาป่วย</button>
      </div></td>
      <td>${stBadge}</td>
    </tr>`;
  }).join('');
  wrap.innerHTML = `<table class="data-table"><thead><tr><th>เลขที่</th><th>ชื่อ-สกุล</th><th>เช็คชื่อ</th><th>สถานะ</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function setAttend(no, status) {
  const date = document.getElementById('attend-date')?.value || TODAY;
  const att = getAttendance(currentAttendGrade, currentAttendRoom, date);
  att[no] = status;
  setAttendance(currentAttendGrade, currentAttendRoom, date, att);
  renderAttendTable();
}

function markAllRoom(status) {
  const date = document.getElementById('attend-date')?.value || TODAY;
  const students = getStudents(currentAttendGrade, currentAttendRoom);
  const att = getAttendance(currentAttendGrade, currentAttendRoom, date);
  students.forEach(s => att[s.no] = status);
  setAttendance(currentAttendGrade, currentAttendRoom, date, att);
  renderAttendTable();
  showToast('บันทึกสถานะทุกคนแล้ว');
}

function saveAttendance() {
  showToast('💾 บันทึกการเช็คชื่อสำเร็จ');
}

document.addEventListener('change', function(e) {
  if (e.target.id === 'attend-date') renderAttendTable();
});

// =====================
// STUDENTS PAGE
// =====================
function initStudentPage() {
  buildRoomTabs('student-room-tabs', currentStudentGrade, currentStudentRoom, 'switchStudentRoom');
  renderStudentTable();
}

function switchStudentGrade(grade, el) {
  currentStudentGrade = grade;
  currentStudentRoom = 1;
  document.querySelectorAll('#page-students .class-tab').forEach(t => t.classList.remove('active'));
  if (el) el.classList.add('active');
  document.getElementById('student-search').value = '';
  buildRoomTabs('student-room-tabs', grade, 1, 'switchStudentRoom');
  renderStudentTable();
}

function switchStudentRoom(room, el) {
  currentStudentRoom = room;
  document.querySelectorAll('#student-room-tabs .room-tab').forEach(t => t.classList.remove('active'));
  if (el) el.classList.add('active');
  document.getElementById('student-search').value = '';
  renderStudentTable();
}

function renderStudentTable() {
  const wrap = document.getElementById('student-table-wrap');
  if (!wrap) return;
  const grade = currentStudentGrade, room = currentStudentRoom;
  const all = getStudents(grade, room);
  const q = (document.getElementById('student-search')?.value || '').toLowerCase();
  const students = q ? all.filter(s => s.name.toLowerCase().includes(q) || String(s.no).includes(q)) : all;
  const badge = document.getElementById('student-count-badge');
  if (badge) badge.textContent = `ทั้งหมด ${all.length} คน${q ? ` | ผลลัพธ์ ${students.length} คน` : ''}`;
  if (!all.length) {
    wrap.innerHTML = `<div class="empty-state"><div class="empty-state-icon">👤</div><div>ยังไม่มีรายชื่อ ${roomLabel(grade, room)}</div></div>`;
    return;
  }
  if (!students.length) {
    wrap.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🔍</div><div>ไม่พบรายชื่อที่ค้นหา</div></div>';
    return;
  }
  const rows = students.map(s => `<tr>
    <td>${s.no}</td><td>${s.name}</td>
    <td><span style="font-size:0.8rem;color:var(--text-secondary)">${roomLabel(grade, room)}</span></td>
    <td>${s.pin
      ? `<span style="font-size:0.78rem;color:#6bcb77;font-weight:600">🔒 ตั้งแล้ว</span>`
      : `<span style="font-size:0.78rem;color:#ffd93d;font-weight:600">⚠ ยังไม่มี PIN</span>`
    }</td>
    <td style="display:flex;gap:0.4rem;flex-wrap:wrap">
      <button class="attend-btn" style="background:rgba(255,180,0,0.15);color:#ffd93d;border-color:rgba(255,180,0,0.3)" onclick="resetStudentPin('${s.no}')">🔑 Reset PIN</button>
      <button class="attend-btn a" onclick="deleteStudent('${s.no}')">🗑 ลบ</button>
    </td>
  </tr>`).join('');
  wrap.innerHTML = `<table class="data-table"><thead><tr><th>เลขที่</th><th>ชื่อ-สกุล</th><th>ห้อง</th><th>PIN</th><th>จัดการ</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function resetStudentPin(no) {
  const grade = currentStudentGrade, room = currentStudentRoom;
  const arr = getStudents(grade, room);
  const s = arr.find(x => String(x.no) === String(no));
  if (!s) return;
  const newPin = prompt(`Reset PIN ของ "${s.name}" (เลขที่ ${no})\nกรอก PIN ใหม่ 4 หลัก หรือเว้นว่างเพื่อลบ PIN:`);
  if (newPin === null) return; // กด cancel
  if (newPin !== '' && !/^\d{4}$/.test(newPin)) {
    showToast('PIN ต้องเป็นตัวเลข 4 หลักเท่านั้น', 'error'); return;
  }
  if (newPin === '') {
    delete s.pin;
  } else {
    s.pin = newPin;
  }
  setStudents(grade, room, arr);
  renderStudentTable();
  showToast(newPin ? `Reset PIN ของ ${s.name} สำเร็จ` : `ลบ PIN ของ ${s.name} แล้ว (ให้ตั้งใหม่ตอน Login)`);
}

function deleteStudent(no) {
  if (!confirm('ลบนักเรียนเลขที่ ' + no + ' ออก?')) return;
  const arr = getStudents(currentStudentGrade, currentStudentRoom).filter(s => String(s.no) !== String(no));
  setStudents(currentStudentGrade, currentStudentRoom, arr);
  renderStudentTable();
  showToast('ลบนักเรียนสำเร็จ', 'error');
}

function openAddStudent() {
  document.getElementById('add-grade').value = currentStudentGrade;
  updateAddRoomSel();
  document.getElementById('add-room').value = currentStudentRoom;
  document.getElementById('add-no').value = '';
  document.getElementById('add-name').value = '';
  document.getElementById('add-student-modal').classList.add('open');
}

function updateAddRoomSel() {
  const grade = document.getElementById('add-grade').value;
  const sel = document.getElementById('add-room');
  sel.innerHTML = getRooms(grade).map(r => `<option value="${r}">ห้อง ${r}</option>`).join('');
}

function confirmAddStudent() {
  const grade = document.getElementById('add-grade').value;
  const room = parseInt(document.getElementById('add-room').value);
  const no = document.getElementById('add-no').value.trim();
  const name = document.getElementById('add-name').value.trim();
  if (!no || !name) { showToast('กรุณากรอกข้อมูลให้ครบ', 'error'); return; }
  const arr = getStudents(grade, room);
  if (arr.find(s => String(s.no) === no)) { showToast('เลขที่ซ้ำในห้องนี้!', 'error'); return; }
  arr.push({ no, name });
  arr.sort((a, b) => Number(a.no) - Number(b.no));
  setStudents(grade, room, arr);
  document.getElementById('add-student-modal').classList.remove('open');
  if (currentStudentGrade === grade && currentStudentRoom === room) renderStudentTable();
  showToast(`เพิ่มนักเรียนสำเร็จ (${roomLabel(grade, room)})`);
}

// =====================
// IMPORT EXCEL
// =====================
function updateImportRoomSel() {
  const grade = document.getElementById('import-grade-sel').value;
  const sel = document.getElementById('import-room-sel');
  sel.innerHTML = getRooms(grade).map(r => `<option value="${r}">ห้อง ${r}</option>`).join('');
  importData = [];
  document.getElementById('import-preview').textContent = '';
  document.getElementById('import-confirm-btn').style.display = 'none';
}

function handleImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(ev) {
    try {
      const wb = XLSX.read(ev.target.result, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, { defval: '' });
      importData = json.map(row => {
        const keys = Object.keys(row);
        return { no: String(row[keys[0]] || '').trim(), name: String(row[keys[1]] || '').trim() };
      }).filter(r => r.no && r.name);
      if (!importData.length) {
        document.getElementById('import-preview').textContent = '❌ ไม่พบข้อมูล กรุณาตรวจสอบรูปแบบ';
        document.getElementById('import-confirm-btn').style.display = 'none';
        return;
      }
      document.getElementById('import-preview').innerHTML = `✅ พบ <strong>${importData.length} รายการ</strong> — ตัวอย่าง: ${importData.slice(0, 3).map(r => r.no + ' ' + r.name).join(', ')}`;
      document.getElementById('import-confirm-btn').style.display = '';
    } catch (err) {
      document.getElementById('import-preview').textContent = '❌ ' + err.message;
    }
  };
  reader.readAsBinaryString(file);
  e.target.value = '';
}

function confirmImport() {
  if (!importData.length) return;
  const grade = document.getElementById('import-grade-sel').value;
  const room = parseInt(document.getElementById('import-room-sel').value);
  const arr = getStudents(grade, room);
  let added = 0;
  importData.forEach(s => {
    if (!arr.find(x => String(x.no) === String(s.no))) { arr.push(s); added++; }
  });
  arr.sort((a, b) => Number(a.no) - Number(b.no));
  setStudents(grade, room, arr);
  document.getElementById('import-modal').classList.remove('open');
  importData = [];
  showToast(`Import สำเร็จ! เพิ่ม ${added} คน → ${roomLabel(grade, room)}`);
  if (currentStudentGrade === grade && currentStudentRoom === room) renderStudentTable();
}

// Drag & drop
document.addEventListener('DOMContentLoaded', function() {
  const area = document.getElementById('import-area');
  if (area) {
    area.addEventListener('dragover', e => { e.preventDefault(); area.classList.add('drag-over'); });
    area.addEventListener('dragleave', () => area.classList.remove('drag-over'));
    area.addEventListener('drop', e => {
      e.preventDefault(); area.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file) handleImport({ target: { files: [file], value: '' } });
    });
  }
  updateImportRoomSel();
  updateAddRoomSel();
  renderDashboard();
  // Push ข้อมูลใน localStorage ขึ้น Supabase ทุกครั้งที่ admin เปิด dashboard
  setTimeout(() => {
    if (typeof fb_pushAll === 'function') fb_pushAll();
  }, 1500);
});

// =====================
// EXPORT EXCEL
// =====================
function exportStudentsExcel() {
  const wb = XLSX.utils.book_new();
  Object.entries(GRADES).forEach(([grade, cfg]) => {
    getRooms(grade).forEach(room => {
      const students = getStudents(grade, room);
      if (!students.length) return;
      const data = [['เลขที่', 'ชื่อ-สกุล', 'ห้อง'], ...students.map(s => [s.no, s.name, roomLabel(grade, room)])];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), roomLabel(grade, room));
    });
  });
  if (!wb.SheetNames.length) { showToast('ไม่มีข้อมูลนักเรียน', 'error'); return; }
  XLSX.writeFile(wb, 'รายชื่อนักเรียน_' + TODAY + '.xlsx');
  showToast('Export รายชื่อนักเรียนสำเร็จ');
}

function exportAttendanceExcel() {
  const wb = XLSX.utils.book_new();
  const logs = JSON.parse(localStorage.getItem('attend_logs') || '[]');
  Object.entries(GRADES).forEach(([grade, cfg]) => {
    getRooms(grade).forEach(room => {
      const students = getStudents(grade, room);
      const key = roomKey(grade, room);
      const dates = [...new Set(logs.filter(k => k.startsWith(key + '_')).map(k => k.replace(key + '_', '')))];
      if (!students.length && !dates.length) return;
      const header = ['เลขที่', 'ชื่อ-สกุล', ...dates];
      const rows = students.map(s => {
        const cols = [s.no, s.name];
        dates.forEach(d => {
          const st = (getAttendance(grade, room, d)[s.no] || '');
          cols.push(st === 'present' ? 'มา' : st === 'absent' ? 'ขาด' : st === 'late' ? 'สาย' : st === 'biz' ? 'ลากิจ' : st === 'sick' ? 'ลาป่วย' : '-');
        });
        return cols;
      });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([header, ...rows]), roomLabel(grade, room));
    });
  });
  if (!wb.SheetNames.length) { showToast('ไม่มีข้อมูลการเช็คชื่อ', 'error'); return; }
  XLSX.writeFile(wb, 'เช็คชื่อ_' + TODAY + '.xlsx');
  showToast('Export การเช็คชื่อสำเร็จ');
}

// =====================
// ASSIGNMENT MANAGEMENT
// =====================
function getTasks() { return JSON.parse(localStorage.getItem('tasks') || '[]'); }
function saveTasks(arr) {
  localStorage.setItem('tasks', JSON.stringify(arr));
  if (typeof fb_saveTasks === 'function') fb_saveTasks(arr);
}
function getSubmissions() { return JSON.parse(localStorage.getItem('submissions') || '[]'); }

// =====================
// SUBMISSION STATS
// =====================
function getSubmissionStats() {
  const tasks = getTasks();
  const subs = getSubmissions();
  const totalTasks = tasks.length;
  const totalSubs = subs.length;
  let rateSum = 0, rateCount = 0;
  tasks.forEach(task => {
    let eligible = 0;
    (task.targetGrades || []).forEach(grade => {
      getRooms(grade).forEach(room => { eligible += getStudents(grade, room).length; });
    });
    if (eligible > 0) {
      const submitted = subs.filter(s => String(s.taskId) === String(task.id)).length;
      rateSum += Math.min(submitted / eligible, 1);
      rateCount++;
    }
  });
  const avgRate = rateCount > 0 ? Math.round((rateSum / rateCount) * 100) : 0;
  return { totalTasks, totalSubs, avgRate };
}

function getSubsByGrade() {
  const tasks = getTasks();
  const subs = getSubmissions();
  const result = {};
  Object.keys(GRADES).forEach(grade => {
    const gradeTasks = tasks.filter(t => (t.targetGrades || []).includes(grade));
    let eligible = 0;
    getRooms(grade).forEach(room => { eligible += getStudents(grade, room).length; });
    const totalSlots = eligible * gradeTasks.length;
    const gradeTaskIds = new Set(gradeTasks.map(t => String(t.id)));
    const submitted = subs.filter(s => gradeTaskIds.has(String(s.taskId)) && s.grade === grade).length;
    result[grade] = {
      tasks: gradeTasks.length, eligible, submitted, totalSlots,
      pct: totalSlots > 0 ? Math.round((submitted / totalSlots) * 100) : 0
    };
  });
  return result;
}

function renderSubmissionStats() {
  const { totalTasks, totalSubs, avgRate } = getSubmissionStats();
  const el = (id) => document.getElementById(id);
  if (el('db-total-tasks')) el('db-total-tasks').textContent = totalTasks;
  if (el('db-total-subs')) el('db-total-subs').textContent = totalSubs;
  if (el('db-sub-rate')) el('db-sub-rate').textContent = avgRate + '%';
  if (el('db-tasks-sub')) el('db-tasks-sub').textContent = totalTasks > 0 ? totalTasks + ' รายการ' : 'ยังไม่มีงาน';
  if (el('db-sub-rate-sub')) el('db-sub-rate-sub').textContent = totalTasks > 0 ? 'เฉลี่ย ' + totalTasks + ' งาน' : 'ยังไม่มีงาน';

  // Per-grade breakdown
  const breakdownEl = el('db-sub-breakdown-content');
  if (breakdownEl) {
    const byGrade = getSubsByGrade();
    const hasData = Object.values(byGrade).some(g => g.tasks > 0);
    if (!hasData) {
      breakdownEl.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📭</div><div>ยังไม่มีข้อมูลงาน</div></div>';
    } else {
      const rows = Object.entries(GRADES).map(([grade, cfg]) => {
        const d = byGrade[grade];
        const barColor = cfg.color;
        return `<tr>
          <td><span class="grade-chip chip-${grade}">${cfg.icon} ${cfg.label}</span></td>
          <td>${d.tasks} งาน</td>
          <td>${d.eligible} คน</td>
          <td>${d.submitted} / ${d.totalSlots || 0}</td>
          <td style="min-width:140px">
            <div style="display:flex;align-items:center;gap:8px">
              <div style="flex:1;height:6px;border-radius:3px;background:var(--bg-dark);overflow:hidden">
                <div style="height:100%;border-radius:3px;width:${d.pct}%;background:${barColor};transition:width 0.6s ease"></div>
              </div>
              <span style="font-size:0.8rem;font-weight:700;color:${barColor};min-width:36px">${d.pct}%</span>
            </div>
          </td>
        </tr>`;
      }).join('');
      breakdownEl.innerHTML = `<table class="data-table"><thead><tr><th>ชั้น</th><th>จำนวนงาน</th><th>นักเรียน</th><th>ส่งแล้ว</th><th>อัตรา</th></tr></thead><tbody>${rows}</tbody></table>`;
    }
  }

  // Recent submissions feed
  const recentEl = el('recent-subs-wrap');
  if (recentEl) {
    const allSubs = getSubmissions().slice().sort((a, b) => b.submittedAt - a.submittedAt).slice(0, 10);
    if (!allSubs.length) {
      recentEl.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📭</div><div>ยังไม่มีการส่งงาน</div></div>';
    } else {
      const tasks = getTasks();
      const rows = allSubs.map(sub => {
        const task = tasks.find(t => String(t.id) === String(sub.taskId));
        const taskTitle = task ? task.title : '(งานไม่พบ)';
        const cfg = GRADES[sub.grade] || {};
        const time = new Date(sub.submittedAt).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
        const typeLabel = sub.type === 'form' ? '📋 Form' : '🖼 รูป';
        return `<tr>
          <td><span class="grade-chip chip-${sub.grade}">${cfg.icon || ''} ${cfg.label || sub.grade}/${sub.room}</span></td>
          <td>${sub.studentNo ? 'เลขที่ ' + sub.studentNo + ' ' : ''}${sub.studentName}</td>
          <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${taskTitle}">${taskTitle}</td>
          <td><span style="font-size:0.78rem;color:var(--text-secondary)">${typeLabel}</span></td>
          <td style="white-space:nowrap;font-size:0.8rem">${time}</td>
        </tr>`;
      }).join('');
      recentEl.innerHTML = `<table class="data-table"><thead><tr><th>ห้อง</th><th>นักเรียน</th><th>งาน</th><th>ประเภท</th><th>เวลา</th></tr></thead><tbody>${rows}</tbody></table>`;
    }
  }
}

function switchTaskFilter(f, el) {
  currentTaskFilter = f;
  document.querySelectorAll('#page-assignments .class-tab').forEach(t => t.classList.remove('active'));
  if (el) el.classList.add('active');
  renderTasksAdmin();
}

function renderTasksAdmin() {
  const wrap = document.getElementById('tasks-admin-list');
  if (!wrap) return;
  let tasks = getTasks().sort((a, b) => b.postedAt - a.postedAt);
  if (currentTaskFilter !== 'all') tasks = tasks.filter(t => t.targetGrades && t.targetGrades.includes(currentTaskFilter));
  if (!tasks.length) {
    wrap.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📭</div><div>ยังไม่มีงาน กด "+ สร้างงานใหม่" ด้านบน</div></div>';
    return;
  }
  const subs = getSubmissions();
  wrap.innerHTML = tasks.map(t => {
    const subCount = subs.filter(s => String(s.taskId) === String(t.id)).length;
    const gradeChips = (t.targetGrades || []).map(g => `<span class="grade-chip chip-${g}">${GRADES[g]?.icon} ${GRADES[g]?.label}</span>`).join('');
    const typeLabel = t.type === 'form' ? '📋 Form' : t.type === 'image' ? '🖼 รูปภาพ' : '📋🖼 Form+รูป';
    const dueStr = t.dueDate ? `ครบกำหนด ${new Date(t.dueDate).toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'numeric'})}` : 'ไม่มีกำหนด';
    return `<div class="task-admin-card">
      <div class="task-admin-info">
        <div class="task-admin-title">${t.title}</div>
        <div class="task-admin-meta">
          <span>${typeLabel}</span><span>📅 ${dueStr}</span>
          <span>📬 ส่งแล้ว ${subCount} คน</span>
          <span>${gradeChips}</span>
        </div>
      </div>
      <div class="task-admin-actions">
        <button class="btn-action btn-primary-sm" onclick="viewSubmissions('${t.id}')">📬 ดูงาน</button>
        <button class="btn-action btn-warning" onclick="editTask('${t.id}')">✏ แก้ไข</button>
        <button class="btn-action btn-danger" onclick="deleteTask('${t.id}')">🗑</button>
      </div>
    </div>`;
  }).join('');
}

function toggleFormUrl() {
  const type = document.getElementById('task-type').value;
  const grp = document.getElementById('form-url-group');
  if (grp) grp.style.display = type === 'image' ? 'none' : '';
}

function handleTaskAttach(e) {
  Array.from(e.target.files).forEach(file => {
    const reader = new FileReader();
    reader.onload = ev => {
      taskAttachments.push({ name: file.name, dataUrl: ev.target.result });
      renderAttachList();
    };
    reader.readAsDataURL(file);
  });
  e.target.value = '';
}

function renderAttachList() {
  const wrap = document.getElementById('task-attach-list');
  if (!wrap) return;
  wrap.innerHTML = taskAttachments.map((a, i) =>
    `<div class="attach-chip-admin">📎 ${a.name} <button onclick="taskAttachments.splice(${i},1);renderAttachList()">✕</button></div>`
  ).join('');
}

function closeTaskModal() {
  document.getElementById('new-task-modal').classList.remove('open');
  document.getElementById('edit-task-id').value = '';
  document.getElementById('task-title').value = '';
  document.getElementById('task-desc').value = '';
  document.getElementById('task-type').value = 'form';
  document.getElementById('task-form-url').value = '';
  document.getElementById('task-due').value = '';
  ['p5','p6','m4'].forEach(g => { const cb = document.getElementById('tg-'+g); if(cb) cb.checked = false; });
  taskAttachments = [];
  renderAttachList();
  toggleFormUrl();
}

function saveTask() {
  const title = document.getElementById('task-title').value.trim();
  if (!title) { showToast('กรุณาใส่ชื่องาน', 'error'); return; }

  const type = document.getElementById('task-type').value;
  const formUrl = document.getElementById('task-form-url').value.trim();
  if (type !== 'image' && !formUrl) { showToast('กรุณาใส่ลิงก์ Google Form', 'error'); return; }

  const targetGrades = ['p5', 'p6', 'm4'].filter(g => document.getElementById('tg-' + g)?.checked);
  if (!targetGrades.length) { showToast('กรุณาเลือกชั้นที่มอบหมายงาน', 'error'); return; }

  const desc = document.getElementById('task-desc').value.trim();
  const dueDate = document.getElementById('task-due').value;
  const editId = document.getElementById('edit-task-id').value;

  const tasks = getTasks();
  if (editId) {
    // แก้ไขงานที่มีอยู่
    const idx = tasks.findIndex(t => String(t.id) === String(editId));
    if (idx !== -1) {
      tasks[idx] = { ...tasks[idx], title, desc, type, formUrl, dueDate, targetGrades, attachments: taskAttachments };
    }
    saveTasks(tasks);
    showToast('✅ แก้ไขงานสำเร็จ');
  } else {
    // สร้างงานใหม่
    const newTask = {
      id: Date.now(),
      title, desc, type, formUrl, dueDate,
      targetGrades,
      attachments: taskAttachments,
      postedAt: Date.now()
    };
    tasks.unshift(newTask);
    saveTasks(tasks);
    showToast('✅ สร้างงานสำเร็จ');
  }

  closeTaskModal();
  renderTasksAdmin();
}

function editTask(id) {
  const task = getTasks().find(t => String(t.id) === String(id));
  if (!task) return;
  document.getElementById('edit-task-id').value = task.id;
  document.getElementById('task-modal-title').textContent = '✏ แก้ไขงาน';
  document.getElementById('task-title').value = task.title || '';
  document.getElementById('task-desc').value = task.desc || '';
  document.getElementById('task-type').value = task.type || 'form';
  document.getElementById('task-form-url').value = task.formUrl || '';
  document.getElementById('task-due').value = task.dueDate || '';
  ['p5','p6','m4'].forEach(g => {
    const cb = document.getElementById('tg-' + g);
    if (cb) cb.checked = (task.targetGrades || []).includes(g);
  });
  taskAttachments = [...(task.attachments || [])];
  renderAttachList();
  toggleFormUrl();
  document.getElementById('new-task-modal').classList.add('open');
}

function deleteTask(id) {
  if (!confirm('ลบงานนี้ออก?')) return;
  saveTasks(getTasks().filter(t => String(t.id) !== String(id)));
  // ลบออกจาก Supabase ด้วย
  if (typeof fb_deleteTask === 'function') fb_deleteTask(id);
  renderTasksAdmin();
  showToast('ลบงานสำเร็จ', 'error');
}

function viewSubmissions(taskId) {
  const task = getTasks().find(t => String(t.id) === String(taskId));
  if (!task) return;
  document.getElementById('subs-modal-title').textContent = '📬 ' + task.title;

  // ---- state ----
  let vsGrade = 'all';
  let vsRoom = 'all';

  // ---- render helpers ----
  function vsRenderContent() {
    let subs = getSubmissions().filter(s => String(s.taskId) === String(taskId));
    if (vsGrade !== 'all') subs = subs.filter(s => s.grade === vsGrade);
    if (vsRoom !== 'all') subs = subs.filter(s => String(s.room) === String(vsRoom));
    const content = document.getElementById('subs-content');
    if (!subs.length) {
      content.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📭</div><div>ยังไม่มีการส่งงาน</div></div>';
      return;
    }
    const grouped = {};
    subs.forEach(s => { const k = s.grade+'_'+s.room; if(!grouped[k]) grouped[k]=[]; grouped[k].push(s); });
    content.innerHTML = Object.entries(grouped).map(([key, arr]) => {
      const [g, r] = key.split('_');
      const lbl = GRADES[g]?.label + '/' + r;
      const rows = arr.map(sub => {
        const time = new Date(sub.submittedAt).toLocaleString('th-TH',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
        const imgs = sub.images?.length ? `<div class="sub-grid" style="margin-top:0.5rem">${sub.images.map(img=>`<div class="sub-img-card" onclick="document.getElementById('admin-lightbox').classList.add('open');document.getElementById('admin-lb-img').src='${img.dataUrl}'"><img src="${img.dataUrl}" alt=""/><div class="sub-img-info"><div class="sub-img-name">${img.name}</div></div></div>`).join('')}</div>` : '';
        return `<div class="submission-item"><div class="sub-info"><div class="sub-name">👤 ${sub.studentNo ? `เลขที่ ${sub.studentNo} ` : ''}${sub.studentName}</div><div class="sub-time">⏰ ${time} · ${sub.type==='form'?'📋 Form':'🖼 รูปภาพ'}</div>${imgs}</div></div>`;
      }).join('');
      return `<div style="margin-bottom:1.2rem"><div style="font-size:0.85rem;font-weight:700;color:var(--text-secondary);margin-bottom:0.5rem">${lbl} — ${arr.length} คน</div>${rows}</div>`;
    }).join('');
  }

  function vsRenderRoomTabs() {
    const roomEl = document.getElementById('subs-room-tabs');
    if (!roomEl) return;
    if (vsGrade === 'all') { roomEl.style.display = 'none'; vsRoom = 'all'; return; }
    vsRoom = 'all';
    roomEl.style.display = 'flex';
    const rooms = getRooms(vsGrade);
    roomEl.innerHTML =
      `<button class="room-sub-tab active" onclick="window.__vsRoom('all',this)">ทุกห้อง</button>` +
      rooms.map(r => `<button class="room-sub-tab" onclick="window.__vsRoom(${r},this)">ห้อง ${r}</button>`).join('');
  }

  // ---- global callbacks (survive inline onclick) ----
  window.__vsGrade = (grade, el) => {
    vsGrade = grade;
    document.querySelectorAll('#subs-grade-tabs .class-tab').forEach(t => t.classList.remove('active'));
    if (el) el.classList.add('active');
    vsRenderRoomTabs();
    vsRenderContent();
  };
  window.__vsRoom = (room, el) => {
    vsRoom = String(room);
    document.querySelectorAll('#subs-room-tabs .room-sub-tab').forEach(t => t.classList.remove('active'));
    if (el) el.classList.add('active');
    vsRenderContent();
  };

  // ---- build grade tabs ----
  const tabsEl = document.getElementById('subs-grade-tabs');
  tabsEl.innerHTML = ['all', ...Object.keys(GRADES).filter(g => (task.targetGrades||[]).includes(g))].map((f, i) =>
    `<button class="class-tab ${i===0?'active':''}" onclick="window.__vsGrade('${f}',this)">${f==='all'?'ทั้งหมด':GRADES[f]?.icon+' '+GRADES[f]?.label}</button>`
  ).join('');

  // ---- ensure room-tabs container exists ----
  let roomEl = document.getElementById('subs-room-tabs');
  if (!roomEl) {
    roomEl = document.createElement('div');
    roomEl.id = 'subs-room-tabs';
    roomEl.className = 'room-sub-tab-wrap';
    tabsEl.insertAdjacentElement('afterend', roomEl);
  }
  roomEl.style.display = 'none';
  roomEl.innerHTML = '';

  vsRenderContent();
  document.getElementById('view-subs-modal').classList.add('open');
}
