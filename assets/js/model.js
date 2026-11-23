// โมเดลข้อมูลและฟังก์ชันคำนวณ (ไม่พึ่ง DOM — ใช้ร่วมกันทั้งเบราว์เซอร์ / Node / Google Apps Script)

export const LEVELS = ['ปวช.', 'ปวส.'];
export const CLASS_YEARS = { 'ปวช.': ['1', '2', '3'], 'ปวส.': ['1', '2'] };
export const TYPES = { external: 'หน่วยงานภายนอก', internal: 'ภายในสถานศึกษา' };
export const SPONSOR_CATEGORIES = ['มูลนิธิ', 'บริษัทเอกชน', 'ธนาคาร/รัฐวิสาหกิจ', 'หน่วยงานภาครัฐ', 'องค์กรปกครองส่วนท้องถิ่น', 'สมาคม/ชมรม', 'สถานศึกษา', 'บุคคลทั่วไป'];
export const PREFIXES = ['นาย', 'นางสาว', 'นาง'];
export const DIVISIONS = ['ฝ่ายบริหารทรัพยากร', 'ฝ่ายยุทธศาสตร์และแผนงาน', 'ฝ่ายพัฒนากิจการนักเรียน นักศึกษา', 'ฝ่ายวิชาการ'];

// บทบาทผู้ใช้งาน
export const ROLES = {
  admin: { label: 'ผู้ดูแลระบบ', short: 'ผู้ดูแลระบบ', tone: 'critical' },
  director: { label: 'ผู้อำนวยการ', short: 'ผู้อำนวยการ', tone: 'info' },
  deputy: { label: 'รองผู้อำนวยการ', short: 'รองผู้อำนวยการ', tone: 'info' },
  depthead: { label: 'หัวหน้าแผนกวิชา', short: 'หัวหน้าแผนก', tone: 'neutral' },
  guidance: { label: 'หัวหน้างานครูที่ปรึกษาและการแนะแนว', short: 'งานครูที่ปรึกษาฯ', tone: 'good' },
  student: { label: 'นักเรียน นักศึกษา', short: 'นักเรียน นักศึกษา', tone: 'neutral' },
};

export const STATUS = {
  submitted: { label: 'ยื่นใบสมัครแล้ว', tone: 'info', icon: 'send' },
  needs_docs: { label: 'เอกสารไม่ครบ / ขอเพิ่มเติม', tone: 'warning', icon: 'alert' },
  reviewing: { label: 'กำลังพิจารณา', tone: 'warning', icon: 'clock' },
  interview: { label: 'นัดสัมภาษณ์', tone: 'info', icon: 'users' },
  waitlist: { label: 'สำรอง', tone: 'neutral', icon: 'list' },
  approved: { label: 'อนุมัติทุน', tone: 'good', icon: 'check' },
  rejected: { label: 'ไม่ผ่านการพิจารณา', tone: 'critical', icon: 'x' },
};
export const SCHOLARSHIP_STATUS = {
  open: { label: 'เปิดรับสมัคร', tone: 'good' },
  closed: { label: 'ปิดรับสมัคร', tone: 'neutral' },
  draft: { label: 'ฉบับร่าง (ไม่เผยแพร่)', tone: 'warning' },
};

// ขั้นตอนการพิจารณาทุน (ลงนามออนไลน์ในแต่ละขั้น)
export const STAGES = [
  { key: 'depthead', label: 'ความเห็นหัวหน้าแผนกวิชา', roles: ['depthead'], decisions: { support: 'เห็นควรสนับสนุน', oppose: 'ไม่เห็นควรสนับสนุน' } },
  { key: 'guidance', label: 'ความเห็นหัวหน้างานครูที่ปรึกษาและการแนะแนว', roles: ['guidance'], decisions: { support: 'เห็นควรเสนออนุมัติ', oppose: 'ไม่เห็นควรเสนออนุมัติ' } },
  { key: 'deputy', label: 'ความเห็นรองผู้อำนวยการ', roles: ['deputy'], optional: true, decisions: { support: 'เห็นชอบ', oppose: 'ไม่เห็นชอบ' } },
  { key: 'director', label: 'ผลการพิจารณาของผู้อำนวยการ', roles: ['director'], decisions: { approve: 'อนุมัติ', waitlist: 'สำรอง', reject: 'ไม่อนุมัติ' } },
];

