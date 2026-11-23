import { CONFIG } from './config.js';
import { GitHub, b64FromText, b64FromBytes } from './github.js';
import { buildPublic, newId, appCode, safeUser } from './model.js';
import { applyOp, can as canDo, ensureShape } from './ops.js';
import { sealKey, openKey, passwordProblem, KEY_ROLES } from './auth.js';

const LS_SESSION = 'tl_session_v2';
// persist=true → จดจำในเครื่อง (localStorage) / false → จนกว่าจะปิดเบราว์เซอร์ (sessionStorage)
const ls = {
  get(k) { for (const s of ['localStorage', 'sessionStorage']) { try { const v = window[s].getItem(k); if (v) return JSON.parse(v); } catch {} } return null; },
  set(k, v, persist = true) { try { window[persist ? 'localStorage' : 'sessionStorage'].setItem(k, JSON.stringify(v)); window[persist ? 'sessionStorage' : 'localStorage'].removeItem(k); } catch {} },
  del(k) { for (const s of ['localStorage', 'sessionStorage']) { try { window[s].removeItem(k); } catch {} } },
};
const saveSession = (s) => ls.set(LS_SESSION, s, s.persist !== false);
const publicKey = (p) => JSON.stringify({ ...p, meta: { ...p.meta, updatedAt: '' } });
const GH_ADMIN = { id: 'gh-admin', username: 'github-admin', name: 'ผู้ดูแลระบบ', role: 'admin', position: 'ผู้ดูแลระบบ', active: true };

async function sha256hex(s) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
// ต้องตรงกับ hashPassword_ ใน relay/Code.gs
export async function hashPassword(password, salt) {
  let h = await sha256hex(`${salt}:${password}`);
  for (let i = 0; i < 999; i++) h = await sha256hex(`${h}:${salt}`);
  return h;
}
export const newSalt = () => [...crypto.getRandomValues(new Uint8Array(12))].map((b) => b.toString(16).padStart(2, '0')).join('');

// ย่อรูปภาพก่อนอัปโหลด (โปสเตอร์/โลโก้)
export async function shrinkImage(file, max = 1600, type = 'image/jpeg', q = 0.86) {
  if (!/^image\//.test(file.type) || file.type === 'image/svg+xml') return file;
  const img = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(img.width, img.height));
  const c = Object.assign(document.createElement('canvas'), { width: Math.round(img.width * k), height: Math.round(img.height * k) });
  const g = c.getContext('2d');
  if (type === 'image/jpeg') { g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); }
  g.drawImage(img, 0, 0, c.width, c.height);
  const blob = await new Promise((r) => c.toBlob(r, type, q));
  return new File([blob], file.name.replace(/\.\w+$/, type === 'image/png' ? '.png' : '.jpg'), { type });
}

