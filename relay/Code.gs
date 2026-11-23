/**
 * ============================================================================
 * TL Scholarship — Relay (Google Apps Script) v2
 * ระบบบัญชีผู้ใช้ (ผู้ดูแลระบบ / ผู้อำนวยการ / รองผู้อำนวยการ / หัวหน้าแผนก / งานครูที่ปรึกษาฯ / นักศึกษา)
 * รับใบสมัคร + ไฟล์แนบ, การพิจารณาทุน, ลงนามออนไลน์ — บันทึกลงฐานข้อมูล GitHub
 * GitHub Token ถูกเก็บไว้ฝั่งเซิร์ฟเวอร์ (Script Properties) ไม่เปิดเผยบนหน้าเว็บ
 * ----------------------------------------------------------------------------
 * ไฟล์นี้สร้างอัตโนมัติด้วย: node tools/build-relay.mjs (ห้ามแก้ไขโดยตรง)
 * ============================================================================
 * วิธีติดตั้ง (ทำครั้งเดียว):
 * 1. https://script.google.com → New project → ลบโค้ดเดิม → วางโค้ดไฟล์นี้ทั้งหมด → Save
 * 2. Project Settings (รูปเฟือง) → Script Properties → Add property 4 รายการ:
 *      GITHUB_TOKEN = github_pat_...  (Fine-grained token: Repository access เลือก
 *                                      scholarship-db และ scholarship-system,
 *                                      Permissions → Contents: Read and write)
 *      GITHUB_OWNER = ThaluangCementhaianusorn
 *      GITHUB_REPO  = scholarship-db
 *      SITE_REPO    = scholarship-system
 * 3. Deploy → New deployment → Select type: Web app
 *      Execute as: Me   |   Who has access: Anyone   → Deploy → อนุญาตสิทธิ์
 * 4. คัดลอก Web app URL (ลงท้าย /exec) → เว็บระบบ → ผู้ดูแล → ตั้งค่า → ระบบ → Relay URL → บันทึก
 * (เมื่ออัปเดตโค้ด: Deploy → Manage deployments → Edit → Version: New version)
 * ============================================================================
 */

// ===================== model.js =====================
// โมเดลข้อมูลและฟังก์ชันคำนวณ (ไม่พึ่ง DOM — ใช้ร่วมกันทั้งเบราว์เซอร์ / Node / Google Apps Script)

const LEVELS = ['ปวช.', 'ปวส.'];
const CLASS_YEARS = { 'ปวช.': ['1', '2', '3'], 'ปวส.': ['1', '2'] };
const TYPES = { external: 'หน่วยงานภายนอก', internal: 'ภายในสถานศึกษา' };
const SPONSOR_CATEGORIES = ['มูลนิธิ', 'บริษัทเอกชน', 'ธนาคาร/รัฐวิสาหกิจ', 'หน่วยงานภาครัฐ', 'องค์กรปกครองส่วนท้องถิ่น', 'สมาคม/ชมรม', 'สถานศึกษา', 'บุคคลทั่วไป'];
const PREFIXES = ['นาย', 'นางสาว', 'นาง'];
const DIVISIONS = ['ฝ่ายบริหารทรัพยากร', 'ฝ่ายยุทธศาสตร์และแผนงาน', 'ฝ่ายพัฒนากิจการนักเรียน นักศึกษา', 'ฝ่ายวิชาการ'];

// บทบาทผู้ใช้งาน
const ROLES = {
  admin: { label: 'ผู้ดูแลระบบ', short: 'ผู้ดูแลระบบ', tone: 'critical' },
  director: { label: 'ผู้อำนวยการ', short: 'ผู้อำนวยการ', tone: 'info' },
  deputy: { label: 'รองผู้อำนวยการ', short: 'รองผู้อำนวยการ', tone: 'info' },
  depthead: { label: 'หัวหน้าแผนกวิชา', short: 'หัวหน้าแผนก', tone: 'neutral' },
  guidance: { label: 'หัวหน้างานครูที่ปรึกษาและการแนะแนว', short: 'งานครูที่ปรึกษาฯ', tone: 'good' },
  student: { label: 'นักเรียน นักศึกษา', short: 'นักเรียน นักศึกษา', tone: 'neutral' },
};

