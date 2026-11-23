import { $, $$, esc, icon, toast, modalOpen, thDateTime } from './ui.js';
import { store } from './store.js';
import { destroyAll } from './charts.js';
import * as P from './pages.js';
import * as A from './admin.js';

const ROUTES = {
  '': P.dashboard, scholarships: P.scholarships, announcements: P.announcements, sponsors: P.sponsors,
  recipients: P.recipients, apply: P.apply, track: P.track, login: A.login,
  admin: A.overview, 'admin/applications': A.applications, 'admin/scholarships': A.adminScholarships,
  'admin/recipients': A.adminRecipients, 'admin/sponsors': A.adminSponsors, 'admin/announcements': A.adminAnnouncements,
  'admin/reports': A.reports, 'admin/settings': A.settings,
};
const NAV = [
  ['', 'แดชบอร์ด', 'dashboard'], ['scholarships', 'ทุนการศึกษา', 'award'], ['announcements', 'ประกาศประชาสัมพันธ์', 'megaphone'],
  ['recipients', 'ผู้ได้รับทุน', 'users'], ['sponsors', 'แหล่งทุน / ผู้สนับสนุน', 'building'], ['track', 'ติดตามสถานะใบสมัคร', 'search'],
];
const ADMIN_NAV = [['admin', 'ภาพรวมผู้ดูแล', 'shield'], ['admin/applications', 'จัดการใบสมัคร', 'file'], ['admin/scholarships', 'จัดการทุน', 'award'], ['admin/reports', 'รายงาน PDF', 'printer'], ['admin/settings', 'ตั้งค่าระบบ', 'settings']];

function parse() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  for (let n = Math.min(parts.length, 2); n >= 0; n--) {
    const key = parts.slice(0, n).join('/');
    if (ROUTES[key]) return { key, page: ROUTES[key], params: parts.slice(n) };
  }
  return { key: '', page: P.dashboard, params: [] };
}

let current = null; let pending = false;
function render({ keepScroll = false } = {}) {
  const r = parse();
  let { page } = r;
  if (page.admin && !store.isAdmin) page = A.login;
  else if (page === A.login && store.isAdmin) page = A.overview;
  const v = store.view();
  const el = $('#view');
  if (!v) { el.innerHTML = '<div class="loading"><div class="spinner"></div><p>กำลังโหลดข้อมูล...</p></div>'; return; }
  const y = window.scrollY;
  destroyAll();
  el.innerHTML = page.render(v, r.params);
  page.mount?.(el, v, r.params);
  current = { ...r, page };
  document.title = `${page.title} · ${v.institution?.systemTitle || 'TL Scholarship'}`;
  drawNav(r.key);
  if (keepScroll) window.scrollTo(0, y);
}

function drawNav(key) {
  const v = store.view();
  const link = ([k, l, ic]) => `<a href="#/${k}" class="${(key === k || (k && key.startsWith(`${k}/`) && k !== 'admin')) || (k === 'admin' && key === 'admin') ? 'active' : ''}">${icon(ic)}<span>${l}</span></a>`;
  $('#brandName').textContent = v?.institution?.schoolName || '';
  $('#nav').innerHTML = `<div class="nav-group">${NAV.map(link).join('')}</div>
    ${store.isAdmin ? `<div class="nav-label">ผู้ดูแลระบบ</div><div class="nav-group">${ADMIN_NAV.map(link).join('')}</div>` : ''}`;
  $('#adminBtn').innerHTML = store.isAdmin ? `${icon('logout')}<span>ออกจากระบบ</span>` : `${icon('shield')}<span>ผู้ดูแลระบบ</span>`;
  $('#applyCta').hidden = store.isAdmin;
}

function drawSync() {
  const el = $('#sync');
  if (store.busy) { el.className = 'sync busy'; el.innerHTML = `${icon('refresh', 'spin')}<span>กำลังบันทึกลง GitHub...</span>`; return; }
  if (store.error) { el.className = 'sync err'; el.innerHTML = `<i></i><span>ออฟไลน์ · ${esc(store.error)}</span>`; return; }
  el.className = 'sync ok';
  el.innerHTML = `<i></i><span>เรียลไทม์ · ${store.lastSync ? thDateTime(store.lastSync.toISOString()) : '-'}</span>`;
  el.title = store.isAdmin ? 'เชื่อมต่อฐานข้อมูล GitHub (ผู้ดูแล)' : 'ซิงก์ข้อมูลอัตโนมัติทุก 30 วินาที';
}

// ---------- theme ----------
function theme(next) {
  const root = document.documentElement;
  if (next) { root.dataset.theme = next; try { localStorage.setItem('tl_theme', next); } catch {} }
  const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  $('#themeBtn').innerHTML = icon(dark ? 'sun' : 'moon');
  $('#themeBtn').setAttribute('aria-label', dark ? 'โหมดสว่าง' : 'โหมดมืด');
  return dark;
}

function boot() {
  try { const t = localStorage.getItem('tl_theme'); if (t) document.documentElement.dataset.theme = t; } catch {}
  theme();
  $('#themeBtn').onclick = () => { const dark = theme(); theme(dark ? 'light' : 'dark'); render({ keepScroll: true }); };
  $('#menuBtn').onclick = () => document.body.classList.toggle('nav-open');
  $('#scrim').onclick = () => document.body.classList.remove('nav-open');
  $('#adminBtn').onclick = () => { if (store.isAdmin) { store.logout(); toast('ออกจากระบบแล้ว'); location.hash = '#/'; } else location.hash = '#/login'; };
  window.addEventListener('hashchange', () => { document.body.classList.remove('nav-open'); render(); window.scrollTo(0, 0); });
  window.addEventListener('rerender', () => render({ keepScroll: true }));
  window.addEventListener('modalclosed', () => { if (pending && !modalOpen()) { pending = false; render({ keepScroll: true }); } });
  store.on((reason) => {
    drawSync();
    if (reason === 'auth') render();
    if (reason === 'data' && current?.page.live) { if (modalOpen()) pending = true; else render({ keepScroll: true }); }
  });
  render();
  store.init().then(() => { render(); drawSync(); }).catch((e) => {
    $('#view').innerHTML = `<div class="notice tone-critical">${icon('alert')}<div><b>โหลดข้อมูลไม่สำเร็จ</b><p>${esc(e.message)}</p></div></div>`;
  });
}
boot();
