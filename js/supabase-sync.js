// =============================================
// SUPABASE SYNC LAYER
// ใช้ localStorage เป็นหลัก + sync Supabase ข้ามอุปกรณ์
// ฟังก์ชันใช้ชื่อ fb_ เพื่อให้ admin.js / classroom.js เรียกได้ทันที
// =============================================

let _sb       = null;
let _sbReady  = false;

function initSupabase() {
  if (!SUPABASE_ENABLED) return;
  try {
    _sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    _sbReady = true;
    console.log('[Supabase] ✅ เชื่อมต่อสำเร็จ');
  } catch(e) {
    console.warn('[Supabase] ❌ เชื่อมต่อไม่ได้:', e.message);
  }
}

// ---- TASKS ----
async function fb_saveTasks(tasks) {
  if (!_sbReady) return;
  try {
    const rows = tasks.map(t => ({
      id:            t.id,
      title:         t.title        || '',
      type:          t.type         || 'link',
      form_url:      t.formUrl      || '',
      due_date:      t.dueDate      || '',
      target_grades: t.targetGrades || [],
      posted_at:     t.postedAt     || 0,
      description:   t.description  || ''
    }));
    const { error } = await _sb.from('tasks').upsert(rows, { onConflict: 'id' });
    if (error) throw error;
  } catch(e) { console.warn('[Supabase] saveTasks:', e.message); }
}

async function fb_fetchTasks() {
  if (!_sbReady) return null;
  try {
    const { data, error } = await _sb.from('tasks').select('*').order('posted_at', { ascending: false });
    if (error) throw error;
    return data.map(t => ({
      id:           t.id,
      title:        t.title,
      type:         t.type,
      formUrl:      t.form_url,
      dueDate:      t.due_date,
      targetGrades: t.target_grades,
      postedAt:     t.posted_at,
      description:  t.description
    }));
  } catch(e) { console.warn('[Supabase] fetchTasks:', e.message); return null; }
}

// ---- STUDENTS ----
async function fb_saveStudents(grade, room, arr) {
  if (!_sbReady) return;
  try {
    // ลบรายชื่อเดิมของห้องนั้นก่อน แล้ว insert ใหม่ทั้งหมด
    await _sb.from('students').delete().eq('grade', grade).eq('room', room);
    if (arr.length > 0) {
      const rows = arr.map(s => ({
        id:    `${grade}_${room}_${s.no}`,
        grade, room,
        no:    s.no   || '',
        name:  s.name || ''
      }));
      const { error } = await _sb.from('students').insert(rows);
      if (error) throw error;
    }
  } catch(e) { console.warn('[Supabase] saveStudents:', e.message); }
}

async function fb_fetchStudents(grade, room) {
  if (!_sbReady) return null;
  try {
    const { data, error } = await _sb.from('students').select('no, name')
      .eq('grade', grade).eq('room', room).order('no');
    if (error) throw error;
    return data;
  } catch(e) { console.warn('[Supabase] fetchStudents:', e.message); return null; }
}

// ---- ATTENDANCE ----
async function fb_saveAttendance(grade, room, date, data) {
  if (!_sbReady) return;
  try {
    const { error } = await _sb.from('attendance').upsert(
      { id: `${grade}_${room}_${date}`, grade, room, date, data },
      { onConflict: 'id' }
    );
    if (error) throw error;
  } catch(e) { console.warn('[Supabase] saveAttendance:', e.message); }
}

async function fb_fetchAttendance(grade, room, date) {
  if (!_sbReady) return null;
  try {
    const { data, error } = await _sb.from('attendance').select('data')
      .eq('id', `${grade}_${room}_${date}`).maybeSingle();
    if (error) throw error;
    return data?.data || {};
  } catch(e) { return null; }
}

// ---- SUBMISSIONS ----
async function fb_saveSubmission(sub) {
  if (!_sbReady) return;
  try {
    const { error } = await _sb.from('submissions').upsert({
      id:           String(sub.id),
      task_id:      sub.taskId      || '',
      student_name: sub.studentName || '',
      student_no:   sub.studentNo   || '',
      grade:        sub.grade       || '',
      room:         sub.room        || 0,
      submitted_at: sub.submittedAt || 0,
      type:         sub.type        || '',
      images:       sub.images      || []   // เก็บ base64 ใน JSONB
    }, { onConflict: 'id' });
    if (error) throw error;
    console.log('[Supabase] ✅ บันทึกการส่งงานสำเร็จ');
  } catch(e) { console.warn('[Supabase] saveSubmission:', e.message); }
}

async function fb_fetchSubmissions() {
  if (!_sbReady) return null;
  try {
    const { data, error } = await _sb.from('submissions').select('*')
      .order('submitted_at', { ascending: false });
    if (error) throw error;
    return data.map(s => ({
      id:          s.id,
      taskId:      s.task_id,
      studentName: s.student_name,
      studentNo:   s.student_no,
      grade:       s.grade,
      room:        s.room,
      submittedAt: s.submitted_at,
      type:        s.type,
      images:      s.images || []
    }));
  } catch(e) { console.warn('[Supabase] fetchSubmissions:', e.message); return null; }
}

// ---- PULL ON LOAD (sync Supabase → localStorage) ----
async function fb_pullAll() {
  if (!_sbReady) return;
  try {
    const tasks = await fb_fetchTasks();
    if (tasks) {
      const local  = JSON.parse(localStorage.getItem('tasks') || '[]');
      const merged = mergeById(local, tasks);
      localStorage.setItem('tasks', JSON.stringify(merged));
      console.log('[Supabase] ✅ sync tasks:', merged.length, 'รายการ');
    }
    const subs = await fb_fetchSubmissions();
    if (subs && subs.length > 0) {
      const local  = JSON.parse(localStorage.getItem('submissions') || '[]');
      const merged = mergeById(local, subs);
      localStorage.setItem('submissions', JSON.stringify(merged));
      console.log('[Supabase] ✅ sync submissions:', merged.length, 'รายการ');
    }
  } catch(e) { console.warn('[Supabase] pullAll:', e.message); }
}

function mergeById(localArr, remoteArr) {
  const map = {};
  localArr.forEach(x  => { if (x.id) map[x.id] = x; });
  remoteArr.forEach(x => { if (x.id) map[x.id] = { ...(map[x.id] || {}), ...x }; });
  return Object.values(map);
}

// ---- AUTH (admin only) ----
async function sb_adminSignIn(email, password) {
  if (!_sbReady) return false;
  try {
    const { error } = await _sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    console.log('[Supabase] ✅ Admin เข้าสู่ระบบสำเร็จ');
    return true;
  } catch(e) {
    console.warn('[Supabase] Auth ล้มเหลว:', e.message);
    return false;
  }
}

async function sb_adminSignOut() {
  if (!_sbReady) return;
  try {
    await _sb.auth.signOut();
  } catch(e) { console.warn('[Supabase] signOut:', e.message); }
}

// ---- INIT ----
document.addEventListener('DOMContentLoaded', () => {
  initSupabase();
  fb_pullAll();
});