const STATUS = {
  submitted: { label: 'ยื่นใบสมัครแล้ว', tone: 'info', icon: 'send' },
  needs_docs: { label: 'เอกสารไม่ครบ / ขอเพิ่มเติม', tone: 'warning', icon: 'alert' },
  reviewing: { label: 'กำลังพิจารณา', tone: 'warning', icon: 'clock' },
  interview: { label: 'นัดสัมภาษณ์', tone: 'info', icon: 'users' },
  waitlist: { label: 'สำรอง', tone: 'neutral', icon: 'list' },
  approved: { label: 'อนุมัติทุน', tone: 'good', icon: 'check' },
  rejected: { label: 'ไม่ผ่านการพิจารณา', tone: 'critical', icon: 'x' },
};
const SCHOLARSHIP_STATUS = {
  open: { label: 'เปิดรับสมัคร', tone: 'good' },
  closed: { label: 'ปิดรับสมัคร', tone: 'neutral' },
  draft: { label: 'ฉบับร่าง (ไม่เผยแพร่)', tone: 'warning' },
};

// ขั้นตอนการพิจารณาทุน (ลงนามออนไลน์ในแต่ละขั้น)
const STAGES = [
  { key: 'depthead', label: 'ความเห็นหัวหน้าแผนกวิชา', roles: ['depthead'], decisions: { support: 'เห็นควรสนับสนุน', oppose: 'ไม่เห็นควรสนับสนุน' } },
  { key: 'guidance', label: 'ความเห็นหัวหน้างานครูที่ปรึกษาและการแนะแนว', roles: ['guidance'], decisions: { support: 'เห็นควรเสนออนุมัติ', oppose: 'ไม่เห็นควรเสนออนุมัติ' } },
  { key: 'deputy', label: 'ความเห็นรองผู้อำนวยการ', roles: ['deputy'], optional: true, decisions: { support: 'เห็นชอบ', oppose: 'ไม่เห็นชอบ' } },
  { key: 'director', label: 'ผลการพิจารณาของผู้อำนวยการ', roles: ['director'], decisions: { approve: 'อนุมัติ', waitlist: 'สำรอง', reject: 'ไม่อนุมัติ' } },
];

const DEFAULT_DOCS = ['สำเนาบัตรประจำตัวประชาชน', 'สำเนาผลการเรียน (ใบแสดงผลการเรียน)', 'รูปถ่ายหน้าตรง 1 นิ้ว'];
const DEFAULT_CATEGORIES = [
  { id: 'cat_merit', name: 'ทุนเรียนดี' },
  { id: 'cat_need', name: 'ทุนขาดแคลนทุนทรัพย์' },
  { id: 'cat_talent', name: 'ทุนความสามารถพิเศษ / กิจกรรม' },
  { id: 'cat_career', name: 'ทุนพัฒนาวิชาชีพ / ทุนทำงาน' },
  { id: 'cat_cont', name: 'ทุนต่อเนื่องจนจบการศึกษา' },
];

const ALPH = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function randomCode(n) {
  n = n || 6;
  let s = '';
  for (let i = 0; i < n; i++) s += ALPH[Math.floor(Math.random() * ALPH.length)];
  return s;
}
function newId(p) { return p + '_' + Date.now().toString(36) + randomCode(4).toLowerCase(); }
function appCode(year) { return 'TL' + String(year).slice(-2) + '-' + randomCode(6); }

// แฮชไม่ย้อนกลับแบบเบา ใช้จัดกลุ่มผู้รับทุนในข้อมูลสาธารณะโดยไม่เปิดเผยรหัสนักศึกษา
function pid(s) {
  let h = 0x811c9dc5;
  for (const ch of String(s)) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36);
}
function maskName(full) {
  const parts = String(full || '').trim().split(/\s+/);
  if (parts.length < 2) return parts[0] || '';
  return parts[0] + ' ' + [...parts[parts.length - 1]][0] + '.';
}

function todayISO() { return new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10); }
function isOpen(s, today) {
  today = today || todayISO();
  return s.status === 'open' && (!s.openDate || s.openDate <= today) && (!s.deadline || s.deadline >= today);
}

