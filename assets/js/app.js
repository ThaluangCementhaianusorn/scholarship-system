import { $, esc, icon, toast, modalOpen, thDateTime, empty } from './ui.js';
import { store } from './store.js';
import { destroyAll } from './charts.js';
import { ROLES } from './model.js';
import * as P from './pages.js';
import * as A from './admin.js';

const ROUTES = {
  '': P.dashboard, scholarships: P.scholarships, announcements: P.announcements, sponsors: P.sponsors,
  recipients: P.recipients, apply: P.apply, track: P.track, qr: P.qr, login: A.login, my: P.my, account: P.account,
  admin: A.overview, 'admin/applications': A.applications, 'admin/scholarships': A.adminScholarships,
  'admin/recipients': A.adminRecipients, 'admin/sponsors': A.adminSponsors, 'admin/announcements': A.adminAnnouncements,
  'admin/reports': A.reports, 'admin/settings': A.settings,
};
const NAV = [
  ['', 'แดชบอร์ด', 'dashboard'], ['scholarships', 'ทุนการศึกษา', 'award'], ['announcements', 'ประกาศประชาสัมพันธ์', 'megaphone'],
  ['recipients', 'ผู้ได้รับทุน', 'users'], ['sponsors', 'แหล่งทุน / ผู้สนับสนุน', 'building'], ['qr', 'QR Code สมัครทุน', 'qr'], ['track', 'ติดตามสถานะใบสมัคร', 'search'],
];

function parse() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  for (let n = Math.min(parts.length, 2); n >= 0; n--) {
    const key = parts.slice(0, n).join('/');
    if (ROUTES[key]) return { key, page: ROUTES[key], params: parts.slice(n) };
  }
  return { key: '', page: P.dashboard, params: [] };
}

const denied = { title: 'ไม่มีสิทธิ์เข้าถึง', render: () => `<div class="card">${empty('บัญชีของคุณไม่มีสิทธิ์เข้าถึงหน้านี้', 'shield')}<div class="center"><a class="btn primary" href="#/">กลับหน้าแรก</a></div></div>` };

let current = null; let pending = false;
function render({ keepScroll = false } = {}) {
  const r = parse();
  let { page } = r;
  if (page.admin && !store.isStaff) page = store.session ? denied : A.login;
  else if (page.admin && !store.can(page.admin)) page = denied;
  else if ((page.student && !store.isStudent) || (page.auth && !store.session)) page = A.login;
  else if (page === A.login && store.session) page = store.isStudent ? P.my : A.overview;
  const v = store.view();
  const el = $('#view');
  if (!v) { el.innerHTML = '<div class="loading"><div class="spinner"></div><p>กำลังโหลดข้อมูล...</p></div>'; return; }
  const y = window.scrollY;
  destroyAll();
  el.innerHTML = page.render(v, r.params);
  page.mount?.(el, v, r.params);
  current = { ...r, page };
  document.title = `${page.title} · ${v.institution?.systemTitle || 'TL Scholarship'}`;
  drawChrome(r.key, v);
  if (keepScroll) window.scrollTo(0, y);
}

function drawChrome(key, v) {
  const isActive = (k) => key === k || (k === 'admin/settings' && key.startsWith('admin/settings'));
  const link = ([k, l, ic]) => `<a href="#/${k}" class="${isActive(k) ? 'active' : ''}">${icon(ic)}<span>${l}</span></a>`;
  const logo = v.institution?.logo || 'assets/img/logo.png';
  document.querySelectorAll('.brand-logo').forEach((img) => { if (img.getAttribute('src') !== logo) img.src = logo; });
  $('#brandName').textContent = v.institution?.schoolName || '';
  let personal = '';
  if (store.isStaff) personal = `<div class="nav-label">งานทุนการศึกษา (บุคลากร)</div><div class="nav-group">${A.adminTabs().map(([k, l, ic]) => link([`admin${k ? `/${k}` : ''}`, l, ic])).join('')}</div>`;
  if (store.isStudent) personal = `<div class="nav-label">นักเรียน นักศึกษา</div><div class="nav-group">${link(['my', 'ใบสมัครของฉัน', 'file'])}</div>`;
  if (store.session) personal += `<div class="nav-group">${link(['account', 'บัญชีของฉัน', 'user'])}</div>`;
  $('#nav').innerHTML = `<div class="nav-group">${NAV.map(link).join('')}</div>${personal}`;
  // แถบเมนูลัดด้านล่าง (มือถือ / จอแนวตั้ง)
  const mine = store.isStaff ? ['admin', 'งานทุน', 'clipboard'] : store.isStudent ? ['my', 'ใบสมัคร', 'file'] : ['track', 'ติดตาม', 'search'];
  const tabs = [['', 'หน้าแรก', 'dashboard'], ['scholarships', 'ทุน', 'award'], ['announcements', 'ประกาศ', 'megaphone'], mine];
  const tabActive = (k) => (k === 'admin' ? key.startsWith('admin') : isActive(k));
  $('#tabbar').innerHTML = tabs.map(([k, l, ic]) => `<a href="#/${k}" class="${tabActive(k) ? 'active' : ''}"${tabActive(k) ? ' aria-current="page"' : ''}>${icon(ic)}<span>${l}</span></a>`).join('')
    + `<button type="button" id="tabMenu" aria-label="เมนูทั้งหมด">${icon('menu')}<span>เมนู</span></button>`;
  $('#tabMenu').onclick = () => document.body.classList.toggle('nav-open');
  const u = store.user;
  $('#userBox').innerHTML = u
    ? `<div class="user-chip"><div class="avatar sm">${icon('user')}</div><div><b>${esc(u.name)}</b><small>${esc(ROLES[u.role]?.label || '')}</small></div><button class="icon-btn" id="logoutBtn" aria-label="ออกจากระบบ" title="ออกจากระบบ">${icon('logout')}</button></div>`
    : `<a class="btn ghost block" href="#/login">${icon('user')}<span>เข้าสู่ระบบ</span></a>`;
  $('#logoutBtn')?.addEventListener('click', () => { store.logout(); toast('ออกจากระบบแล้ว'); location.hash = '#/'; });
  $('#applyCta').hidden = store.isStaff;
  const top = $('#topLogin');
  if (top) top.hidden = !!store.session || key === 'login';
}

function drawSync() {
  const el = $('#sync');
  if (store.busy) { el.className = 'sync busy'; el.innerHTML = `${icon('refresh', 'spin')}<span>กำลังบันทึก...</span>`; return; }
  if (store.error) { el.className = 'sync err'; el.innerHTML = `<i></i><span>ออฟไลน์ · ${esc(store.error)}</span>`; return; }
  el.className = 'sync ok';
  el.innerHTML = `<i></i><span>เรียลไทม์ · ${store.lastSync ? thDateTime(store.lastSync.toISOString()) : '-'}</span>`;
  el.title = 'ซิงก์ข้อมูลอัตโนมัติทุก 30 วินาที';
}

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
