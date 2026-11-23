/**
 * ============================================================================
 * TL Scholarship — Relay รับใบสมัครออนไลน์ (Google Apps Script)
 * รับใบสมัคร + ไฟล์แนบจากนักศึกษา แล้ว commit ลงฐานข้อมูล GitHub (repo ส่วนตัว)
 * โดยเก็บ GitHub Token ไว้ฝั่งเซิร์ฟเวอร์ (Script Properties) — ไม่เปิดเผยบนหน้าเว็บ
 * ============================================================================
 * วิธีติดตั้ง (ทำครั้งเดียว):
 * 1. ไปที่ https://script.google.com → New project → วางโค้ดไฟล์นี้ทั้งหมด → Save
 * 2. Project Settings (รูปเฟือง) → Script Properties → Add property:
 *      GITHUB_TOKEN = github_pat_...   (Fine-grained token: เลือกเฉพาะ repo scholarship-db,
 *                                        Permissions → Contents: Read and write)
 *      GITHUB_OWNER = ThaluangCementhaianusorn
 *      GITHUB_REPO  = scholarship-db
 * 3. Deploy → New deployment → Select type: Web app
 *      Execute as: Me   |   Who has access: Anyone
 * 4. คัดลอก Web app URL (ลงท้าย /exec) → ไปที่เว็บระบบ → ผู้ดูแล → ตั้งค่า → Relay URL → บันทึก
 * ============================================================================
 */

const BRANCH = 'main';
const DB_PATH = 'db.json';
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_FILES = 8;
const ALPH = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function cfg_() {
  const p = PropertiesService.getScriptProperties();
  const c = { token: p.getProperty('GITHUB_TOKEN'), owner: p.getProperty('GITHUB_OWNER'), repo: p.getProperty('GITHUB_REPO') };
  if (!c.token || !c.owner || !c.repo) throw new Error('Relay ยังไม่ได้ตั้งค่า Script Properties (GITHUB_TOKEN / GITHUB_OWNER / GITHUB_REPO)');
  return c;
}
function out_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }

function doGet() { return out_({ ok: true, service: 'TL Scholarship Relay' }); }

function doPost(e) {
  try {
    const body = JSON.parse((e.postData && e.postData.contents) || '{}');
    if (body.action === 'ping') { const c = cfg_(); readDb_(c); return out_({ ok: true, repo: c.owner + '/' + c.repo }); }
    if (body.action === 'submit') return out_(submit_(body));
    if (body.action === 'track') return out_(track_(body));
    return out_({ ok: false, error: 'ไม่รู้จักคำสั่ง' });
  } catch (err) {
    return out_({ ok: false, error: String(err.message || err) });
  }
}

// ---------------- GitHub helpers ----------------
function api_(c, method, path, payload) {
  const opt = {
    method: method, muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + c.token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
  };
  if (payload) { opt.contentType = 'application/json'; opt.payload = JSON.stringify(payload); }
  return UrlFetchApp.fetch('https://api.github.com/repos/' + c.owner + '/' + c.repo + '/contents/' + path.split('/').map(encodeURIComponent).join('/') + (method === 'get' ? '?ref=' + BRANCH : ''), opt);
}
function blobSha_(bytes) {
  const head = Utilities.newBlob('blob ' + bytes.length + '\0').getBytes();
  const d = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_1, head.concat(bytes));
  return d.map(function (b) { return ((b + 256) % 256).toString(16).padStart(2, '0'); }).join('');
}
function readDb_(c) {
  const res = UrlFetchApp.fetch('https://api.github.com/repos/' + c.owner + '/' + c.repo + '/contents/' + DB_PATH + '?ref=' + BRANCH, {
    muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + c.token, Accept: 'application/vnd.github.raw+json', 'X-GitHub-Api-Version': '2022-11-28' },
  });
  if (res.getResponseCode() !== 200) throw new Error('อ่านฐานข้อมูลไม่สำเร็จ (' + res.getResponseCode() + ')');
  const bytes = res.getContent();
  return { db: JSON.parse(res.getContentText('UTF-8')), sha: blobSha_(bytes) };
}
function putFile_(c, path, base64, sha, message) {
  const payload = { message: message, content: base64, branch: BRANCH };
  if (sha) payload.sha = sha;
  const res = api_(c, 'put', path, payload);
  return { code: res.getResponseCode(), body: res.getContentText() };
}
function code_(year) {
  let s = '';
  for (let i = 0; i < 6; i++) s += ALPH[Math.floor(Math.random() * ALPH.length)];
  return 'TL' + String(year).slice(-2) + '-' + s;
}
function str_(v, max) { return String(v == null ? '' : v).trim().slice(0, max || 500); }
function num_(v) { return v === '' || v == null || isNaN(Number(v)) ? '' : Number(v); }