function eligibility(s, st) {
  const checks = [];
  if (s.minGpa) checks.push({ label: 'เกรดเฉลี่ยสะสมไม่ต่ำกว่า ' + Number(s.minGpa).toFixed(2), ok: st.gpa === '' || st.gpa == null ? null : Number(st.gpa) >= Number(s.minGpa) });
  if (s.levels && s.levels.length) checks.push({ label: 'ระดับชั้น ' + s.levels.join(' / '), ok: st.level ? s.levels.includes(st.level) : null });
  if (s.departments && s.departments.length) checks.push({ label: 'อยู่ในแผนกวิชาที่กำหนด', ok: st.departmentId ? s.departments.includes(st.departmentId) : null });
  if (s.maxIncome) checks.push({ label: 'รายได้ครอบครัวไม่เกิน ' + Number(s.maxIncome).toLocaleString('th-TH') + ' บาท/ปี', ok: st.income === '' || st.income == null ? null : Number(st.income) <= Number(s.maxIncome) });
  checks.push({ label: 'อยู่ในช่วงเวลารับสมัคร', ok: isOpen(s) });
  return { checks, ok: checks.every((c) => c.ok !== false) };
}

function countsByScholarship(apps) {
  const m = {};
  for (const a of apps || []) {
    const c = (m[a.scholarshipId] = m[a.scholarshipId] || { applicants: 0, approved: 0 });
    c.applicants++;
    if (a.status === 'approved') c.approved++;
  }
  return m;
}

// ข้อมูลผู้ใช้ที่ปลอดภัยสำหรับส่งออก (ไม่มีรหัสผ่าน)
function safeUser(u, withSignature) {
  if (!u) return null;
  const o = { id: u.id, username: u.username, name: u.name, role: u.role, position: u.position || '', division: u.division || '', departmentId: u.departmentId || '', duties: u.duties || '', phone: u.phone || '', email: u.email || '', active: u.active !== false, level: u.level || '', classYear: u.classYear || '', hasSignature: !!u.signature };
  if (withSignature) o.signature = u.signature || '';
  return o;
}

// ผู้บริหาร/ผู้ลงนามประจำปีการศึกษา
function resolveOfficials(db, year) {
  const users = db.users || [];
  const cfg = (db.officials || {})[String(year)] || {};
  const byId = (id) => users.find((u) => u.id === id);
  const byRole = (role) => users.find((u) => u.role === role && u.active !== false);
  const pub = (u, title, extra) => (u ? Object.assign({ userId: u.id, name: u.name, position: u.position || title, duties: u.duties || '', title }, extra || {}) : null);
  const deputies = DIVISIONS.map((div) => {
    const u = byId((cfg.deputies || {})[div]) || users.find((x) => x.role === 'deputy' && x.division === div && x.active !== false);
    return pub(u, 'รองผู้อำนวยการ' + div, { division: div }) || { division: div, name: '', title: 'รองผู้อำนวยการ' + div };
  });
  const deptHeads = {};
  for (const d of db.departments || []) {
    const u = byId((cfg.deptHeads || {})[d.id]) || users.find((x) => x.role === 'depthead' && x.departmentId === d.id && x.active !== false);
    deptHeads[d.id] = pub(u, 'หัวหน้า' + d.name) || { name: d.head || '', title: 'หัวหน้า' + d.name };
  }
  return {
    director: pub(byId(cfg.director) || byRole('director'), 'ผู้อำนวยการ') || { name: (db.institution || {}).director || '', title: 'ผู้อำนวยการ' },
    deputies,
    guidance: pub(byId(cfg.guidance) || byRole('guidance'), 'หัวหน้างานครูที่ปรึกษาและการแนะแนว') || { name: (db.institution || {}).guidanceHead || '', title: 'หัวหน้างานครูที่ปรึกษาและการแนะแนว' },
    deptHeads,
  };
}

