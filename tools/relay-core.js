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
