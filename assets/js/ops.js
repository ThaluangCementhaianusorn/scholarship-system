// การแก้ไขฐานข้อมูล + ตรวจสิทธิ์ตามบทบาท
// ไฟล์นี้ถูกใช้ทั้งในเบราว์เซอร์ (ผู้ดูแลที่ใช้ GitHub Token) และใน Relay (Google Apps Script)
// เพื่อให้กฎสิทธิ์ถูกบังคับใช้ฝั่งเซิร์ฟเวอร์เสมอ
import { STATUS, STAGES, ROLES, DIVISIONS, DEFAULT_CATEGORIES, isOpen } from './model.js';

const COLLECTIONS = {
  announcements: { roles: ['guidance'], prefix: 'ann' },
  scholarships: { roles: ['guidance'], prefix: 'sch' },
  sponsors: { roles: ['guidance'], prefix: 'sp' },
  recipients: { roles: ['guidance'], prefix: 'rec' },
  categories: { roles: ['guidance'], prefix: 'cat' },
  departments: { roles: [], prefix: 'd' },
  academicYears: { roles: [], prefix: 'y' },
};
const STAFF = ['admin', 'director', 'deputy', 'depthead', 'guidance'];

export function can(user, perm, extra) {
  if (!user || user.active === false) return false;
  const r = user.role;
  if (r === 'admin') return true;
  switch (perm) {
    case 'staff': return STAFF.includes(r);
    case 'viewApps': return ['director', 'deputy', 'guidance', 'depthead'].includes(r);
    case 'viewAllApps': return ['director', 'deputy', 'guidance'].includes(r);
    case 'docCheck': case 'setStatus': case 'post': case 'manage': return r === 'guidance';
    case 'reports': return STAFF.includes(r);
    case 'stage': {
      const st = STAGES.find((s) => s.key === (extra && extra.stage));
      if (!st || !st.roles.includes(r)) return false;
      if (r === 'depthead') return extra.app && extra.app.student && extra.app.student.departmentId === user.departmentId;
      return true;
    }
    case 'admin': return false;
    default: return !!(COLLECTIONS[perm] && COLLECTIONS[perm].roles.includes(r));
  }
}
export function appVisible(user, app) {
  if (!user) return false;
  if (user.role === 'admin' || can(user, 'viewAllApps')) return true;
  if (user.role === 'depthead') return app.student && app.student.departmentId === user.departmentId;
  if (user.role === 'student') return app.student && app.student.studentId === user.username;
  return false;
}

function deny(msg) { throw new Error(msg || 'คุณไม่มีสิทธิ์ดำเนินการนี้'); }
function str(v, max) { return String(v == null ? '' : v).trim().slice(0, max || 500); }
function num(v) { return v === '' || v == null || isNaN(Number(v)) ? '' : Number(v); }
function signer(user, ctx) { return { by: user ? user.id : '', name: user ? user.name : 'ผู้สมัคร', position: user ? (user.position || (ROLES[user.role] || {}).label || '') : '', at: ctx.now }; }

export function ensureShape(db) {
  for (const k of ['departments', 'sponsors', 'scholarships', 'announcements', 'recipients', 'applications', 'users', 'academicYears']) db[k] = db[k] || [];
  if (!db.categories || !db.categories.length) db.categories = DEFAULT_CATEGORIES.map((c) => Object.assign({}, c));
  db.officials = db.officials || {};
  db.loginKeys = db.loginKeys || [];
  db.institution = db.institution || {};
  db.settings = db.settings || {};
  db.meta = db.meta || {};
  if (!db.academicYears.length && db.institution.academicYear) db.academicYears.push({ id: 'y_' + db.institution.academicYear, year: String(db.institution.academicYear), status: 'active' });
  return db;
}

