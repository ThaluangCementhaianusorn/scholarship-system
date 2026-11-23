import { CONFIG } from './config.js';
import { GitHub, b64FromText, b64FromBytes } from './github.js';
import { buildPublic, newId, appCode, todayISO } from './model.js';

const LS_TOKEN = 'tl_admin_token';
const ls = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};
const publicKey = (p) => JSON.stringify({ ...p, meta: { ...p.meta, updatedAt: '' } });

export const store = {
  pub: null, pubSha: null, pubEtag: null,
  db: null, dbSha: null, dbEtag: null,
  token: ls.get(LS_TOKEN),
  lastSync: null, busy: false, error: null,
  _listeners: new Set(), _viewCache: null,

  gh() { return new GitHub({ owner: CONFIG.owner, branch: CONFIG.branch, token: this.token }); },
  get isAdmin() { return !!(this.token && this.db); },
  on(fn) { this._listeners.add(fn); return () => this._listeners.delete(fn); },
  emit(reason) { this._listeners.forEach((f) => f(reason)); },

  // ข้อมูลสำหรับแสดงผล: ผู้ดูแลเห็นข้อมูลเต็ม (ไม่ปิดชื่อ) / บุคคลทั่วไปเห็นข้อมูลสาธารณะ
  view() {
    if (this.isAdmin) {
      if (this._viewCache?.db !== this.db) this._viewCache = { db: this.db, v: buildPublic(this.db, { mask: false }) };
      return this._viewCache.v;
    }
    return this.pub;
  },

  async init() {
    await this.loadPublic();
    if (this.token) { try { await this.login(this.token); } catch (e) { console.warn('admin session', e); } }
    setInterval(() => this.refresh(), CONFIG.pollMs);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.refresh(); });
  },

  async refresh() {
    if (document.hidden || this.busy) return;
    try {
      const changed = this.isAdmin ? await this.loadDb() : await this.loadPublic();
      this.error = null;
      if (changed) this.emit('data'); else this.emit('sync');
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
      // สำรอง: อ่านไฟล์จาก GitHub Pages (กรณีติด rate limit ของ API)
      if (this.pub) return false;
      const res = await fetch(`./data/public.json?t=${Date.now()}`);
      this.pub = await res.json();
      this.lastSync = new Date();
      return true;
    }
  },

  async loadDb(force = false) {
    const r = await this.gh().readJSON(CONFIG.dbRepo, CONFIG.dbPath, force ? null : this.dbEtag);
    this.lastSync = new Date();
    if (r.notModified) return false;
    if (r.missing) throw new Error(`ไม่พบไฟล์ ${CONFIG.dbPath} ใน repo ${CONFIG.dbRepo}`);
    Object.assign(this, { db: r.data, dbSha: r.sha, dbEtag: r.etag });
    return true;
  },

  async login(token) {
    const prev = this.token;
    this.token = token.trim();
    try {
      const repo = await this.gh().repo(CONFIG.dbRepo);
      if (!repo.permissions?.push) throw new Error('Token นี้ไม่มีสิทธิ์เขียนฐานข้อมูล (ต้องการสิทธิ์ Contents: Read and write)');
      await this.loadDb(true);
      ls.set(LS_TOKEN, this.token);
      this.emit('auth');
    } catch (e) {
      this.token = prev === token ? null : prev;
      if (!this.token) { ls.del(LS_TOKEN); this.db = null; }
      if (e.status === 401) throw new Error('Token ไม่ถูกต้องหรือหมดอายุ');
      if (e.status === 404) throw new Error(`Token นี้เข้าถึง repo ${CONFIG.owner}/${CONFIG.dbRepo} ไม่ได้`);
      throw e;
    }
  },

  logout() {
    ls.del(LS_TOKEN);
    Object.assign(this, { token: null, db: null, dbSha: null, dbEtag: null });
    this.emit('auth');
  },

  // แก้ไขฐานข้อมูลแบบ atomic: โหลดล่าสุด → แก้ → commit (ถ้าชนกันจะ retry อัตโนมัติ)
  async mutate(fn, message) {
    if (!this.isAdmin) throw new Error('กรุณาเข้าสู่ระบบผู้ดูแลก่อน');
    this.busy = true; this.emit('busy');
    try {
      for (let attempt = 0; attempt < 4; attempt++) {
        const draft = structuredClone(this.db);
        const result = fn(draft);
        draft.meta = { ...(draft.meta || {}), updatedAt: new Date().toISOString() };
        try {
          const res = await this.gh().put(CONFIG.dbRepo, CONFIG.dbPath, b64FromText(JSON.stringify(draft, null, 1)), this.dbSha, `[db] ${message}`);
          Object.assign(this, { db: draft, dbSha: res.content.sha, dbEtag: null });
          await this.publish(message);
          this.emit('data');
          return result;
        } catch (e) {
          if (e.status === 409 || e.status === 422) { await this.loadDb(true); continue; }
          throw e;
        }
      }
      throw new Error('ข้อมูลถูกแก้ไขพร้อมกันหลายครั้ง กรุณาลองใหม่อีกครั้ง');
    } finally { this.busy = false; this.emit('busy'); }
  },

  // เผยแพร่ข้อมูลสาธารณะ (data/public.json) ไปยัง repo เว็บไซต์
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

  async uploadFile(appId, file, idx) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const safe = file.name.replace(/[^\w.\-ก-๙]+/g, '_').slice(-80);
    const path = `${CONFIG.uploadDir}/${appId}/${idx + 1}-${safe}`;
    await this.gh().put(CONFIG.dbRepo, path, b64FromBytes(bytes), undefined, `[upload] ${appId} ${safe}`);
    return path;
  },

  async openFile(path, type) {
    const blob = await this.gh().readBlob(CONFIG.dbRepo, path);
    const url = URL.createObjectURL(type ? new Blob([blob], { type }) : blob);
    window.open(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  },

  relayUrl() { return (this.view()?.settings?.relayUrl || '').trim(); },

  async relay(payload) {
    const url = this.relayUrl();
    if (!url) throw new Error('ระบบรับใบสมัครออนไลน์ยังไม่ได้เปิดใช้งาน (ผู้ดูแลต้องตั้งค่า Relay URL)');
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) });
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || 'เกิดข้อผิดพลาดจากเซิร์ฟเวอร์');
    return j;
  },

  // ยื่นใบสมัคร: ผู้ดูแล → commit ตรง / นักศึกษา → ผ่าน Relay (Google Apps Script) ที่ถือ token ฝั่งเซิร์ฟเวอร์
  async submitApplication(application, files, onProgress = () => {}) {
    if (this.isAdmin) {
      const id = newId('app');
      const s = this.db.scholarships.find((x) => x.id === application.scholarshipId);
      const code = appCode(s?.year || application.year);
      const stored = [];
      for (let i = 0; i < files.length; i++) {
        onProgress(`กำลังอัปโหลดไฟล์ ${i + 1}/${files.length}`);
        stored.push({ name: files[i].file.name, label: files[i].label, size: files[i].file.size, type: files[i].file.type, path: await this.uploadFile(id, files[i].file, i) });
      }
      onProgress('กำลังบันทึกใบสมัคร');
      const app = { ...application, id, code, year: s?.year, files: stored, status: 'submitted', submittedAt: new Date().toISOString(), history: [{ at: new Date().toISOString(), status: 'submitted', by: 'เจ้าหน้าที่', note: 'บันทึกโดยเจ้าหน้าที่' }] };
      await this.mutate((db) => { db.applications.push(app); }, `ใบสมัครใหม่ ${code}`);
      return { id, code, application: app };
    }
    const payload = { action: 'submit', application, files: [] };
    for (let i = 0; i < files.length; i++) {
      onProgress(`กำลังเตรียมไฟล์ ${i + 1}/${files.length}`);
      const bytes = new Uint8Array(await files[i].file.arrayBuffer());
      payload.files.push({ name: files[i].file.name, label: files[i].label, type: files[i].file.type, size: files[i].file.size, data: b64FromBytes(bytes) });
    }
    onProgress('กำลังส่งใบสมัครไปยังระบบ');
    return this.relay(payload);
  },

  async track(code, studentId) {
    code = code.trim().toUpperCase(); studentId = studentId.trim();
    if (this.isAdmin) {
      const a = this.db.applications.find((x) => x.code === code && x.student?.studentId === studentId);
      if (!a) throw new Error('ไม่พบใบสมัครที่ตรงกับเลขที่และรหัสนักศึกษา');
      return { ok: true, application: a };
    }
    return this.relay({ action: 'track', code, studentId });
  },
};

export { todayISO };
