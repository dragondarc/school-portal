// =============================================
// FIREBASE SYNC LAYER
// ใช้ localStorage เป็นหลัก + sync Firebase เป็น backup
// =============================================

let _db = null;
let _storage = null;
let _fbReady = false;

function initFirebase() {
  if (!FIREBASE_ENABLED) return;
  try {
    if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
    _db = firebase.firestore();
    _storage = firebase.storage();
    _fbReady = true;
    console.log('[Firebase] ✅ เชื่อมต่อสำเร็จ');
  } catch (e) {
    console.warn('[Firebase] ❌ เชื่อมต่อไม่ได้:', e.message);
  }
}

// ---- TASKS ----
async function fb_saveTasks(tasks) {
  if (!_fbReady) return;
  try {
    const batch = _db.batch();
    // เซฟ index รายการ tasks (ไม่รวม attachments เพื่อประหยัด quota)
    const ref = _db.collection('meta').doc('tasks');
    const slim = tasks.map(t => ({
      id: t.id, title: t.title, type: t.type, formUrl: t.formUrl || '',
      dueDate: t.dueDate || '', targetGrades: t.targetGrades || [],
      postedAt: t.postedAt, description: t.description || ''
    }));
    batch.set(ref, { list: slim, updatedAt: Date.now() });
    await batch.commit();
  } catch (e) { console.warn('[FB] saveTasks error', e.message); }
}

async function fb_fetchTasks() {
  if (!_fbReady) return null;
  try {
    const snap = await _db.collection('meta').doc('tasks').get();
    if (snap.exists) return snap.data().list || [];
  } catch (e) { console.warn('[FB] fetchTasks error', e.message); }
  return null;
}

// ---- STUDENTS ----
async function fb_saveStudents(grade, room, arr) {
  if (!_fbReady) return;
  try {
    await _db.collection('students').doc(grade + '_' + room).set({ list: arr, updatedAt: Date.now() });
  } catch (e) { console.warn('[FB] saveStudents error', e.message); }
}

async function fb_fetchStudents(grade, room) {
  if (!_fbReady) return null;
  try {
    const snap = await _db.collection('students').doc(grade + '_' + room).get();
    if (snap.exists) return snap.data().list || [];
  } catch (e) { console.warn('[FB] fetchStudents error', e.message); }
  return null;
}

// ---- ATTENDANCE ----
async function fb_saveAttendance(grade, room, date, data) {
  if (!_fbReady) return;
  try {
    await _db.collection('attendance').doc(grade + '_' + room + '_' + date).set({ data, updatedAt: Date.now() });
  } catch (e) { console.warn('[FB] saveAttendance error', e.message); }
}

async function fb_fetchAttendance(grade, room, date) {
  if (!_fbReady) return null;
  try {
    const snap = await _db.collection('attendance').doc(grade + '_' + room + '_' + date).get();
    if (snap.exists) return snap.data().data || {};
  } catch (e) { console.warn('[FB] fetchAttendance error', e.message); }
  return null;
}

// ---- SUBMISSIONS ----
async function fb_saveSubmission(sub) {
  if (!_fbReady) return;
  try {
    // อัปโหลดรูปไป Firebase Storage ก่อน แล้วเก็บแค่ URL ใน Firestore
    let imageUrls = [];
    if (sub.images && sub.images.length > 0) {
      imageUrls = await Promise.all(sub.images.map(async (img) => {
        const ref = _storage.ref(`submissions/${sub.id}/${img.name}`);
        await ref.putString(img.dataUrl, 'data_url');
        const url = await ref.getDownloadURL();
        return { name: img.name, url };
      }));
    }
    const doc = {
      id: sub.id, taskId: sub.taskId,
      studentName: sub.studentName, studentNo: sub.studentNo || '',
      grade: sub.grade, room: sub.room,
      submittedAt: sub.submittedAt, type: sub.type,
      imageUrls, // URL จาก Storage แทน base64
      updatedAt: Date.now()
    };
    await _db.collection('submissions').doc(String(sub.id)).set(doc);
    console.log('[FB] ✅ บันทึกการส่งงานสำเร็จ');
  } catch (e) { console.warn('[FB] saveSubmission error', e.message); }
}

async function fb_fetchSubmissions() {
  if (!_fbReady) return null;
  try {
    const snap = await _db.collection('submissions').orderBy('submittedAt', 'desc').get();
    return snap.docs.map(d => d.data());
  } catch (e) { console.warn('[FB] fetchSubmissions error', e.message); }
  return null;
}

// ---- PULL ON LOAD (ดึงข้อมูลจาก Firebase มาอัปเดต localStorage) ----
async function fb_pullAll() {
  if (!_fbReady) return;
  try {
    // Tasks
    const tasks = await fb_fetchTasks();
    if (tasks) {
      const local = JSON.parse(localStorage.getItem('tasks') || '[]');
      // merge: Firebase ชนะถ้า postedAt ใหม่กว่า
      const merged = mergeById(local, tasks);
      localStorage.setItem('tasks', JSON.stringify(merged));
      console.log('[FB] ✅ sync tasks:', merged.length, 'รายการ');
    }

    // Submissions
    const subs = await fb_fetchSubmissions();
    if (subs && subs.length > 0) {
      const local = JSON.parse(localStorage.getItem('submissions') || '[]');
      const merged = mergeById(local, subs);
      localStorage.setItem('submissions', JSON.stringify(merged));
      console.log('[FB] ✅ sync submissions:', merged.length, 'รายการ');
    }
  } catch (e) { console.warn('[FB] pullAll error', e.message); }
}

function mergeById(localArr, remoteArr) {
  const map = {};
  localArr.forEach(x => { if (x.id) map[x.id] = x; });
  remoteArr.forEach(x => { if (x.id) map[x.id] = { ...(map[x.id] || {}), ...x }; });
  return Object.values(map);
}

// ---- AUTH (admin only) ----
async function fb_adminSignIn(email, password) {
  if (!_fbReady) return false;
  try {
    // จำกัด session ให้อยู่แค่ browser tab นี้เท่านั้น (ปิดแล้วหมด)
    await firebase.auth().setPersistence(firebase.auth.Auth.Persistence.SESSION);
    await firebase.auth().signInWithEmailAndPassword(email, password);
    console.log('[FB] ✅ Admin เข้าสู่ระบบ Firebase Auth สำเร็จ');
    return true;
  } catch (e) {
    console.warn('[FB] Firebase Auth ล้มเหลว:', e.message);
    return false;
  }
}

async function fb_adminSignOut() {
  if (!_fbReady) return;
  try {
    await firebase.auth().signOut();
    console.log('[FB] Admin ออกจากระบบ Firebase Auth แล้ว');
  } catch (e) { console.warn('[FB] signOut error', e.message); }
}

// ---- INIT ----
document.addEventListener('DOMContentLoaded', () => {
  initFirebase();
  fb_pullAll(); // ดึงข้อมูลจาก Firebase มา sync กับ localStorage
});