// ---------------- Actions ----------------
function submit_(body) {
  const c = cfg_();
  const a = body.application || {};
  const s0 = a.student || {};
  const st = {
    prefix: str_(s0.prefix, 20), firstName: str_(s0.firstName, 80), lastName: str_(s0.lastName, 80), studentId: str_(s0.studentId, 15),
    level: str_(s0.level, 10), classYear: str_(s0.classYear, 2), departmentId: str_(s0.departmentId, 40), gpa: num_(s0.gpa),
    birthDate: str_(s0.birthDate, 10), phone: str_(s0.phone, 20), email: str_(s0.email, 120), address: str_(s0.address, 400),
    parentName: str_(s0.parentName, 120), parentRelation: str_(s0.parentRelation, 40), parentJob: str_(s0.parentJob, 80),
    parentPhone: str_(s0.parentPhone, 20), income: num_(s0.income), siblings: num_(s0.siblings),
  };
  if (!st.firstName || !st.lastName || !/^\d{5,15}$/.test(st.studentId)) throw new Error('ข้อมูลผู้สมัครไม่ครบถ้วน');
  const files = (body.files || []).slice(0, MAX_FILES);

  const first = readDb_(c);
  const sch = (first.db.scholarships || []).find(function (x) { return x.id === a.scholarshipId; });
  if (!sch) throw new Error('ไม่พบทุนการศึกษา');
  const today = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd');
  if (sch.status !== 'open' || (sch.deadline && sch.deadline < today) || (sch.openDate && sch.openDate > today)) throw new Error('ทุนนี้ไม่อยู่ในช่วงเปิดรับสมัคร');
  if ((first.db.applications || []).some(function (x) { return x.scholarshipId === sch.id && x.student && x.student.studentId === st.studentId && x.status !== 'rejected'; }))
    throw new Error('รหัสนักศึกษานี้ได้ยื่นสมัครทุนนี้แล้ว');

  const id = 'app_' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
  const code = code_(sch.year);
  const stored = [];
  files.forEach(function (f, i) {
    const bytes = Utilities.base64Decode(f.data || '');
    if (bytes.length > MAX_FILE_BYTES) throw new Error('ไฟล์ ' + f.name + ' มีขนาดเกินกำหนด');
    const safe = String(f.name || 'file').replace(/[^\w.\-ก-๙]+/g, '_').slice(-80);
    const path = 'uploads/' + id + '/' + (i + 1) + '-' + safe;
    const r = putFile_(c, path, f.data, null, '[upload] ' + code + ' ' + safe);
    if (r.code >= 300) throw new Error('อัปโหลดไฟล์ไม่สำเร็จ (' + r.code + ')');
    stored.push({ name: str_(f.name, 120), label: str_(f.label, 120), size: bytes.length, type: str_(f.type, 80), path: path });
  });

  const now = new Date().toISOString();
  const app = {
    id: id, code: code, scholarshipId: sch.id, year: String(sch.year), status: 'submitted', submittedAt: now,
    student: st, reason: str_(a.reason, 3000), achievements: str_(a.achievements, 2000), files: stored,
    history: [{ at: now, status: 'submitted', by: 'นักศึกษา', note: 'ยื่นใบสมัครออนไลน์' }],
  };

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    for (let attempt = 0; attempt < 4; attempt++) {
      const cur = attempt === 0 ? first : readDb_(c);
      cur.db.applications = cur.db.applications || [];
      cur.db.applications.push(app);
      cur.db.meta = cur.db.meta || {};
      cur.db.meta.updatedAt = now;
      const b64 = Utilities.base64Encode(Utilities.newBlob(JSON.stringify(cur.db, null, 1)).getBytes());
      const r = putFile_(c, DB_PATH, b64, cur.sha, '[db] ใบสมัครใหม่ ' + code);
      if (r.code < 300) return { ok: true, id: id, code: code, application: app };
      if (r.code !== 409 && r.code !== 422) throw new Error('บันทึกฐานข้อมูลไม่สำเร็จ (' + r.code + ')');
      Utilities.sleep(800);
    }
    throw new Error('ระบบมีผู้ใช้งานพร้อมกันจำนวนมาก กรุณาลองใหม่');
  } finally { lock.releaseLock(); }
}

function track_(body) {
  const c = cfg_();
  const code = str_(body.code, 20).toUpperCase();
  const sid = str_(body.studentId, 15);
  const db = readDb_(c).db;
  const a = (db.applications || []).find(function (x) { return x.code === code && x.student && x.student.studentId === sid; });
  if (!a) throw new Error('ไม่พบใบสมัครที่ตรงกับเลขที่และรหัสนักศึกษา');
  const sch = (db.scholarships || []).find(function (x) { return x.id === a.scholarshipId; }) || {};
  return { ok: true, application: { code: a.code, scholarshipId: a.scholarshipId, scholarshipTitle: sch.title, status: a.status, submittedAt: a.submittedAt, history: a.history } };
}
