// ชุดเครื่องมือ UI: escape, รูปแบบตัวเลข/วันที่, ไอคอน, modal, toast, ฟอร์ม
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const num = (n) => Number(n || 0).toLocaleString('th-TH');
export const baht = (n) => `${num(n)} บาท`;
export const shortBaht = (n) => {
  n = Number(n || 0);
  if (n >= 1e6) return `${(n / 1e6).toLocaleString('th-TH', { maximumFractionDigits: 2 })} ล้าน`;
  if (n >= 1e4) return `${(n / 1e3).toLocaleString('th-TH', { maximumFractionDigits: 1 })} พัน`;
  return num(n);
};
export function thDate(iso, opts = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!iso) return '-';
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  return isNaN(d) ? esc(iso) : d.toLocaleDateString('th-TH', opts);
}
export const thDateTime = (iso) => (iso ? new Date(iso).toLocaleString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-');
export function daysLeft(iso) {
  if (!iso) return null;
  const d = new Date(`${iso}T23:59:59`) - new Date();
  return Math.ceil(d / 86400000);
}
export const fileSize = (b) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

const P = {
  dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  award: '<circle cx="12" cy="8" r="6"/><path d="M15.5 13.5 17 22l-5-3-5 3 1.5-8.5"/>',
  megaphone: '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
  building: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>',
  filePlus: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M12 18v-6M9 15h6"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  printer: '<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  alert: '<path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3zM12 9v4M12 17h.01"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  send: '<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  trash: '<path d="M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  refresh: '<path d="M21 12a9 9 0 0 1-15 6.7L3 16M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M3 21v-5h5"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  chart: '<path d="M3 3v18h18"/><path d="M7 16V9M12 16V5M17 16v-4"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  pin: '<path d="M12 17v5M9 10.8V4h6v6.8l3 3.2H6z"/>',
  wallet: '<path d="M20 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h15v4M20 17v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5"/><path d="M22 11h-6a2 2 0 0 0 0 4h6z"/>',
  graduation: '<path d="M22 10 12 5 2 10l10 5 10-5z"/><path d="M6 12v5c3 2 9 2 12 0v-5"/>',
  trophy: '<path d="M6 9H4a2 2 0 0 1 0-4h2M18 9h2a2 2 0 0 0 0-4h-2M4 22h16M10 14.7V17c0 .6-.5 1-1 1.2C7.8 18.8 7 20.2 7 22M14 14.7V17c0 .6.5 1 1 1.2 1.2.6 2 2 2 3.8M18 2H6v7a6 6 0 0 0 12 0z"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20z"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
  paperclip: '<path d="m21.4 11-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5"/>',
  database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5M3 12c0 1.7 4 3 9 3s9-1.3 9-3"/>',
  arrowRight: '<path d="M5 12h14M12 5l7 7-7 7"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
  qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3"/>',
  pen: '<path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.6 7.6"/><circle cx="11" cy="11" r="2"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  tag: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z"/><circle cx="7" cy="7" r="1.5"/>',
  clipboard: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>',
};
export const icon = (name, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;

export function badge(label, tone = 'neutral', ic) {
  return `<span class="badge tone-${tone}">${ic ? icon(ic) : ''}${esc(label)}</span>`;
}

// ---------- toast ----------
export function toast(msg, tone = 'good') {
  let host = $('#toasts');
  if (!host) { host = document.createElement('div'); host.id = 'toasts'; document.body.append(host); }
  const el = document.createElement('div');
  el.className = `toast tone-${tone}`;
  el.innerHTML = `${icon(tone === 'critical' ? 'alert' : tone === 'warning' ? 'alert' : 'check')}<span>${esc(msg)}</span>`;
  host.append(el);
  setTimeout(() => el.classList.add('out'), 3600);
  setTimeout(() => el.remove(), 4000);
}

// ---------- modal ----------
export function modal({ title, body, size = 'md', actions = '', onMount }) {
  const wrap = document.createElement('div');
  wrap.className = 'modal-wrap';
  wrap.innerHTML = `<div class="modal modal-${size}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <header class="modal-head"><h3>${esc(title)}</h3><button class="icon-btn" data-close aria-label="ปิด">${icon('x')}</button></header>
    <div class="modal-body">${body}</div>
    ${actions ? `<footer class="modal-foot">${actions}</footer>` : ''}
  </div>`;
  const close = () => {
    wrap.classList.add('out'); document.removeEventListener('keydown', onKey);
    setTimeout(() => { wrap.remove(); window.dispatchEvent(new Event('modalclosed')); }, 160);
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  wrap.addEventListener('click', (e) => { if (e.target === wrap || e.target.closest('[data-close]')) close(); });
  document.addEventListener('keydown', onKey);
  document.body.append(wrap);
  const api = { el: wrap, close };
  onMount?.(wrap, api);
  return api;
}
export const modalOpen = () => !!$('.modal-wrap');

export function confirmBox(message, { okText = 'ยืนยัน', tone = 'primary' } = {}) {
  return new Promise((resolve) => {
    let done = false;
    const m = modal({
      title: 'ยืนยันการทำรายการ', size: 'sm', body: `<p>${esc(message)}</p>`,
      actions: `<button class="btn ghost" data-close>ยกเลิก</button><button class="btn ${tone}" data-ok>${esc(okText)}</button>`,
      onMount: (el, api) => el.querySelector('[data-ok]').onclick = () => { done = true; resolve(true); api.close(); },
    });
    const obs = new MutationObserver(() => { if (!document.body.contains(m.el)) { obs.disconnect(); if (!done) resolve(false); } });
    obs.observe(document.body, { childList: true });
  });
}

// ---------- form builder ----------
// field: { name, label, type: text|number|email|date|textarea|select|chips|lines|checkbox, options:[{value,label}], required, placeholder, hint, span }
export function field(f, v) {
  const id = `f_${f.name}`;
  const req = f.required ? 'required' : '';
  const ph = f.placeholder ? `placeholder="${esc(f.placeholder)}"` : '';
  let input;
  switch (f.type) {
    case 'textarea': input = `<textarea id="${id}" name="${f.name}" rows="${f.rows || 3}" ${req} ${ph}>${esc(v)}</textarea>`; break;
    case 'lines': input = `<textarea id="${id}" name="${f.name}" rows="${f.rows || 4}" ${ph}>${esc((v || []).join('\n'))}</textarea>`; break;
    case 'select': input = `<select id="${id}" name="${f.name}" ${req}>${f.empty !== undefined ? `<option value="">${esc(f.empty)}</option>` : ''}${f.options.map((o) => `<option value="${esc(o.value)}" ${String(o.value) === String(v ?? '') ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select>`; break;
    case 'chips': input = `<div class="chips" id="${id}">${f.options.map((o) => `<label class="chip"><input type="checkbox" name="${f.name}" value="${esc(o.value)}" ${(v || []).includes(o.value) ? 'checked' : ''}><span>${esc(o.label)}</span></label>`).join('')}</div>`; break;
    case 'image': input = `<div class="img-field"><input type="hidden" name="${f.name}" value="${esc(v)}"><div class="img-prev">${v ? `<img src="${esc(v)}" alt="">` : icon('image')}</div><div class="img-actions"><label class="btn ghost sm">${icon('upload')} เลือกรูปภาพ<input type="file" accept="image/png,image/jpeg,image/webp" hidden></label><button type="button" class="btn ghost sm" data-clear ${v ? '' : 'hidden'}>${icon('trash')} ลบรูป</button><small class="hint">${esc(f.hint || 'JPG/PNG ระบบจะย่อขนาดให้อัตโนมัติ')}</small></div></div>`; f = { ...f, hint: '' }; break;
    case 'checkbox': input = `<label class="switch"><input type="checkbox" id="${id}" name="${f.name}" ${v ? 'checked' : ''}><span>${esc(f.text || '')}</span></label>`; break;
    default: input = `<input id="${id}" name="${f.name}" type="${f.type || 'text'}" value="${esc(v)}" ${req} ${ph} ${f.step ? `step="${f.step}"` : ''} ${f.min !== undefined ? `min="${f.min}"` : ''} ${f.max !== undefined ? `max="${f.max}"` : ''} ${f.pattern ? `pattern="${f.pattern}"` : ''} ${f.inputmode ? `inputmode="${f.inputmode}"` : ''}>`;
  }
  return `<div class="field ${f.span ? `span-${f.span}` : ''}"><label for="${id}">${esc(f.label)}${f.required ? ' <b class="req">*</b>' : ''}</label>${input}${f.hint ? `<small class="hint">${esc(f.hint)}</small>` : ''}</div>`;
}
export const formGrid = (fields, obj = {}) => `<div class="form-grid">${fields.map((f) => field(f, obj[f.name])).join('')}</div>`;
export function readForm(form, fields) {
  const out = {};
  for (const f of fields) {
    if (f.type === 'chips') out[f.name] = $$(`input[name="${f.name}"]:checked`, form).map((i) => i.value);
    else if (f.type === 'checkbox') out[f.name] = form.elements[f.name].checked;
    else if (f.type === 'lines') out[f.name] = form.elements[f.name].value.split('\n').map((s) => s.trim()).filter(Boolean);
    else if (f.type === 'number') out[f.name] = form.elements[f.name].value === '' ? '' : Number(form.elements[f.name].value);
    else out[f.name] = form.elements[f.name].value.trim();
  }
  return out;
}

// ผูกช่องอัปโหลดรูปภาพในฟอร์ม: uploader(file) => Promise<url>
export function bindImageFields(root, uploader) {
  $$('.img-field', root).forEach((box) => {
    const hidden = $('input[type=hidden]', box); const file = $('input[type=file]', box); const prev = $('.img-prev', box); const clr = $('[data-clear]', box);
    file.onchange = async () => {
      const f = file.files[0]; if (!f) return;
      prev.innerHTML = `<div class="spinner sm"></div>`;
      try { const url = await uploader(f); hidden.value = url; prev.innerHTML = `<img src="${esc(url)}" alt="">`; clr.hidden = false; toast('อัปโหลดรูปภาพแล้ว'); }
      catch (e) { prev.innerHTML = hidden.value ? `<img src="${esc(hidden.value)}" alt="">` : icon('image'); toast(e.message, 'critical'); }
      file.value = '';
    };
    clr.onclick = () => { hidden.value = ''; prev.innerHTML = icon('image'); clr.hidden = true; };
  });
}

// QR Code → data URL (ใช้ไลบรารี qrcodejs)
export function qrDataUrl(text, size = 240) {
  if (!window.QRCode) return '';
  const div = document.createElement('div');
  new window.QRCode(div, { text, width: size, height: size, colorDark: '#0b1530', colorLight: '#ffffff', correctLevel: window.QRCode.CorrectLevel.M });
  const c = div.querySelector('canvas');
  return c ? c.toDataURL('image/png') : (div.querySelector('img')?.src || '');
}
export const applyUrl = (id) => `${location.origin}${location.pathname}#/apply/${id}`;

// แผ่นลงลายมือชื่อ (signature pad)
export function signaturePad(canvas) {
  const ctx = canvas.getContext('2d');
  const ratio = Math.max(1, window.devicePixelRatio || 1);
  const fit = () => { const r = canvas.getBoundingClientRect(); canvas.width = r.width * ratio; canvas.height = r.height * ratio; ctx.scale(ratio, ratio); ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#0b1f6b'; };
  fit();
  let drawing = false; let dirty = false; let last = null;
  const pos = (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  canvas.addEventListener('pointerdown', (e) => { drawing = true; last = pos(e); canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => { if (!drawing) return; const p = pos(e); ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke(); last = p; dirty = true; });
  const end = () => { drawing = false; };
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
  return {
    clear() { ctx.clearRect(0, 0, canvas.width, canvas.height); dirty = false; },
    isEmpty: () => !dirty,
    // ตัดขอบว่างให้พอดีลายเซ็น
    toDataURL() {
      const { width: w, height: h } = canvas; const d = ctx.getImageData(0, 0, w, h).data;
      let x0 = w, y0 = h, x1 = 0, y1 = 0;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3]) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
      if (x1 <= x0) return '';
      const pad = 8 * ratio; x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(w, x1 + pad); y1 = Math.min(h, y1 + pad);
      const k = Math.min(1, 600 / (x1 - x0));
      const out = Object.assign(document.createElement('canvas'), { width: Math.round((x1 - x0) * k), height: Math.round((y1 - y0) * k) });
      out.getContext('2d').drawImage(canvas, x0, y0, x1 - x0, y1 - y0, 0, 0, out.width, out.height);
      return out.toDataURL('image/png');
    },
  };
}

export function empty(text, ic = 'search') {
  return `<div class="empty">${icon(ic)}<p>${esc(text)}</p></div>`;
}