export const DEFAULT_DOCS = ['สำเนาบัตรประจำตัวประชาชน', 'สำเนาผลการเรียน (ใบแสดงผลการเรียน)', 'รูปถ่ายหน้าตรง 1 นิ้ว'];
export const DEFAULT_CATEGORIES = [
  { id: 'cat_merit', name: 'ทุนเรียนดี' },
  { id: 'cat_need', name: 'ทุนขาดแคลนทุนทรัพย์' },
  { id: 'cat_talent', name: 'ทุนความสามารถพิเศษ / กิจกรรม' },
  { id: 'cat_career', name: 'ทุนพัฒนาวิชาชีพ / ทุนทำงาน' },
  { id: 'cat_cont', name: 'ทุนต่อเนื่องจนจบการศึกษา' },
];

const ALPH = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function randomCode(n) {
  n = n || 6;
  let s = '';
  for (let i = 0; i < n; i++) s += ALPH[Math.floor(Math.random() * ALPH.length)];
  return s;
}
export function newId(p) { return p + '_' + Date.now().toString(36) + randomCode(4).toLowerCase(); }
export function appCode(year) { return 'TL' + String(year).slice(-2) + '-' + randomCode(6); }

// แฮชไม่ย้อนกลับแบบเบา ใช้จัดกลุ่มผู้รับทุนในข้อมูลสาธารณะโดยไม่เปิดเผยรหัสนักศึกษา
export function pid(s) {
  let h = 0x811c9dc5;
  for (const ch of String(s)) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36);
}
export function maskName(full) {
  const parts = String(full || '').trim().split(/\s+/);
  if (parts.length < 2) return parts[0] || '';
  return parts[0] + ' ' + [...parts[parts.length - 1]][0] + '.';
}

export function todayISO() { return new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10); }
export function isOpen(s, today) {
  today = today || todayISO();
  return s.status === 'open' && (!s.openDate || s.openDate <= today) && (!s.deadline || s.deadline >= today);
}

export function eligibility(s, st) {
  const checks = [];
  if (s.minGpa) checks.push({ label: 'เกรดเฉลี่ยสะสมไม่ต่ำกว่า ' + Number(s.minGpa).toFixed(2), ok: st.gpa === '' || st.gpa == null ? null : Number(st.gpa) >= Number(s.minGpa) });
  if (s.levels && s.levels.length) checks.push({ label: 'ระดับชั้น ' + s.levels.join(' / '), ok: st.level ? s.levels.includes(st.level) : null });
  if (s.departments && s.departments.length) checks.push({ label: 'อยู่ในแผนกวิชาที่กำหนด', ok: st.departmentId ? s.departments.includes(st.departmentId) : null });
  if (s.maxIncome) checks.push({ label: 'รายได้ครอบครัวไม่เกิน ' + Number(s.maxIncome).toLocaleString('th-TH') + ' บาท/ปี', ok: st.income === '' || st.income == null ? null : Number(st.income) <= Number(s.maxIncome) });
  checks.push({ label: 'อยู่ในช่วงเวลารับสมัคร', ok: isOpen(s) });
  return { checks, ok: checks.every((c) => c.ok !== false) };
}

export function countsByScholarship(apps) {
  const m = {};
  for (const a of apps || []) {
    const c = (m[a.scholarshipId] = m[a.scholarshipId] || { applicants: 0, approved: 0 });
    c.applicants++;
    if (a.status === 'approved') c.approved++;
  }
  return m;
}

// ข้อมูลผู้ใช้ที่ปลอดภัยสำหรับส่งออก (ไม่มีรหัสผ่าน)
export function safeUser(u, withSignature) {
  if (!u) return null;
  const o = { id: u.id, username: u.username, name: u.name, role: u.role, position: u.position || '', division: u.division || '', departmentId: u.departmentId || '', duties: u.duties || '', phone: u.phone || '', email: u.email || '', active: u.active !== false, level: u.level || '', classYear: u.classYear || '', hasSignature: !!u.signature };
  if (withSignature) o.signature = u.signature || '';
  return o;
}

// ผู้บริหาร/ผู้ลงนามประจำปีการศึกษา
export function resolveOfficials(db, year) {
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
export function buildPublic(db, opts) {
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
export const sum = (arr, f) => arr.reduce((t, x) => t + (Number(f ? f(x) : x) || 0), 0);
export function groupBy(arr, keyFn) {
  const m = new Map();
  for (const x of arr) { const k = keyFn(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); }
  return m;
}
export function years(view) {
  const ys = new Set([...(view.academicYears || []).map((y) => String(y.year)), ...(view.recipients || []).map((r) => String(r.year)), ...(view.scholarships || []).map((s) => String(s.year))]);
  return [...ys].filter(Boolean).sort().reverse();
}
export function stats(view, year, filter) {
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