// ชุดข้อมูลสาธารณะ (ไม่มีข้อมูลส่วนบุคคล) / ชุดข้อมูลสำหรับบุคลากร (mask:false)
function buildPublic(db, opts) {
  const mask = !opts || opts.mask !== false;
  const counts = countsByScholarship(db.applications);
  const cats = db.categories || [];
  const catOf = (sid) => ((db.scholarships || []).find((s) => s.id === sid) || {}).categoryId || '';
  const years = (db.academicYears || []).map((y) => y.year);
  const officials = {};
  for (const y of years) officials[y] = resolveOfficials(db, y);
  if (mask) for (const y of years) {
    const o = officials[y];
    const strip = (x) => x && { name: x.name, title: x.title, position: x.position, duties: x.duties, division: x.division };
    officials[y] = { director: strip(o.director), deputies: o.deputies.map(strip), guidance: strip(o.guidance), deptHeads: Object.fromEntries(Object.entries(o.deptHeads).map(([k, v]) => [k, strip(v)])) };
  }
  return {
    meta: { updatedAt: (db.meta && db.meta.updatedAt) || new Date().toISOString(), schema: 2 },
    institution: db.institution || {},
    settings: { relayUrl: (db.settings && db.settings.relayUrl) || '' },
    academicYears: db.academicYears || [],
    officials,
    categories: cats,
    departments: db.departments || [],
    sponsors: db.sponsors || [],
    scholarships: (db.scholarships || [])
      .filter((s) => !mask || s.status !== 'draft')
      .map((s) => Object.assign({}, s, { applicants: (counts[s.id] || {}).applicants || 0, approved: (counts[s.id] || {}).approved || 0 })),
    announcements: (db.announcements || []).filter((a) => !mask || !a.draft),
    recipients: (db.recipients || []).map((r) => {
      const base = Object.assign({}, r, { pid: pid(r.studentId), categoryId: r.categoryId || catOf(r.scholarshipId) });
      if (mask) { delete base.studentId; base.name = maskName(r.name); }
      return base;
    }),
    users: mask ? undefined : (db.users || []).map((u) => safeUser(u, true)),
  };
}

// ---------- สถิติ ----------
const sum = (arr, f) => arr.reduce((t, x) => t + (Number(f ? f(x) : x) || 0), 0);
function groupBy(arr, keyFn) {
  const m = new Map();
  for (const x of arr) { const k = keyFn(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); }
  return m;
}
function years(view) {
  const ys = new Set([...(view.academicYears || []).map((y) => String(y.year)), ...(view.recipients || []).map((r) => String(r.year)), ...(view.scholarships || []).map((s) => String(s.year))]);
  return [...ys].filter(Boolean).sort().reverse();
}
function stats(view, year, filter) {
  filter = filter || {};
  const rec = (view.recipients || []).filter((r) => (!year || String(r.year) === String(year)) && (!filter.categoryId || r.categoryId === filter.categoryId) && (!filter.departmentId || r.departmentId === filter.departmentId));
  const sch = (view.scholarships || []).filter((s) => (!year || String(s.year) === String(year)) && (!filter.categoryId || s.categoryId === filter.categoryId));
  const ext = rec.filter((r) => r.type === 'external');
  const deptName = (id) => (view.departments.find((d) => d.id === id) || {}).name || 'ไม่ระบุแผนก';
  const sponsorName = (id) => (view.sponsors.find((s) => s.id === id) || {}).name || 'ไม่ระบุแหล่งทุน';
  const catName = (id) => ((view.categories || []).find((c) => c.id === id) || {}).name || 'ไม่ระบุประเภท';
  const rank = (m, nameFn) => [...m].map(([k, v]) => ({ key: k, name: nameFn(k), count: v.length, amount: sum(v, (r) => r.amount) }))
    .sort((a, b) => b.amount - a.amount || b.count - a.count);
  const students = [...groupBy(rec, (r) => r.pid)].map(([k, v]) => ({
    key: k, name: v[0].name, level: v[0].level, departmentId: v[0].departmentId,
    count: v.length, amount: sum(v, (r) => r.amount), items: v.map((r) => r.scholarshipTitle),
  })).sort((a, b) => b.amount - a.amount || b.count - a.count);
  const allRec = (view.recipients || []).filter((r) => (!filter.categoryId || r.categoryId === filter.categoryId) && (!filter.departmentId || r.departmentId === filter.departmentId));
  const byYear = [...groupBy(allRec, (r) => String(r.year))].sort(([a], [b]) => a.localeCompare(b))
    .map(([y, v]) => ({ year: y, external: sum(v.filter((r) => r.type === 'external'), (r) => r.amount), internal: sum(v.filter((r) => r.type !== 'external'), (r) => r.amount), count: v.length }));
  return {
    rec, sch,
    total: sum(rec, (r) => r.amount),
    count: rec.length,
    students: students.length,
    extAmount: sum(ext, (r) => r.amount),
    extCount: ext.length,
    intAmount: sum(rec, (r) => (r.type === 'external' ? 0 : r.amount)),
    quota: sum(sch, (s) => s.quota),
    programs: sch.length,
    openPrograms: sch.filter((s) => isOpen(s)).length,
    sponsorsActive: new Set(rec.map((r) => r.sponsorId)).size,
    byDept: rank(groupBy(rec, (r) => r.departmentId), deptName),
    bySponsor: rank(groupBy(rec, (r) => r.sponsorId), sponsorName),
    bySponsorExt: rank(groupBy(ext, (r) => r.sponsorId), sponsorName),
    byCategory: rank(groupBy(rec, (r) => r.categoryId), catName),
    byLevel: LEVELS.map((l) => ({ level: l, count: rec.filter((r) => r.level === l).length, amount: sum(rec.filter((r) => r.level === l), (r) => r.amount) })),
    topStudents: students,
    byYear,
  };
}