export const store = {
  pub: null, pubSha: null, pubEtag: null,
  db: null, dbSha: null, dbEtag: null, mine: null,
  session: ls.get(LS_SESSION),
  lastSync: null, busy: false, error: null,
  _listeners: new Set(), _viewCache: null,

  get user() { return this.session?.user || null; },
  get mode() { return this.session?.mode || null; },
  get isStaff() { return !!(this.user && this.user.role !== 'student' && this.db); },
  get isAdmin() { return this.user?.role === 'admin' && !!this.db; },
  get isStudent() { return this.user?.role === 'student'; },
  can(perm, extra) { return canDo(this.user, perm, extra); },

  gh() { return new GitHub({ owner: CONFIG.owner, branch: CONFIG.branch, token: this.mode === 'github' ? this.session.token : null }); },
  on(fn) { this._listeners.add(fn); return () => this._listeners.delete(fn); },
  emit(reason) { this._listeners.forEach((f) => f(reason)); },

  view() {
    if (this.isStaff) {
      if (this._viewCache?.db !== this.db) this._viewCache = { db: this.db, v: buildPublic(this.db, { mask: false }) };
      return this._viewCache.v;
    }
    return this.pub;
  },
  currentYear() { const v = this.view(); return String(v?.institution?.academicYear || (v?.academicYears || []).find((y) => y.status === 'active')?.year || ''); },

  async init() {
    await this.loadPublic();
    if (this.session) { try { await this.loadPrivate(true); } catch (e) { console.warn('session', e); if (e.status === 401 || /session|เข้าสู่ระบบ/i.test(e.message)) this.logout(true); } }
    setInterval(() => this.refresh(), CONFIG.pollMs);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.refresh(); });
  },

  async refresh() {
    if (document.hidden || this.busy) return;
    try {
      const changed = this.session ? await this.loadPrivate() : await this.loadPublic();
      this.error = null;
      this.emit(changed ? 'data' : 'sync');
    } catch (e) { this.error = e.message; this.emit('sync'); }
  },

  async loadPublic() {
    try {
      const r = await this.gh().readJSON(CONFIG.siteRepo, CONFIG.publicPath, this.pubEtag);
      this.lastSync = new Date();
      if (r.notModified) return false;
      if (r.missing) throw new Error('public.json not found');
      Object.assign(this, { pub: r.data, pubSha: r.sha, pubEtag: r.etag });
      return true;
    } catch (e) {
      if (this.pub) return false;
      const res = await fetch(`./data/public.json?t=${Date.now()}`);
      this.pub = await res.json();
      this.lastSync = new Date();
      return true;
    }
  },

  // โหลดข้อมูลตามสิทธิ์ของผู้ใช้
  async loadPrivate(force = false) {
    if (this.mode === 'github') {
      const r = await this.gh().readJSON(CONFIG.dbRepo, CONFIG.dbPath, force ? null : this.dbEtag);
      this.lastSync = new Date();
      if (r.notModified) return false;
      if (r.missing) throw new Error(`ไม่พบไฟล์ ${CONFIG.dbPath} ใน repo ${CONFIG.dbRepo}`);
      Object.assign(this, { db: ensureShape(r.data), dbSha: r.sha, dbEtag: r.etag });
      // เข้าสู่ระบบด้วยรหัสผ่าน (กุญแจ) → ใช้สิทธิ์ตามบทบาทของบัญชีจริง
      if (this.session.userId) {
        const u = this.db.users.find((x) => x.id === this.session.userId);
        if (!u || u.active === false || !KEY_ROLES.includes(u.role)) { this.logout(); throw new Error('บัญชีนี้ถูกระงับหรือไม่มีสิทธิ์แล้ว'); }
        this.session.user = safeUser(u);
        saveSession(this.session);
      }
      return true;
    }
    if (this.mode === 'relay') {
      const before = this.db?.meta?.updatedAt || this.mine?.length;
      const r = await this.relay({ action: 'getDb', session: this.session.session });
      this.lastSync = new Date();
      if (r.user) { this.session.user = r.user; saveSession(this.session); }
      if (this.user.role === 'student') { this.mine = r.data.mine; this.db = null; await this.loadPublic(); return true; }
      this.db = ensureShape(r.data);
      return force || before !== this.db.meta?.updatedAt;
    }
    return false;
  },

  async loginToken(token, persist = true) {
    const prev = this.session;
    this.session = { mode: 'github', token: token.trim(), user: GH_ADMIN, persist };
    try {
      const repo = await this.gh().repo(CONFIG.dbRepo);
      if (!repo.permissions?.push) throw new Error('Token นี้ไม่มีสิทธิ์เขียนฐานข้อมูล (ต้องการ Contents: Read and write)');
      await this.loadPrivate(true);
      saveSession(this.session);
      this.emit('auth');
    } catch (e) {
      this.session = prev;
      if (e.status === 401) throw new Error('Token ไม่ถูกต้องหรือหมดอายุ');
      if (e.status === 404) throw new Error(`Token นี้เข้าถึง repo ${CONFIG.owner}/${CONFIG.dbRepo} ไม่ได้`);
      throw e;
    }
  },

  // บัญชีที่เข้าสู่ระบบด้วยรหัสผ่านได้โดยไม่ต้องใช้ Relay
  loginAccounts() { return this.pub?.loginKeys || []; },

  async loginPassword(username, password, persist = true) {
    const uname = username.trim().toLowerCase();
    await this.loadPublic().catch(() => {});
    const k = this.loginAccounts().find((x) => x.username === uname);
    if (k) {
      let payload;
      try { payload = await openKey(k, password); } catch { throw new Error('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'); }
      this.session = { mode: 'github', token: payload.token, userId: payload.userId, user: { id: payload.userId, username: uname, name: k.name, role: k.role }, persist };
      try { await this.loadPrivate(true); } catch (e) {
        this.session = null;
        if (e.status === 401 || e.status === 403 || e.status === 404) throw new Error('กุญแจเข้าสู่ระบบหมดอายุ (GitHub Token ถูกเปลี่ยนหรือหมดอายุ) — ให้ผู้ดูแลระบบเข้าสู่ระบบด้วย Token ใหม่ แล้วตั้งรหัสผ่านให้บัญชีนี้อีกครั้ง');
        throw e;
      }
      saveSession(this.session);
      this.emit('auth');
      return;
    }
    if (!this.relayUrl()) throw new Error('ไม่พบบัญชีนี้ หรือบัญชีนี้ยังไม่ได้ตั้งรหัสผ่าน — ติดต่อผู้ดูแลระบบ');
    const r = await this.relay({ action: 'login', username: uname, password });
    this.session = { mode: 'relay', session: r.session, user: r.user, persist };
    try { await this.loadPrivate(true); } catch (e) { this.session = null; throw e; }
    saveSession(this.session);
    this.emit('auth');
  },

  // สร้างกุญแจเข้าสู่ระบบ (ต้องเข้าสู่ระบบแบบ GitHub อยู่ เพื่อใช้ token ปัจจุบัน)
  async makeLoginKey(userId, password) {
    if (this.mode !== 'github' || !this.session.token) throw new Error('ต้องเข้าสู่ระบบด้วย GitHub Token หรือบัญชีผู้ดูแลระบบก่อน');
    const problem = passwordProblem(password);
    if (problem) throw new Error(problem);
    return sealKey({ token: this.session.token, userId }, password);
  },
  hasLoginKey(userId) { return (this.db?.loginKeys || []).some((k) => k.userId === userId); },

  logout(silent) {
    ls.del(LS_SESSION);
    Object.assign(this, { session: null, db: null, dbSha: null, dbEtag: null, mine: null, _viewCache: null });
    if (!silent) this.emit('auth');
  },

  ctx() { return { now: new Date().toISOString(), id: newId, code: appCode }; },

  // ทุกการแก้ไขผ่าน op (ตรวจสิทธิ์ด้วย ops.js ทั้งฝั่งเบราว์เซอร์และ Relay)
  async op(type, payload, message) {
    if (!this.session) throw new Error('กรุณาเข้าสู่ระบบก่อน');
    this.busy = true; this.emit('busy');
    try {
      if (this.mode === 'relay') {
        const r = await this.relay({ action: 'op', session: this.session.session, op: { type, payload } });
        if (r.data) { if (this.user.role === 'student') this.mine = r.data.mine; else this.db = ensureShape(r.data); }
        this.pubEtag = null;
        this.emit('data');
        return r.result;
      }
      for (let attempt = 0; attempt < 4; attempt++) {
        const draft = structuredClone(this.db);
        const result = applyOp(draft, this.user, { type, payload }, this.ctx());
        draft.meta = { ...(draft.meta || {}), updatedAt: new Date().toISOString() };
        try {
          const res = await this.gh().put(CONFIG.dbRepo, CONFIG.dbPath, b64FromText(JSON.stringify(draft, null, 1)), this.dbSha, `[db] ${message || type}`);
          Object.assign(this, { db: draft, dbSha: res.content.sha, dbEtag: null });
          await this.publish(message || type);
          this.emit('data');
          return result;
        } catch (e) {
          if (e.status === 409 || e.status === 422) { await this.loadPrivate(true); continue; }
          throw e;
        }
      }
      throw new Error('ข้อมูลถูกแก้ไขพร้อมกันหลายครั้ง กรุณาลองใหม่อีกครั้ง');
    } finally { this.busy = false; this.emit('busy'); }
  },

  async publish(message = 'update') {
    const next = buildPublic(this.db, { mask: true });
    if (this.pub && publicKey(this.pub) === publicKey(next)) return false;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        if (!this.pubSha) { const r = await this.gh().readJSON(CONFIG.siteRepo, CONFIG.publicPath); this.pubSha = r.sha; }
        const res = await this.gh().put(CONFIG.siteRepo, CONFIG.publicPath, b64FromText(JSON.stringify(next, null, 1)), this.pubSha, `[public] ${message}`);
        Object.assign(this, { pub: next, pubSha: res.content.sha, pubEtag: null });
        return true;
      } catch (e) {
        if (e.status === 409 || e.status === 422) { this.pubSha = null; continue; }
        throw e;
      }
    }
    return false;
  },

  // อัปโหลดรูปสาธารณะ (โปสเตอร์ทุน/ประกาศ, โลโก้) → repo เว็บไซต์ → คืน URL
  async uploadPublicImage(file, kind = 'posters') {
    const f = kind === 'logo' ? await shrinkImage(file, 512, 'image/png') : await shrinkImage(file);
    const bytes = new Uint8Array(await f.arrayBuffer());
    if (bytes.length > 4 * 1048576) throw new Error('ไฟล์รูปภาพใหญ่เกินไป');
    const ext = (f.name.match(/\.(\w+)$/) || [, 'jpg'])[1].toLowerCase();
    if (this.mode === 'relay') {
      const r = await this.relay({ action: 'uploadPublic', session: this.session.session, kind, ext, data: b64FromBytes(bytes) });
      return r.url;
    }
    const path = `uploads/${kind}/${newId(kind.slice(0, 3))}.${ext}`;
    await this.gh().put(CONFIG.siteRepo, path, b64FromBytes(bytes), undefined, `[upload] ${path}`);
    return `https://raw.githubusercontent.com/${CONFIG.owner}/${CONFIG.siteRepo}/${CONFIG.branch}/${path}`;
  },

  async uploadAppFile(appId, file, idx) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const safe = file.name.replace(/[^\w.\-ก-๙]+/g, '_').slice(-80);
    const path = `${CONFIG.uploadDir}/${appId}/${Date.now().toString(36)}-${idx + 1}-${safe}`;
    await this.gh().put(CONFIG.dbRepo, path, b64FromBytes(bytes), undefined, `[upload] ${appId} ${safe}`);
    return path;
  },

  async openFile(f) {
    let blob;
    if (this.mode === 'relay') {
      const r = await this.relay({ action: 'file', session: this.session.session, path: f.path });
      const bin = atob(r.data); const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      blob = new Blob([arr], { type: f.type || r.type || 'application/octet-stream' });
    } else {
      blob = await this.gh().readBlob(CONFIG.dbRepo, f.path);
      if (f.type) blob = new Blob([blob], { type: f.type });
    }
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  },

  relayUrl() { return (this.pub?.settings?.relayUrl || this.db?.settings?.relayUrl || '').trim(); },

  async relay(payload) {
    const url = this.relayUrl();
    if (!url) throw new Error('ระบบบัญชีผู้ใช้/รับสมัครออนไลน์ยังไม่เปิดใช้งาน (ผู้ดูแลต้องติดตั้ง Relay และตั้งค่า Relay URL)');
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) });
    const j = await r.json();
    if (!j.ok) { const e = new Error(j.error || 'เกิดข้อผิดพลาดจากเซิร์ฟเวอร์'); if (j.code === 401) e.status = 401; throw e; }
    return j;
  },

  async filesPayload(files, onProgress) {
    const out = [];
    for (let i = 0; i < files.length; i++) {
      onProgress?.(`กำลังเตรียมไฟล์ ${i + 1}/${files.length}`);
      const bytes = new Uint8Array(await files[i].file.arrayBuffer());
      out.push({ name: files[i].file.name, label: files[i].label, type: files[i].file.type, size: files[i].file.size, data: b64FromBytes(bytes) });
    }
    return out;
  },

  async submitApplication(application, files, onProgress = () => {}) {
    if (this.mode === 'github') {
      const id = newId('app');
      const stored = [];
      for (let i = 0; i < files.length; i++) {
        onProgress(`กำลังอัปโหลดไฟล์ ${i + 1}/${files.length}`);
        stored.push({ name: files[i].file.name, label: files[i].label, size: files[i].file.size, type: files[i].file.type, path: await this.uploadAppFile(id, files[i].file, i) });
      }
      onProgress('กำลังบันทึกใบสมัคร');
      const app = await this.op('submitApplication', { application, files: stored, id }, 'ใบสมัครใหม่');
      return { id: app.id, code: app.code, application: app };
    }
    const payload = { action: 'submit', application, files: await this.filesPayload(files, onProgress), session: this.session?.session };
    onProgress('กำลังส่งใบสมัครไปยังระบบ');
    const r = await this.relay(payload);
    if (this.session) this.loadPrivate(true).then(() => this.emit('data')).catch(() => {});
    return r;
  },

  async addFiles({ appId, code, studentId }, files, onProgress = () => {}) {
    if (this.mode === 'github') {
      const stored = [];
      for (let i = 0; i < files.length; i++) stored.push({ name: files[i].file.name, label: files[i].label, size: files[i].file.size, type: files[i].file.type, path: await this.uploadAppFile(appId, files[i].file, i) });
      return this.op('addFiles', { appId, files: stored }, 'แนบเอกสารเพิ่มเติม');
    }
    const r = await this.relay({ action: 'addFiles', session: this.session?.session, appId, code, studentId, files: await this.filesPayload(files, onProgress) });
    if (this.session) await this.loadPrivate(true).catch(() => {});
    this.emit('data');
    return r.result;
  },

  async changePassword(oldPw, newPw) {
    if (this.mode === 'github' && this.session.userId) {
      const k = this.db.loginKeys.find((x) => x.userId === this.session.userId);
      try { await openKey(k, oldPw); } catch { throw new Error('รหัสผ่านเดิมไม่ถูกต้อง'); }
      const loginKey = await this.makeLoginKey(this.session.userId, newPw);
      const salt = newSalt();
      await this.op('myProfile', { passwordHash: await hashPassword(newPw, salt), salt, loginKey }, 'เปลี่ยนรหัสผ่าน');
      return;
    }
    if (this.mode !== 'relay') throw new Error('ใช้ได้เฉพาะบัญชีผู้ใช้');
    await this.relay({ action: 'changePassword', session: this.session.session, oldPassword: oldPw, newPassword: newPw });
  },

  async track(code, studentId) {
    code = code.trim().toUpperCase(); studentId = studentId.trim();
    if (this.isStaff) {
      const a = this.db.applications.find((x) => x.code === code && x.student?.studentId === studentId);
      if (!a) throw new Error('ไม่พบใบสมัครที่ตรงกับเลขที่และรหัสนักศึกษา');
      return { ok: true, application: a };
    }
    return this.relay({ action: 'track', code, studentId });
  },
};