// กุญแจเข้าสู่ระบบด้วยรหัสผ่าน (เฉพาะผู้ดูแลระบบ / งานครูที่ปรึกษาและการแนะแนว)
const KEY_ROLES_ = ['admin', 'guidance'];
function setLoginKey(db, u, key, ctx) {
  db.loginKeys = (db.loginKeys || []).filter((k) => k.userId !== u.id);
  if (!key || !KEY_ROLES_.includes(u.role) || u.active === false) return;
  if (!key.salt || !key.iv || !key.data) deny('กุญแจเข้าสู่ระบบไม่ถูกต้อง');
  db.loginKeys.push({ userId: u.id, username: u.username, name: u.name, role: u.role, salt: str(key.salt, 64), iv: str(key.iv, 64), data: str(key.data, 4000), iter: Number(key.iter) || 600000, updatedAt: ctx.now });
}
function syncLoginKey(db, u) {
  const k = (db.loginKeys || []).find((x) => x.userId === u.id);
  if (!k) return;
  if (!KEY_ROLES_.includes(u.role) || u.active === false) db.loginKeys = db.loginKeys.filter((x) => x.userId !== u.id);
  else Object.assign(k, { username: u.username, name: u.name, role: u.role });
}

function syncRecipient(db, app) {
  db.recipients = db.recipients.filter((r) => r.appId !== app.id);
  if (app.status !== 'approved') return;
  const s = db.scholarships.find((x) => x.id === app.scholarshipId) || {};
  const st = app.student || {};
  db.recipients.push({
    id: 'rec_' + app.id, appId: app.id, studentId: st.studentId, name: ((st.prefix || '') + (st.firstName || '') + ' ' + (st.lastName || '')).trim(),
    level: st.level, classYear: st.classYear, departmentId: st.departmentId, scholarshipId: s.id, scholarshipTitle: s.title,
    sponsorId: s.sponsorId, categoryId: s.categoryId || '', type: s.type, amount: Number(s.amount) || 0, year: String(s.year || app.year),
  });
}
function setStatus(db, app, status, note, user, ctx) {
  if (!STATUS[status]) deny('สถานะไม่ถูกต้อง');
  app.status = status;
  app.history = app.history || [];
  app.history.push({ at: ctx.now, status, by: user ? user.name : 'ระบบ', note: note || '' });
  syncRecipient(db, app);
}
function findApp(db, id) { const a = db.applications.find((x) => x.id === id); if (!a) deny('ไม่พบใบสมัคร'); return a; }

function cleanStudent(s0) {
  s0 = s0 || {};
  return {
    prefix: str(s0.prefix, 20), firstName: str(s0.firstName, 80), lastName: str(s0.lastName, 80), studentId: str(s0.studentId, 15),
    level: str(s0.level, 10), classYear: str(s0.classYear, 2), departmentId: str(s0.departmentId, 40), gpa: num(s0.gpa),
    birthDate: str(s0.birthDate, 10), phone: str(s0.phone, 20), email: str(s0.email, 120), address: str(s0.address, 400),
    parentName: str(s0.parentName, 120), parentRelation: str(s0.parentRelation, 40), parentJob: str(s0.parentJob, 80),
    parentPhone: str(s0.parentPhone, 20), income: num(s0.income), siblings: num(s0.siblings),
  };
}

/**
 * applyOp(db, user, op, ctx) — แก้ไข db ตามคำสั่ง (ต้องเป็นฟังก์ชันที่ไม่มี side effect ภายนอก เพื่อ retry ได้)
 * ctx = { now: ISO string, id: (prefix) => string, code: (year) => string }
 */