// ===================== ops.js =====================
// การแก้ไขฐานข้อมูล + ตรวจสิทธิ์ตามบทบาท
// ไฟล์นี้ถูกใช้ทั้งในเบราว์เซอร์ (ผู้ดูแลที่ใช้ GitHub Token) และใน Relay (Google Apps Script)
// เพื่อให้กฎสิทธิ์ถูกบังคับใช้ฝั่งเซิร์ฟเวอร์เสมอ


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

function can(user, perm, extra) {
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
function appVisible(user, app) {
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

function ensureShape(db) {
  for (const k of ['departments', 'sponsors', 'scholarships', 'announcements', 'recipients', 'applications', 'users', 'academicYears']) db[k] = db[k] || [];
  if (!db.categories || !db.categories.length) db.categories = DEFAULT_CATEGORIES.map((c) => Object.assign({}, c));
  db.officials = db.officials || {};
  db.institution = db.institution || {};
  db.settings = db.settings || {};
  db.meta = db.meta || {};
  if (!db.academicYears.length && db.institution.academicYear) db.academicYears.push({ id: 'y_' + db.institution.academicYear, year: String(db.institution.academicYear), status: 'active' });
  return db;
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
function applyOp(db, user, op, ctx) {
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
      else { if (!p.passwordHash) deny('กรุณากำหนดรหัสผ่าน'); target = Object.assign({ id: ctx.id('u'), createdAt: ctx.now }, fields); db.users.push(target); }
      if (p.passwordHash) { target.passwordHash = p.passwordHash; target.salt = p.salt; }
      if (p.signature !== undefined) target.signature = p.signature;
      return { id: target.id };
    }
    case 'deleteUser': {
      if (!can(user, 'admin')) deny();
      if (user && user.id === p.id) deny('ไม่สามารถลบบัญชีของตนเองได้');
      db.users = db.users.filter((x) => x.id !== p.id);
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
function dbForUser(db, user) {
  ensureShape(db);
  const users = db.users.map((u) => { const o = Object.assign({}, u); delete o.passwordHash; delete o.salt; return o; });
  if (user.role === 'student') {
    return { mine: db.applications.filter((a) => appVisible(user, a)), me: users.find((u) => u.id === user.id) };
  }
  const out = Object.assign({}, db, { users });
  if (!can(user, 'viewAllApps')) out.applications = db.applications.filter((a) => appVisible(user, a));
  return out;
}



// ===================== RELAY CORE (Google Apps Script) =====================
// ส่วนนี้ถูกรวมกับ model.js + ops.js โดย tools/build-relay.mjs → relay/Code.gs

const BRANCH = 'main';
const DB_PATH = 'db.json';
const PUBLIC_PATH = 'data/public.json';
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const SESSION_HOURS = 12;

function cfg_() {
  const p = PropertiesService.getScriptProperties();
  const c = { token: p.getProperty('GITHUB_TOKEN'), owner: p.getProperty('GITHUB_OWNER'), repo: p.getProperty('GITHUB_REPO'), site: p.getProperty('SITE_REPO'), secret: p.getProperty('SESSION_SECRET') };
  if (!c.token || !c.owner || !c.repo || !c.site) throw new Error('Relay ยังไม่ได้ตั้งค่า Script Properties (GITHUB_TOKEN / GITHUB_OWNER / GITHUB_REPO / SITE_REPO)');
  if (!c.secret) { c.secret = Utilities.getUuid() + Utilities.getUuid(); p.setProperty('SESSION_SECRET', c.secret); }
  return c;
}
function out_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
function fail_(msg, code) { const e = new Error(msg); e.code = code; throw e; }

function doGet() { return out_({ ok: true, service: 'TL Scholarship Relay v2' }); }

function doPost(e) {
  try {
    const b = JSON.parse((e.postData && e.postData.contents) || '{}');
    const c = cfg_();
    switch (b.action) {
      case 'ping': readDb_(c); return out_({ ok: true, repo: c.owner + '/' + c.repo });
      case 'login': return out_(login_(c, b));
      case 'getDb': { const s = auth_(c, b.session); return out_({ ok: true, user: safeUser(s.user), data: dbForUser(s.db, s.user) }); }
      case 'op': return out_(op_(c, b));
      case 'submit': return out_(submit_(c, b));
      case 'addFiles': return out_(addFiles_(c, b));
      case 'uploadPublic': return out_(uploadPublic_(c, b));
      case 'file': return out_(file_(c, b));
      case 'changePassword': return out_(changePassword_(c, b));
      case 'track': return out_(track_(c, b));
    }
    return out_({ ok: false, error: 'ไม่รู้จักคำสั่ง' });
  } catch (err) {
    return out_({ ok: false, error: String(err.message || err), code: err.code || 400 });
  }
}

// ---------------- GitHub ----------------
function url_(c, repo, path) { return 'https://api.github.com/repos/' + c.owner + '/' + repo + '/contents/' + path.split('/').map(encodeURIComponent).join('/'); }
function headers_(c, accept) { return { Authorization: 'Bearer ' + c.token, Accept: accept || 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }; }
function blobSha_(bytes) {
  const head = Utilities.newBlob('blob ' + bytes.length + '\0').getBytes();
  const d = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_1, head.concat(bytes));
  return d.map(function (x) { return ((x + 256) % 256).toString(16).padStart(2, '0'); }).join('');
}
function raw_(c, repo, path) {
  const res = UrlFetchApp.fetch(url_(c, repo, path) + '?ref=' + BRANCH, { muteHttpExceptions: true, headers: headers_(c, 'application/vnd.github.raw+json') });
  if (res.getResponseCode() === 404) return null;
  if (res.getResponseCode() !== 200) fail_('อ่านข้อมูลจาก GitHub ไม่สำเร็จ (' + res.getResponseCode() + ')', 500);
  const bytes = res.getContent();
  return { bytes: bytes, text: res.getContentText('UTF-8'), sha: blobSha_(bytes), type: res.getHeaders()['Content-Type'] };
}
function put_(c, repo, path, base64, sha, message) {
  const payload = { message: message, content: base64, branch: BRANCH };
  if (sha) payload.sha = sha;
  const res = UrlFetchApp.fetch(url_(c, repo, path), { method: 'put', muteHttpExceptions: true, headers: headers_(c), contentType: 'application/json', payload: JSON.stringify(payload) });
  return res.getResponseCode();
}
function b64text_(s) { return Utilities.base64Encode(Utilities.newBlob(s).getBytes()); }
function readDb_(c) {
  const r = raw_(c, c.repo, DB_PATH);
  if (!r) fail_('ไม่พบฐานข้อมูล ' + DB_PATH, 500);
  return { db: ensureShape(JSON.parse(r.text)), sha: r.sha };
}
function ctx_() { return { now: new Date().toISOString(), id: newId, code: appCode }; }

// แก้ไข db แบบ atomic (lock + retry) แล้วเผยแพร่ public.json
function commit_(c, fn, message) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    for (let attempt = 0; attempt < 4; attempt++) {
      const cur = readDb_(c);
      const result = fn(cur.db);
      cur.db.meta.updatedAt = new Date().toISOString();
      const code = put_(c, c.repo, DB_PATH, b64text_(JSON.stringify(cur.db, null, 1)), cur.sha, '[db] ' + message);
      if (code < 300) { publish_(c, cur.db, message); return { db: cur.db, result: result }; }
      if (code !== 409 && code !== 422) fail_('บันทึกฐานข้อมูลไม่สำเร็จ (' + code + ')', 500);
      Utilities.sleep(700);
    }
    fail_('ระบบมีผู้ใช้งานพร้อมกันจำนวนมาก กรุณาลองใหม่', 503);
  } finally { lock.releaseLock(); }
}
function publish_(c, db, message) {
  const text = JSON.stringify(buildPublic(db, { mask: true }), null, 1);
  for (let i = 0; i < 3; i++) {
    const cur = raw_(c, c.site, PUBLIC_PATH);
    if (cur && JSON.stringify(Object.assign({}, JSON.parse(cur.text), { meta: 0 })) === JSON.stringify(Object.assign({}, JSON.parse(text), { meta: 0 }))) return;
    const code = put_(c, c.site, PUBLIC_PATH, b64text_(text), cur && cur.sha, '[public] ' + message);
    if (code < 300) return;
    Utilities.sleep(500);
  }
}

// ---------------- Auth ----------------
function sha256hex_(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8)
    .map(function (x) { return ((x + 256) % 256).toString(16).padStart(2, '0'); }).join('');
}
// ต้องตรงกับ hashPassword ใน assets/js/store.js
function hashPassword_(password, salt) {
  let h = sha256hex_(salt + ':' + password);
  for (let i = 0; i < 999; i++) h = sha256hex_(h + ':' + salt);
  return h;
}
function salt_() { return Utilities.getUuid().replace(/-/g, '').slice(0, 24); }
function hmac_(c, s) { return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(s, c.secret)).replace(/=+$/, ''); }
function sign_(c, userId) { const exp = Date.now() + SESSION_HOURS * 3600000; const body = userId + '.' + exp; return body + '.' + hmac_(c, body); }
function auth_(c, token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3 || hmac_(c, parts[0] + '.' + parts[1]) !== parts[2] || Number(parts[1]) < Date.now()) fail_('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่', 401);
  const r = readDb_(c);
  const user = r.db.users.find(function (u) { return u.id === parts[0] && u.active !== false; });
  if (!user) fail_('ไม่พบบัญชีผู้ใช้หรือบัญชีถูกระงับ', 401);
  return { user: user, db: r.db };
}
function optionalAuth_(c, token) { return token ? auth_(c, token).user : null; }

