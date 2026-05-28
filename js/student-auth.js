// ====================================================
// STUDENT AUTH — ระบบเข้าสู่ระบบสำหรับนักเรียน (มี PIN)
// ต้องโหลดหลัง firebase-config.js และก่อน classroom.js
// ====================================================

(function () {
  // ----- config -----
  const GRADE_CONFIG_AUTH = {
    p5: { label: 'ประถมศึกษาปีที่ 5', short: 'ป.5', icon: '🎒', rooms: 7 },
    p6: { label: 'ประถมศึกษาปีที่ 6', short: 'ป.6', icon: '📝', rooms: 7 },
    m4: { label: 'มัธยมศึกษาปีที่ 4',  short: 'ม.4', icon: '🎓', rooms: 5 }
  };

  // ----- storage helpers -----
  function getStudents(grade, room) {
    return JSON.parse(localStorage.getItem('students_' + grade + '_' + room) || '[]');
  }
  function saveStudents(grade, room, arr) {
    localStorage.setItem('students_' + grade + '_' + room, JSON.stringify(arr));
    if (typeof fb_saveStudents === 'function') fb_saveStudents(grade, room, arr);
  }
  function getSession() {
    try { return JSON.parse(sessionStorage.getItem('student_session') || 'null'); } catch { return null; }
  }
  function saveSession(data) { sessionStorage.setItem('student_session', JSON.stringify(data)); }
  function clearSession()    { sessionStorage.removeItem('student_session'); }

  // ----- inject CSS -----
  const style = document.createElement('style');
  style.textContent = `
    #auth-overlay {
      position: fixed; inset: 0; z-index: 9999;
      background: rgba(8,8,20,0.93);
      backdrop-filter: blur(14px);
      display: flex; align-items: center; justify-content: center;
      padding: 1rem;
      transition: opacity 0.35s ease;
    }
    #auth-overlay.hidden { opacity: 0; pointer-events: none; }

    .auth-box {
      background: linear-gradient(155deg, #1a1a2e 0%, #16213e 100%);
      border: 1px solid rgba(255,255,255,0.09);
      border-radius: 24px;
      padding: 2rem 2rem 1.8rem;
      width: 100%; max-width: 400px;
      box-shadow: 0 32px 80px rgba(0,0,0,0.7);
      animation: authSlideIn 0.4s cubic-bezier(.22,1,.36,1);
    }
    @keyframes authSlideIn {
      from { transform: translateY(28px) scale(0.96); opacity: 0; }
      to   { transform: translateY(0)    scale(1);    opacity: 1; }
    }

    .auth-logo { font-size: 2.8rem; text-align: center; margin-bottom: 0.4rem; }
    .auth-title { text-align: center; font-size: 1.28rem; font-weight: 800; color: #fff; margin-bottom: 0.2rem; }
    .auth-sub   { text-align: center; font-size: 0.82rem; color: rgba(255,255,255,0.4); margin-bottom: 1.5rem; }

    .auth-tabs {
      display: flex; gap: 0.4rem;
      background: rgba(255,255,255,0.06);
      border-radius: 12px; padding: 4px; margin-bottom: 1.4rem;
    }
    .auth-tab {
      flex: 1; padding: 0.52rem 0; border: none; border-radius: 9px;
      font-family: inherit; font-size: 0.87rem; font-weight: 700;
      cursor: pointer; transition: all 0.22s;
      background: transparent; color: rgba(255,255,255,0.4);
    }
    .auth-tab.active {
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: #fff; box-shadow: 0 4px 12px rgba(102,126,234,0.4);
    }

    .auth-label {
      font-size: 0.78rem; font-weight: 700; letter-spacing: 0.06em;
      text-transform: uppercase; color: rgba(255,255,255,0.5);
      margin-bottom: 0.38rem; display: block;
    }
    .auth-group { margin-bottom: 0.95rem; }

    .auth-select, .auth-input {
      width: 100%; padding: 0.72rem 1rem;
      background: rgba(255,255,255,0.07);
      border: 1.5px solid rgba(255,255,255,0.1);
      border-radius: 12px; color: #fff;
      font-family: inherit; font-size: 0.95rem;
      outline: none; transition: border-color 0.2s, background 0.2s;
      box-sizing: border-box; appearance: auto;
    }
    .auth-select:focus, .auth-input:focus {
      border-color: #667eea; background: rgba(102,126,234,0.1);
    }
    .auth-select option { background: #1a1a2e; color: #fff; }
    .auth-input::placeholder { color: rgba(255,255,255,0.28); }

    /* PIN dots */
    .pin-wrap {
      display: flex; gap: 0.7rem; justify-content: center;
      margin: 0.3rem 0 0.2rem;
    }
    .pin-dot {
      width: 52px; height: 60px; border-radius: 12px;
      background: rgba(255,255,255,0.07);
      border: 1.5px solid rgba(255,255,255,0.12);
      color: #fff; font-size: 1.5rem; font-weight: 800;
      text-align: center; line-height: 60px;
      letter-spacing: 0.15em; caret-color: transparent;
      font-family: inherit; outline: none;
      transition: border-color 0.2s, background 0.2s;
    }
    .pin-dot:focus { border-color: #667eea; background: rgba(102,126,234,0.12); }
    .pin-dot.filled { border-color: rgba(102,126,234,0.6); }

    /* pin hint */
    .pin-hint {
      font-size: 0.75rem; color: rgba(255,255,255,0.32);
      text-align: center; margin-top: 0.4rem;
    }

    .auth-btn {
      width: 100%; padding: 0.85rem;
      background: linear-gradient(135deg, #667eea, #764ba2);
      border: none; border-radius: 14px;
      color: #fff; font-family: inherit;
      font-size: 1rem; font-weight: 800;
      cursor: pointer; margin-top: 0.5rem;
      transition: transform 0.15s, box-shadow 0.15s;
      box-shadow: 0 6px 20px rgba(102,126,234,0.35);
    }
    .auth-btn:hover  { transform: translateY(-2px); box-shadow: 0 10px 28px rgba(102,126,234,0.5); }
    .auth-btn:active { transform: translateY(0); }

    .auth-err {
      background: rgba(255,80,80,0.12); border: 1px solid rgba(255,80,80,0.3);
      border-radius: 10px; padding: 0.58rem 0.9rem;
      color: #ff6b6b; font-size: 0.85rem; margin-bottom: 0.8rem;
      display: none; animation: errShake 0.35s ease;
    }
    .auth-err.show { display: block; }
    @keyframes errShake {
      0%,100% { transform: translateX(0); }
      25%      { transform: translateX(-6px); }
      75%      { transform: translateX(6px);  }
    }

    .auth-no-list {
      text-align: center; font-size: 0.8rem;
      color: rgba(255,255,255,0.32); margin-top: 0.8rem; line-height: 1.6;
    }

    /* ── badge ── */
    #student-badge {
      display: flex; align-items: center; gap: 0.6rem;
      background: rgba(102,126,234,0.14);
      border: 1px solid rgba(102,126,234,0.28);
      border-radius: 50px; padding: 0.42rem 1rem 0.42rem 0.55rem;
      margin: 0.6rem 1rem 0; flex-wrap: wrap;
    }
    .badge-avatar {
      width: 34px; height: 34px; border-radius: 50%;
      background: linear-gradient(135deg, #667eea, #764ba2);
      display: flex; align-items: center; justify-content: center;
      font-size: 1.1rem; flex-shrink: 0;
    }
    .badge-info { flex: 1; min-width: 0; }
    .badge-name { font-size: 0.9rem; font-weight: 700; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .badge-detail { font-size: 0.74rem; color: rgba(255,255,255,0.42); }
    .badge-logout {
      background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12);
      border-radius: 20px; padding: 0.28rem 0.7rem;
      color: rgba(255,255,255,0.55); font-size: 0.74rem; font-weight: 600;
      cursor: pointer; font-family: inherit; transition: all 0.2s;
    }
    .badge-logout:hover { background: rgba(255,80,80,0.2); color: #ff6b6b; border-color: rgba(255,80,80,0.3); }
  `;
  document.head.appendChild(style);

  // ====================================================
  // BUILD OVERLAY
  // ====================================================
  function buildOverlay() {
    // ลบอันเก่าก่อน (ถ้ามี)
    const old = document.getElementById('auth-overlay');
    if (old) old.remove();

    const cfg = GRADE_CONFIG_AUTH[GRADE];
    const roomOpts = Array.from({ length: cfg.rooms }, (_, i) =>
      `<option value="${i + 1}">ห้อง ${i + 1}</option>`
    ).join('');

    const el = document.createElement('div');
    el.id = 'auth-overlay';
    el.innerHTML = `
      <div class="auth-box">
        <div class="auth-logo">${cfg.icon}</div>
        <div class="auth-title">ยินดีต้อนรับ</div>
        <div class="auth-sub">${cfg.label} — เข้าสู่ระบบด้วย PIN ของคุณ</div>

        <div class="auth-tabs">
          <button class="auth-tab active" id="auth-tab-login" onclick="authSwitchTab('login')">🔑 เข้าสู่ระบบ</button>
          <button class="auth-tab" id="auth-tab-reg" onclick="authSwitchTab('reg')">✏️ ลงทะเบียน</button>
        </div>

        <div id="auth-err" class="auth-err"></div>

        <!-- ── LOGIN ── -->
        <div id="auth-panel-login">
          <div class="auth-group">
            <label class="auth-label">ห้องของฉัน</label>
            <select id="login-room" class="auth-select" onchange="authLoadStudents()">${roomOpts}</select>
          </div>
          <div class="auth-group">
            <label class="auth-label">ชื่อของฉัน</label>
            <select id="login-student" class="auth-select" onchange="authHideErr()">
              <option value="">— เลือกชื่อ —</option>
            </select>
          </div>
          <div class="auth-group">
            <label class="auth-label">🔒 PIN 4 หลัก</label>
            <div class="pin-wrap" id="login-pin-wrap">
              <input class="pin-dot" id="lpin0" type="password" inputmode="numeric" maxlength="1" pattern="[0-9]" oninput="pinMove('l',0)" onkeydown="pinBack('l',0,event)"/>
              <input class="pin-dot" id="lpin1" type="password" inputmode="numeric" maxlength="1" pattern="[0-9]" oninput="pinMove('l',1)" onkeydown="pinBack('l',1,event)"/>
              <input class="pin-dot" id="lpin2" type="password" inputmode="numeric" maxlength="1" pattern="[0-9]" oninput="pinMove('l',2)" onkeydown="pinBack('l',2,event)"/>
              <input class="pin-dot" id="lpin3" type="password" inputmode="numeric" maxlength="1" pattern="[0-9]" oninput="pinMove('l',3)" onkeydown="pinBack('l',3,event)" onkeypress="if(event.key==='Enter')authDoLogin()"/>
            </div>
            <div class="pin-hint">กรอก PIN 4 หลักที่ตั้งไว้ตอนลงทะเบียน</div>
          </div>
          <button class="auth-btn" onclick="authDoLogin()">🚀 เข้าสู่ระบบ</button>
          <div class="auth-no-list" id="auth-no-list-msg" style="display:none">
            ⚠️ ยังไม่มีรายชื่อในห้องนี้<br>กรุณากดลงทะเบียนหรือติดต่อครู
          </div>
        </div>

        <!-- ── REGISTER ── -->
        <div id="auth-panel-reg" style="display:none">
          <div class="auth-group">
            <label class="auth-label">ห้องของฉัน</label>
            <select id="reg-room" class="auth-select">${roomOpts}</select>
          </div>
          <div class="auth-group">
            <label class="auth-label">เลขที่</label>
            <input id="reg-no" type="number" min="1" max="50" class="auth-input" placeholder="เช่น 12"/>
          </div>
          <div class="auth-group">
            <label class="auth-label">ชื่อ-สกุล</label>
            <input id="reg-name" type="text" class="auth-input" placeholder="เช่น สมชาย ใจดี"/>
          </div>
          <div class="auth-group">
            <label class="auth-label">🔒 ตั้ง PIN 4 หลัก (จำไว้ใช้ครั้งต่อไป)</label>
            <div class="pin-wrap">
              <input class="pin-dot" id="rpin0" type="password" inputmode="numeric" maxlength="1" pattern="[0-9]" oninput="pinMove('r',0)" onkeydown="pinBack('r',0,event)"/>
              <input class="pin-dot" id="rpin1" type="password" inputmode="numeric" maxlength="1" pattern="[0-9]" oninput="pinMove('r',1)" onkeydown="pinBack('r',1,event)"/>
              <input class="pin-dot" id="rpin2" type="password" inputmode="numeric" maxlength="1" pattern="[0-9]" oninput="pinMove('r',2)" onkeydown="pinBack('r',2,event)"/>
              <input class="pin-dot" id="rpin3" type="password" inputmode="numeric" maxlength="1" pattern="[0-9]" oninput="pinMove('r',3)" onkeydown="pinBack('r',3,event)" onkeypress="if(event.key==='Enter')authDoRegister()"/>
            </div>
            <div class="pin-hint">ตัวเลข 4 หลักที่คุณจำได้ง่าย เช่น เลขวันเกิด</div>
          </div>
          <button class="auth-btn" onclick="authDoRegister()">✅ ลงทะเบียน</button>
        </div>
      </div>
    `;
    document.body.appendChild(el);
    authLoadStudents();
  }

  // ====================================================
  // PIN INPUT HELPERS
  // ====================================================
  window.pinMove = function(prefix, idx) {
    const id = prefix === 'l' ? 'lpin' : 'rpin';
    const el = document.getElementById(id + idx);
    // กรองเฉพาะตัวเลข
    el.value = el.value.replace(/\D/g, '').slice(-1);
    el.classList.toggle('filled', !!el.value);
    if (el.value && idx < 3) {
      document.getElementById(id + (idx + 1)).focus();
    }
    authHideErr();
  };

  window.pinBack = function(prefix, idx, e) {
    const id = prefix === 'l' ? 'lpin' : 'rpin';
    if (e.key === 'Backspace' && !document.getElementById(id + idx).value && idx > 0) {
      document.getElementById(id + (idx - 1)).focus();
    }
  };

  function getPin(prefix) {
    const id = prefix === 'l' ? 'lpin' : 'rpin';
    return [0,1,2,3].map(i => document.getElementById(id + i)?.value || '').join('');
  }
  function clearPin(prefix) {
    const id = prefix === 'l' ? 'lpin' : 'rpin';
    [0,1,2,3].forEach(i => {
      const el = document.getElementById(id + i);
      if (el) { el.value = ''; el.classList.remove('filled'); }
    });
  }

  // ====================================================
  // OVERLAY VISIBILITY
  // ====================================================
  function showOverlay() {
    const ov = document.getElementById('auth-overlay');
    if (ov) ov.classList.remove('hidden');
  }
  function hideOverlay() {
    const ov = document.getElementById('auth-overlay');
    if (ov) {
      ov.classList.add('hidden');
      setTimeout(() => ov.remove(), 400);
    }
  }

  // ====================================================
  // TAB SWITCH
  // ====================================================
  window.authSwitchTab = function(tab) {
    document.getElementById('auth-panel-login').style.display = tab === 'login' ? '' : 'none';
    document.getElementById('auth-panel-reg').style.display   = tab === 'reg'   ? '' : 'none';
    document.getElementById('auth-tab-login').classList.toggle('active', tab === 'login');
    document.getElementById('auth-tab-reg').classList.toggle('active', tab === 'reg');
    authHideErr();
  };

  // ====================================================
  // LOAD STUDENTS INTO DROPDOWN
  // ====================================================
  window.authLoadStudents = function() {
    const room = parseInt(document.getElementById('login-room')?.value || '1');
    const students = getStudents(GRADE, room);
    const sel   = document.getElementById('login-student');
    const noMsg = document.getElementById('auth-no-list-msg');
    if (!sel) return;
    if (!students.length) {
      sel.innerHTML = '<option value="">— ยังไม่มีรายชื่อ —</option>';
      if (noMsg) noMsg.style.display = '';
    } else {
      sel.innerHTML = '<option value="">— เลือกชื่อ —</option>' +
        students.map(s => `<option value="${s.no}|${s.name}">เลขที่ ${s.no}  ${s.name}</option>`).join('');
      if (noMsg) noMsg.style.display = 'none';
    }
    clearPin('l');
    authHideErr();
  };

  // ====================================================
  // ERROR
  // ====================================================
  function authShowErr(msg) {
    const el = document.getElementById('auth-err');
    if (!el) return;
    el.textContent = '⚠️ ' + msg;
    el.classList.remove('show');
    void el.offsetWidth; // reflow → restart animation
    el.classList.add('show');
  }
  window.authHideErr = function() {
    const el = document.getElementById('auth-err');
    if (el) el.classList.remove('show');
  };

  // ====================================================
  // LOGIN
  // ====================================================
  window.authDoLogin = function() {
    authHideErr();
    const room = parseInt(document.getElementById('login-room').value);
    const val  = document.getElementById('login-student').value;
    if (!val) { authShowErr('กรุณาเลือกชื่อของคุณ'); return; }

    const pin = getPin('l');
    if (pin.length < 4) { authShowErr('กรุณากรอก PIN 4 หลักให้ครบ'); return; }

    const [no, name] = val.split('|');
    const students   = getStudents(GRADE, room);
    const student    = students.find(s => String(s.no) === String(no));

    if (!student) { authShowErr('ไม่พบข้อมูลนักเรียน'); return; }

    // นักเรียนที่ยังไม่มี PIN (บัญชีเก่า) → ตั้ง PIN ณ ตอนนี้เลย
    if (!student.pin) {
      student.pin = pin;
      saveStudents(GRADE, room, students);
      applySession({ grade: GRADE, room, no, name });
      return;
    }

    if (student.pin !== pin) {
      clearPin('l');
      authShowErr('PIN ไม่ถูกต้อง กรุณาลองใหม่');
      document.getElementById('lpin0')?.focus();
      return;
    }

    applySession({ grade: GRADE, room, no, name });
  };

  // ====================================================
  // REGISTER
  // ====================================================
  window.authDoRegister = function() {
    authHideErr();
    const room = parseInt(document.getElementById('reg-room').value);
    const no   = document.getElementById('reg-no').value.trim();
    const name = document.getElementById('reg-name').value.trim();
    const pin  = getPin('r');

    if (!no)          { authShowErr('กรุณากรอกเลขที่'); return; }
    if (!name)        { authShowErr('กรุณากรอกชื่อ-สกุล'); return; }
    if (pin.length < 4) { authShowErr('กรุณาตั้ง PIN 4 หลักให้ครบ'); return; }

    const students = getStudents(GRADE, room);
    const dup = students.find(s => String(s.no) === String(no));

    if (dup) {
      // เลขที่มีแล้ว
      if (dup.name !== name) {
        authShowErr(`เลขที่ ${no} มีชื่อ "${dup.name}" อยู่แล้ว กรุณาตรวจสอบ`);
        return;
      }
      // ชื่อตรง → แต่มี PIN อยู่แล้ว → ไม่ให้ register ซ้ำ
      if (dup.pin) {
        authShowErr('บัญชีนี้มีอยู่แล้ว กรุณาไปเข้าสู่ระบบ');
        authSwitchTab('login');
        return;
      }
      // ยังไม่มี PIN → set ได้เลย
      dup.pin = pin;
      saveStudents(GRADE, room, students);
      applySession({ grade: GRADE, room, no, name });
      return;
    }

    // ใหม่ทั้งหมด
    students.push({ no, name, pin });
    students.sort((a, b) => Number(a.no) - Number(b.no));
    saveStudents(GRADE, room, students);
    applySession({ grade: GRADE, room, no, name });
  };

  // ====================================================
  // APPLY SESSION → เข้าใช้งานจริง
  // ====================================================
  function applySession(data) {
    saveSession(data);
    window.__studentSession = data;
    hideOverlay();
    buildStudentBadge(data);
    // sync ค่าใน classroom.js
    if (typeof syncFromSession === 'function') syncFromSession();
    if (typeof renderTasks    === 'function') renderTasks();
  }

  // ====================================================
  // STUDENT BADGE
  // ====================================================
  function buildStudentBadge(data) {
    const el = document.getElementById('cls-name-bar');
    if (!el) return;
    const cfg = GRADE_CONFIG_AUTH[GRADE];
    el.innerHTML = `
      <div id="student-badge">
        <div class="badge-avatar">${cfg.icon}</div>
        <div class="badge-info">
          <div class="badge-name">เลขที่ ${data.no}  ${data.name}</div>
          <div class="badge-detail">${cfg.short} ห้อง ${data.room}</div>
        </div>
        <button class="badge-logout" onclick="authLogout()">🚪 ออกจากระบบ</button>
      </div>
    `;
  }

  // ====================================================
  // LOGOUT
  // ====================================================
  window.authLogout = function() {
    if (!confirm('ออกจากระบบ?')) return;
    clearSession();
    window.__studentSession = null;
    if (typeof studentName !== 'undefined') { studentName = ''; studentNo = ''; }
    const el = document.getElementById('cls-name-bar');
    if (el) el.innerHTML = '';
    buildOverlay();
  };

  // ====================================================
  // INIT
  // ====================================================
  document.addEventListener('DOMContentLoaded', function() {
    const session = getSession();
    if (session && session.grade === GRADE) {
      window.__studentSession = session;
      setTimeout(() => buildStudentBadge(session), 0);
    } else {
      buildOverlay();
    }
  });
})();