export function applyOp(db, user, op, ctx) {
  ensureShape(db);
  const p = op.payload || {};
  switch (op.type) {
    // ---------- ข้อมูลทั่วไป ----------
    case 'save': {
      const c = COLLECTIONS[p.collection];
      if (!c) deny('ไม่รู้จักข้อมูล');
      if (!can(user, p.collection)) deny();
      const list = db[p.collection];
      const item = Object.assign({}, p.item);
      if (p.collection === 'announcements') item.author = item.author || (user ? user.name : '');
      if (p.collection === 'academicYears') item.year = str(item.year, 4);
      const i = item.id ? list.findIndex((x) => x.id === item.id) : -1;
      if (i >= 0) list[i] = Object.assign({}, list[i], item, { updatedAt: ctx.now });
      else { item.id = item.id || ctx.id(c.prefix); item.createdAt = ctx.now; list.push(item); }
      if (p.collection === 'academicYears' && item.status === 'active') {
        list.forEach((y) => { if (y.id !== item.id && y.status === 'active') y.status = 'archived'; });
        db.institution.academicYear = item.year;
      }
      if (p.collection === 'scholarships') db.recipients.forEach((r) => { if (r.scholarshipId === item.id) r.categoryId = item.categoryId || ''; });
      return item;
    }
    case 'delete': {
      if (!COLLECTIONS[p.collection]) deny('ไม่รู้จักข้อมูล');
      if (!can(user, p.collection)) deny();
      const id = p.id;
      if (p.collection === 'scholarships' && db.applications.some((a) => a.scholarshipId === id)) deny('มีใบสมัครของทุนนี้อยู่ — ให้เปลี่ยนสถานะเป็นปิดรับสมัครแทนการลบ');
      if (p.collection === 'sponsors' && (db.scholarships.some((s) => s.sponsorId === id) || db.recipients.some((s) => s.sponsorId === id))) deny('หน่วยงานนี้มีทุนหรือผู้รับทุนเชื่อมอยู่');
      if (p.collection === 'departments' && (db.recipients.some((r) => r.departmentId === id) || db.applications.some((a) => a.student && a.student.departmentId === id))) deny('แผนกนี้มีข้อมูลเชื่อมอยู่');
      if (p.collection === 'categories' && db.scholarships.some((s) => s.categoryId === id)) deny('ประเภททุนนี้ถูกใช้งานอยู่');
      db[p.collection] = db[p.collection].filter((x) => x.id !== id);
      return true;
    }
    case 'settings': {
      if (!can(user, 'admin')) deny();
      if (p.institution) db.institution = Object.assign({}, db.institution, p.institution);
      if (p.settings) db.settings = Object.assign({}, db.settings, p.settings);
      return true;
    }
    case 'officials': {
      if (!can(user, 'admin')) deny();
      db.officials[str(p.year, 4)] = { director: str(p.data.director, 60), guidance: str(p.data.guidance, 60), deputies: p.data.deputies || {}, deptHeads: p.data.deptHeads || {} };
      return true;
    }
    case 'clearSample': {
      if (!can(user, 'admin')) deny();
      for (const k of ['applications', 'recipients', 'scholarships', 'announcements', 'sponsors', 'users']) db[k] = db[k].filter((x) => !x.sample);
      db.meta.sample = false;
      return true;
    }

    // ---------- ผู้ใช้งาน ----------
    case 'saveUser': {
      if (!can(user, 'admin')) deny();
      const u = p.user || {};
      if (!ROLES[u.role]) deny('บทบาทไม่ถูกต้อง');
      const username = str(u.username, 40).toLowerCase();
      if (!/^[a-z0-9._-]{3,40}$/.test(username)) deny('ชื่อผู้ใช้ต้องเป็น a-z, 0-9, . _ - ความยาว 3–40 ตัว');
      if (db.users.some((x) => x.username === username && x.id !== u.id)) deny('ชื่อผู้ใช้นี้มีอยู่แล้ว');
      const fields = { username, name: str(u.name, 120), role: u.role, position: str(u.position, 160), division: u.role === 'deputy' ? str(u.division, 80) : '', departmentId: ['depthead', 'student'].includes(u.role) ? str(u.departmentId, 40) : '', duties: str(u.duties, 1000), phone: str(u.phone, 20), email: str(u.email, 120), active: u.active !== false, level: u.role === 'student' ? str(u.level, 10) : '', classYear: u.role === 'student' ? str(u.classYear, 2) : '' };
      let target = u.id && db.users.find((x) => x.id === u.id);
      if (target) Object.assign(target, fields, { updatedAt: ctx.now });
      else {
        if (!p.passwordHash) deny('กรุณากำหนดรหัสผ่าน');
        const id = /^u_[a-z0-9]{4,30}$/.test(u.id || '') ? u.id : ctx.id('u');
        target = Object.assign({ id, createdAt: ctx.now }, fields); db.users.push(target);
      }
      if (p.passwordHash) { target.passwordHash = p.passwordHash; target.salt = p.salt; }
      if (p.signature !== undefined) target.signature = p.signature;
      if (p.loginKey !== undefined) setLoginKey(db, target, p.loginKey, ctx);
      syncLoginKey(db, target);
      return { id: target.id };
    }
    case 'deleteUser': {
      if (!can(user, 'admin')) deny();
      if (user && user.id === p.id) deny('ไม่สามารถลบบัญชีของตนเองได้');
      db.users = db.users.filter((x) => x.id !== p.id);
      db.loginKeys = db.loginKeys.filter((k) => k.userId !== p.id);
      return true;
    }
    case 'importStudents': {
      if (!can(user, 'admin')) deny();
      let added = 0; let updated = 0;
      for (const r of p.rows || []) {
        const username = str(r.username, 15);
        if (!/^\d{5,15}$/.test(username)) continue;
        const ex = db.users.find((x) => x.username === username);
        const fields = { username, name: str(r.name, 120), role: 'student', level: str(r.level, 10), classYear: str(r.classYear, 2), departmentId: str(r.departmentId, 40), position: 'นักเรียน นักศึกษา', active: true };
        if (ex) { if (ex.role !== 'student') continue; Object.assign(ex, fields); updated++; }
        else { db.users.push(Object.assign({ id: ctx.id('u'), createdAt: ctx.now, passwordHash: r.passwordHash, salt: r.salt }, fields)); added++; }
      }
      return { added, updated };
    }
    case 'myProfile': {
      if (!user) deny();
      const me = db.users.find((x) => x.id === user.id); if (!me) deny('ไม่พบบัญชี');
      if (p.phone !== undefined) me.phone = str(p.phone, 20);
      if (p.email !== undefined) me.email = str(p.email, 120);
      if (p.signature !== undefined) {
        if (p.signature && (!/^data:image\/png;base64,/.test(p.signature) || p.signature.length > 300000)) deny('ไฟล์ลายเซ็นไม่ถูกต้อง');
        me.signature = p.signature; me.signatureAt = ctx.now;
      }
      if (p.passwordHash) { me.passwordHash = p.passwordHash; me.salt = p.salt; }
      if (p.loginKey !== undefined) setLoginKey(db, me, p.loginKey, ctx);
      return true;
    }

    // ---------- ใบสมัคร ----------
    case 'submitApplication': {
      const a = p.application || {};
      const st = cleanStudent(a.student);
      if (!st.firstName || !st.lastName || !/^\d{5,15}$/.test(st.studentId)) deny('ข้อมูลผู้สมัครไม่ครบถ้วน');
      const sch = db.scholarships.find((x) => x.id === a.scholarshipId);
      if (!sch) deny('ไม่พบทุนการศึกษา');
      const staff = can(user, 'docCheck');
      if (!staff && !isOpen(sch)) deny('ทุนนี้ไม่อยู่ในช่วงเปิดรับสมัคร');
      if (user && user.role === 'student' && user.username !== st.studentId) deny('รหัสนักศึกษาไม่ตรงกับบัญชีผู้ใช้');
      if (db.applications.some((x) => x.scholarshipId === sch.id && x.student && x.student.studentId === st.studentId && x.status !== 'rejected')) deny('รหัสนักศึกษานี้ได้ยื่นสมัครทุนนี้แล้ว');
      const app = {
        id: p.id || ctx.id('app'), code: p.code || ctx.code(sch.year), scholarshipId: sch.id, year: String(sch.year), status: 'submitted', submittedAt: ctx.now,
        student: st, reason: str(a.reason, 3000), achievements: str(a.achievements, 2000), files: (p.files || []).slice(0, 12), review: { docs: {} },
        history: [{ at: ctx.now, status: 'submitted', by: staff ? user.name : 'นักศึกษา', note: staff ? 'บันทึกโดยเจ้าหน้าที่' : 'ยื่นใบสมัครออนไลน์' }],
      };
      db.applications.push(app);
      return app;
    }
    case 'addFiles': {
      const app = p.appId ? findApp(db, p.appId) : db.applications.find((x) => x.code === str(p.code, 20).toUpperCase() && x.student && x.student.studentId === str(p.studentId, 15));
      if (!app) deny('ไม่พบใบสมัคร');
      const codeOk = app.code === str(p.code, 20).toUpperCase() && app.student && app.student.studentId === str(p.studentId, 15);
      const allowed = user ? (can(user, 'docCheck') || (user.role === 'student' && appVisible(user, app)) || codeOk) : codeOk;
      if (!allowed) deny();
      if (['approved', 'rejected'].includes(app.status) && !can(user, 'docCheck')) deny('ใบสมัครนี้พิจารณาเสร็จสิ้นแล้ว');
      app.files = (app.files || []).concat((p.files || []).slice(0, 8).map((f) => Object.assign({}, f, { addedAt: ctx.now })));
      app.history.push({ at: ctx.now, status: app.status, by: user ? user.name : 'นักศึกษา', note: 'แนบเอกสารเพิ่มเติม ' + (p.files || []).length + ' ไฟล์' });
      if (app.status === 'needs_docs') { app.status = 'submitted'; }
      return app;
    }
    case 'docCheck': {
      const app = findApp(db, p.appId);
      if (!can(user, 'docCheck') || !appVisible(user, app)) deny();
      app.review = app.review || { docs: {} };
      app.review.docs = p.docs || {};
      app.review.docCheck = Object.assign({ result: p.result === 'complete' ? 'complete' : 'incomplete', note: str(p.note, 1000) }, signer(user, ctx));
      if (p.result === 'complete') { if (['submitted', 'needs_docs'].includes(app.status)) setStatus(db, app, 'reviewing', 'ตรวจสอบเอกสารครบถ้วน' + (p.note ? ' — ' + str(p.note) : ''), user, ctx); }
      else setStatus(db, app, 'needs_docs', str(p.note, 1000) || 'เอกสารไม่ครบถ้วน กรุณาแนบเอกสารเพิ่มเติม', user, ctx);
      return app;
    }
    case 'stage': {
      const app = findApp(db, p.appId);
      const st = STAGES.find((s) => s.key === p.stage);
      if (!st) deny('ขั้นตอนไม่ถูกต้อง');
      if (!can(user, 'stage', { stage: p.stage, app })) deny('ขั้นตอนนี้สำหรับ' + st.roles.map((r) => ROLES[r].label).join('/') + 'เท่านั้น');
      if (!st.decisions[p.decision]) deny('ผลการพิจารณาไม่ถูกต้อง');
      const me = user && db.users.find((u) => u.id === user.id);
      app.review = app.review || { docs: {} };
      app.review[st.key] = Object.assign({ decision: p.decision, note: str(p.note, 1000), signed: !!(me && me.signature && p.sign !== false) }, signer(user, ctx));
      if (st.key === 'director') {
        const map = { approve: 'approved', reject: 'rejected', waitlist: 'waitlist' };
        setStatus(db, app, map[p.decision], st.decisions[p.decision] + (p.note ? ' — ' + str(p.note) : ''), user, ctx);
      } else {
        app.history.push({ at: ctx.now, status: app.status, by: user.name, note: st.label + ': ' + st.decisions[p.decision] + (p.note ? ' — ' + str(p.note) : '') });
        if (app.status === 'submitted') setStatus(db, app, 'reviewing', '', user, ctx);
      }
      return app;
    }
    case 'setStatus': {
      const app = findApp(db, p.appId);
      if (!can(user, 'setStatus')) deny();
      setStatus(db, app, p.status, str(p.note, 1000), user, ctx);
      return app;
    }
    case 'deleteApp': {
      if (!can(user, 'admin')) deny();
      db.applications = db.applications.filter((x) => x.id !== p.appId);
      db.recipients = db.recipients.filter((r) => r.appId !== p.appId);
      return true;
    }
    default: deny('ไม่รู้จักคำสั่ง ' + op.type);
  }
}

// ข้อมูลที่ส่งให้ผู้ใช้แต่ละบทบาท (ผ่าน Relay)
export function dbForUser(db, user) {
  ensureShape(db);
  const users = db.users.map((u) => { const o = Object.assign({}, u); delete o.passwordHash; delete o.salt; return o; });
  if (user.role === 'student') {
    return { mine: db.applications.filter((a) => appVisible(user, a)), me: users.find((u) => u.id === user.id) };
  }
  const out = Object.assign({}, db, { users });
  if (!can(user, 'viewAllApps')) out.applications = db.applications.filter((a) => appVisible(user, a));
  return out;
}

export { DIVISIONS };