function login_(c, b) {
  const db = readDb_(c).db;
  const u = db.users.find(function (x) { return x.username === String(b.username || '').toLowerCase() && x.active !== false; });
  Utilities.sleep(300);
  if (!u || !u.passwordHash || hashPassword_(String(b.password || ''), u.salt) !== u.passwordHash) fail_('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง', 401);
  return { ok: true, session: sign_(c, u.id), user: safeUser(u) };
}
function changePassword_(c, b) {
  const s = auth_(c, b.session);
  if (hashPassword_(String(b.oldPassword || ''), s.user.salt) !== s.user.passwordHash) fail_('รหัสผ่านเดิมไม่ถูกต้อง');
  if (String(b.newPassword || '').length < 6) fail_('รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร');
  const salt = salt_();
  const hash = hashPassword_(String(b.newPassword), salt);
  commit_(c, function (db) { const me = db.users.find(function (u) { return u.id === s.user.id; }); me.passwordHash = hash; me.salt = salt; }, 'เปลี่ยนรหัสผ่าน ' + s.user.username);
  return { ok: true };
}

// ---------------- Actions ----------------
function op_(c, b) {
  const s = auth_(c, b.session);
  const op = b.op || {};
  const p = op.payload || {};
  delete p.passwordHash; delete p.salt;
  if (op.type === 'saveUser' && p.password) { if (String(p.password).length < 6) fail_('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'); p.salt = salt_(); p.passwordHash = hashPassword_(String(p.password), p.salt); delete p.password; }
  if (op.type === 'importStudents') (p.rows || []).forEach(function (r) { r.salt = salt_(); r.passwordHash = hashPassword_(String(r.password || r.username), r.salt); delete r.password; });
  const r = commit_(c, function (db) { return applyOp(db, s.user, { type: op.type, payload: p }, ctx_()); }, op.type + ' โดย ' + s.user.username);
  const me = r.db.users.find(function (u) { return u.id === s.user.id; }) || s.user;
  return { ok: true, result: r.result, data: dbForUser(r.db, me) };
}

function storeFiles_(c, appId, files) {
  return (files || []).slice(0, 8).map(function (f, i) {
    const bytes = Utilities.base64Decode(f.data || '');
    if (bytes.length > MAX_FILE_BYTES) fail_('ไฟล์ ' + f.name + ' มีขนาดเกินกำหนด');
    const safe = String(f.name || 'file').replace(/[^\w.\-ก-๙]+/g, '_').slice(-80);
    const path = 'uploads/' + appId + '/' + Date.now().toString(36) + '-' + (i + 1) + '-' + safe;
    const code = put_(c, c.repo, path, f.data, null, '[upload] ' + appId + ' ' + safe);
    if (code >= 300) fail_('อัปโหลดไฟล์ไม่สำเร็จ (' + code + ')', 500);
    return { name: String(f.name || '').slice(0, 120), label: String(f.label || '').slice(0, 120), size: bytes.length, type: String(f.type || '').slice(0, 80), path: path };
  });
}

function submit_(c, b) {
  const user = optionalAuth_(c, b.session);
  const pre = readDb_(c).db;
  const probe = JSON.parse(JSON.stringify(pre));
  applyOp(probe, user, { type: 'submitApplication', payload: { application: b.application, files: [] } }, ctx_()); // ตรวจสอบก่อนอัปโหลดไฟล์
  const id = newId('app');
  const files = storeFiles_(c, id, b.files);
  const r = commit_(c, function (db) { return applyOp(db, user, { type: 'submitApplication', payload: { application: b.application, files: files, id: id } }, ctx_()); }, 'ใบสมัครใหม่');
  return { ok: true, id: r.result.id, code: r.result.code, application: r.result };
}

function addFiles_(c, b) {
  const user = optionalAuth_(c, b.session);
  const db = readDb_(c).db;
  const app = b.appId ? db.applications.find(function (a) { return a.id === b.appId; })
    : db.applications.find(function (a) { return a.code === String(b.code || '').toUpperCase() && a.student && a.student.studentId === String(b.studentId || ''); });
  if (!app) fail_('ไม่พบใบสมัคร');
  if (!user && !b.code) fail_('กรุณาระบุเลขที่ใบสมัคร');
  const probe = JSON.parse(JSON.stringify(db));
  applyOp(probe, user, { type: 'addFiles', payload: { appId: app.id, code: b.code, studentId: b.studentId, files: [] } }, ctx_());
  const files = storeFiles_(c, app.id, b.files);
  const r = commit_(c, function (d) { return applyOp(d, user, { type: 'addFiles', payload: { appId: app.id, code: b.code, studentId: b.studentId, files: files } }, ctx_()); }, 'แนบเอกสารเพิ่มเติม ' + app.code);
  return { ok: true, result: { code: r.result.code, status: r.result.status } };
}

function uploadPublic_(c, b) {
  const s = auth_(c, b.session);
  const kind = b.kind === 'logo' ? 'logo' : 'posters';
  if (kind === 'logo' ? !can(s.user, 'admin') : !can(s.user, 'post')) fail_('คุณไม่มีสิทธิ์อัปโหลดรูปภาพ', 403);
  const ext = /^(png|jpe?g|webp)$/i.test(b.ext || '') ? b.ext.toLowerCase() : 'jpg';
  const bytes = Utilities.base64Decode(b.data || '');
  if (bytes.length > 4 * 1048576) fail_('ไฟล์รูปภาพใหญ่เกินไป');
  const path = 'uploads/' + kind + '/' + newId(kind.slice(0, 3)) + '.' + ext;
  const code = put_(c, c.site, path, b.data, null, '[upload] ' + path);
  if (code >= 300) fail_('อัปโหลดไม่สำเร็จ (' + code + ')', 500);
  return { ok: true, url: 'https://raw.githubusercontent.com/' + c.owner + '/' + c.site + '/' + BRANCH + '/' + path };
}

function file_(c, b) {
  const s = auth_(c, b.session);
  const path = String(b.path || '');
  const app = s.db.applications.find(function (a) { return (a.files || []).some(function (f) { return f.path === path; }); });
  if (!app || !appVisible(s.user, app)) fail_('ไม่มีสิทธิ์เข้าถึงไฟล์นี้', 403);
  const r = raw_(c, c.repo, path);
  if (!r) fail_('ไม่พบไฟล์');
  return { ok: true, data: Utilities.base64Encode(r.bytes), type: r.type };
}

function track_(c, b) {
  const code = String(b.code || '').trim().toUpperCase();
  const sid = String(b.studentId || '').trim();
  const db = readDb_(c).db;
  const a = db.applications.find(function (x) { return x.code === code && x.student && x.student.studentId === sid; });
  if (!a) fail_('ไม่พบใบสมัครที่ตรงกับเลขที่และรหัสนักศึกษา');
  const sch = db.scholarships.find(function (x) { return x.id === a.scholarshipId; }) || {};
  const review = {};
  ['docCheck', 'depthead', 'guidance', 'deputy', 'director'].forEach(function (k) { if (a.review && a.review[k]) review[k] = { decision: a.review[k].decision || a.review[k].result, at: a.review[k].at, note: a.review[k].note }; });
  return { ok: true, application: { code: a.code, scholarshipId: a.scholarshipId, scholarshipTitle: sch.title, status: a.status, submittedAt: a.submittedAt, history: a.history, review: review, files: (a.files || []).map(function (f) { return { name: f.name, label: f.label }; }) } };
}
