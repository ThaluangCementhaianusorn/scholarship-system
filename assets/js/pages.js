// หน้าสาธารณะ: แดชบอร์ด, ทุน, ประกาศ, แหล่งทุน, ผู้รับทุน, QR, สมัครทุน, ติดตามสถานะ, ใบสมัครของฉัน, บัญชีของฉัน
import { $, $$, esc, num, baht, thDate, thDateTime, daysLeft, fileSize, icon, badge, toast, modal, confirmBox, empty, field, qrDataUrl, applyUrl, signaturePad } from './ui.js';
import { LEVELS, CLASS_YEARS, TYPES, STATUS, STAGES, ROLES, SCHOLARSHIP_STATUS, PREFIXES, stats, years, isOpen, eligibility } from './model.js';
import { yearlyStacked, rankBars } from './charts.js';
import { printApplication, printReport, printScholarshipPoster } from './print.js';
import { store } from './store.js';
import { CONFIG } from './config.js';

const deptOpts = (v) => v.departments.map((d) => ({ value: d.id, label: d.name }));
const deptName = (v, id) => v.departments.find((d) => d.id === id)?.name || '-';
const sponsor = (v, id) => v.sponsors.find((s) => s.id === id) || {};
const catName = (v, id) => (v.categories || []).find((c) => c.id === id)?.name || '';
const opt = (value, label, cur) => `<option value="${esc(value)}" ${String(cur) === String(value) ? 'selected' : ''}>${esc(label)}</option>`;
const yearSelect = (v, cur, id = 'yearSel', cls = '') => `<select id="${id}" class="${cls}" aria-label="ปีการศึกษา">${opt('', 'ทุกปีการศึกษา', cur)}${years(v).map((y) => opt(y, `ปีการศึกษา ${y}`, cur)).join('')}</select>`;
const catSelect = (v, cur, id = 'fCat', cls = '') => `<select id="${id}" class="${cls}" aria-label="ประเภททุน">${opt('', 'ทุกประเภททุน', cur)}${(v.categories || []).map((c) => opt(c.id, c.name, cur)).join('')}</select>`;
const rerender = () => window.dispatchEvent(new Event('rerender'));

export function deadlineBadge(s) {
  if (!isOpen(s)) return badge(SCHOLARSHIP_STATUS[s.status === 'open' ? 'closed' : s.status]?.label || 'ปิดรับสมัคร', 'neutral');
  const d = daysLeft(s.deadline);
  if (d === null) return badge('เปิดรับสมัคร', 'good', 'check');
  return d <= 7 ? badge(`เหลือ ${d} วัน`, 'warning', 'clock') : badge(`เปิดรับถึง ${thDate(s.deadline)}`, 'good', 'clock');
}

// ======================= DASHBOARD =======================
const dash = { year: null, cat: '' };
export const dashboard = {
  title: 'แดชบอร์ด', live: true,
  render(v) {
    if (dash.year === null) dash.year = years(v).includes(String(v.institution?.academicYear)) ? String(v.institution.academicYear) : '';
    const s = stats(v, dash.year, { categoryId: dash.cat });
    const extPct = s.total ? Math.round((s.extAmount / s.total) * 100) : 0;
    const open = v.scholarships.filter((x) => isOpen(x)).sort((a, b) => (a.deadline || '').localeCompare(b.deadline || ''));
    const ann = [...v.announcements].sort((a, b) => (b.pinned - a.pinned) || (b.date || '').localeCompare(a.date || '')).slice(0, 3);
    const lvlTotal = s.byLevel.reduce((t, l) => t + l.count, 0) || 1;
    const off = (v.officials || {})[dash.year || v.institution?.academicYear];
    const catMax = Math.max(1, ...s.byCategory.map((c) => c.amount));
    return `
    <section class="hero">
      <img class="hero-logo" src="${esc(v.institution?.logo || 'assets/img/logo.png')}" alt="ตราสัญลักษณ์วิทยาลัย">
      <div class="hero-text">
        <span class="eyebrow">${esc(v.institution?.schoolName)}</span>
        <h1>${esc(v.institution?.systemTitle || 'TL Scholarship Management Dashboard')}</h1>
        <p>${esc(v.institution?.subtitle || 'ระบบสารสนเทศเพื่อการบริหารจัดการและสรุปผลทุนการศึกษา')}</p>
      </div>
      <div class="hero-actions">
        ${yearSelect(v, dash.year, 'yearSel', 'select-pill')}
        ${catSelect(v, dash.cat, 'catSel', 'select-pill')}
        <button class="btn ghost" data-print="summary">${icon('printer')} รายงาน PDF</button>
        <a class="btn primary" href="#/scholarships">${icon('award')} ทุนที่เปิดรับ <span class="pill">${open.length}</span></a>
      </div>
    </section>

    <section class="kpis">
      ${kpi('wallet', 'งบประมาณทุนรวม', num(s.total), 'บาท', dash.year ? `ปีการศึกษา ${dash.year}` : 'ทุกปีการศึกษา')}
      ${kpi('award', 'จำนวนทุนที่มอบ', num(s.count), 'ทุน', `ผู้รับทุน ${num(s.students)} คน`)}
      ${kpi('building', 'ทุนจากหน่วยงานภายนอก', num(s.extAmount), 'บาท', `${num(s.extCount)} ทุน · ${extPct}% ของงบทั้งหมด`)}
      ${kpi('users', 'แหล่งทุนที่สนับสนุน', num(s.sponsorsActive), 'แห่ง', `ในฐานข้อมูล ${num(v.sponsors.length)} แห่ง`)}
      ${kpi('filePlus', 'ทุนที่เปิดรับขณะนี้', num(open.length), 'ทุน', `รวมโควตา ${num(open.reduce((t, x) => t + (Number(x.quota) || 0), 0))} ทุน`)}
    </section>

    <section class="grid g-3-2">
      <article class="card">
        <header class="card-head"><div><h3>งบประมาณทุนการศึกษารายปี</h3><p>แยกตามแหล่งทุนภายนอกและภายในสถานศึกษา (บาท)</p></div>
          <div class="legend"><span><i style="background:var(--s1)"></i>หน่วยงานภายนอก</span><span><i style="background:var(--s2)"></i>ภายในสถานศึกษา</span></div></header>
        <div class="chart h-280"><canvas id="cYear" role="img" aria-label="กราฟงบประมาณทุนรายปี"></canvas></div>
      </article>
      <article class="card">
        <header class="card-head"><div><h3>สัดส่วนงบประมาณ</h3><p>${dash.year ? `ปีการศึกษา ${esc(dash.year)}` : 'ทุกปีการศึกษา'}</p></div></header>
        <div class="split">
          <div class="split-row"><span>หน่วยงานภายนอก</span><b>${num(s.extAmount)} บาท</b></div>
          <div class="seg"><i style="width:${extPct}%;background:var(--s1)"></i><i style="width:${100 - extPct}%;background:var(--s2)"></i></div>
          <div class="split-row muted"><span>${extPct}% ภายนอก</span><span>${100 - extPct}% ภายใน</span></div>
          <div class="split-row"><span>ภายในสถานศึกษา</span><b>${num(s.intAmount)} บาท</b></div>
        </div>
        <div class="divider"></div>
        <h4 class="mini-title">ผู้รับทุนตามระดับชั้น</h4>
        ${s.byLevel.map((l) => `<div class="meter"><div class="meter-top"><span>${l.level}</span><span>${num(l.count)} ทุน · ${num(l.amount)} บาท</span></div><div class="meter-bar"><i style="width:${(l.count / lvlTotal) * 100}%"></i></div></div>`).join('')}
      </article>
    </section>

    <section class="grid g-2">
      <article class="card">
        <header class="card-head"><div><h3>${icon('trophy')} จัดอันดับแผนกวิชา</h3><p>ยอดเงินทุนที่นักศึกษาในแต่ละแผนกได้รับ</p></div></header>
        <div class="chart" style="height:${Math.max(200, s.byDept.length * 30 + 40)}px"><canvas id="cDept" role="img" aria-label="กราฟจัดอันดับแผนกวิชา"></canvas></div>
        <details class="table-toggle"><summary>ดูเป็นตาราง</summary>${rankTable(s.byDept, 'แผนกวิชา')}</details>
      </article>
      <div class="stack">
        <article class="card">
          <header class="card-head"><div><h3>${icon('tag')} ทุนตามประเภท</h3><p>จำนวนทุนและยอดเงินแยกตามประเภททุน</p></div></header>
          ${s.byCategory.length ? s.byCategory.map((c) => `<div class="meter"><div class="meter-top"><span>${esc(c.name)}</span><span>${num(c.count)} ทุน · ${num(c.amount)} บาท</span></div><div class="meter-bar"><i style="width:${(c.amount / catMax) * 100}%"></i></div></div>`).join('') : empty('ยังไม่มีข้อมูล', 'tag')}
        </article>
        <article class="card">
          <header class="card-head"><div><h3>${icon('building')} ทุนจากหน่วยงานภายนอก</h3><p>สรุปยอดเงินและจำนวนทุนแยกตามหน่วยงาน</p></div>
            <button class="btn ghost sm" data-print="external">${icon('printer')} PDF</button></header>
          ${s.bySponsorExt.length ? rankTable(s.bySponsorExt, 'หน่วยงาน', true) : empty('ยังไม่มีข้อมูลทุนจากหน่วยงานภายนอก', 'building')}
        </article>
      </div>
    </section>

    <section class="grid g-3-2">
      <article class="card">
        <header class="card-head"><div><h3>${icon('award')} อันดับผู้รับทุนสูงสุด</h3><p>เรียงตามยอดเงินทุนรวมที่ได้รับ</p></div><a class="link" href="#/recipients">ดูทั้งหมด ${icon('arrowRight')}</a></header>
        ${s.topStudents.length ? `<div class="table-wrap"><table class="table"><thead><tr><th class="n">#</th><th>ชื่อ-สกุล</th><th>แผนกวิชา</th><th class="n">ทุน</th><th class="n">ยอดรวม (บาท)</th></tr></thead><tbody>
          ${s.topStudents.slice(0, 8).map((t, i) => `<tr><td class="n"><span class="rank r${i + 1}">${i + 1}</span></td><td><b>${esc(t.name)}</b><small class="block muted">${esc(t.level)}</small></td><td>${esc(deptName(v, t.departmentId).replace('แผนกวิชา', ''))}</td><td class="n">${t.count}</td><td class="n strong">${num(t.amount)}</td></tr>`).join('')}
          </tbody></table></div>` : empty('ยังไม่มีข้อมูลผู้รับทุน', 'users')}
      </article>
      <article class="card">
        <header class="card-head"><div><h3>${icon('megaphone')} ประกาศล่าสุด</h3></div><a class="link" href="#/announcements">ทั้งหมด ${icon('arrowRight')}</a></header>
        <div class="feed">${ann.map(annItem).join('') || empty('ยังไม่มีประกาศ', 'megaphone')}</div>
      </article>
    </section>
    ${off ? officialsCard(off, dash.year || v.institution?.academicYear) : ''}`;
  },
  mount(el, v) {
    const s = stats(v, dash.year, { categoryId: dash.cat });
    yearlyStacked('cYear', s.byYear);
    rankBars('cDept', s.byDept);
    $('#yearSel', el).onchange = (e) => { dash.year = e.target.value; rerender(); };
    $('#catSel', el).onchange = (e) => { dash.cat = e.target.value; rerender(); };
    $$('[data-print]', el).forEach((b) => (b.onclick = () => printReport(b.dataset.print, v, { year: dash.year, categoryId: dash.cat })));
  },
};

function officialsCard(off, year) {
  const person = (o, fallback) => (o?.name ? `<div class="person"><div class="avatar">${icon('user')}</div><div><b>${esc(o.name)}</b><span>${esc(o.position || o.title || fallback)}</span>${o.duties ? `<small>${esc(o.duties)}</small>` : ''}</div></div>` : '');
  const people = [person(off.director, 'ผู้อำนวยการ'), ...(off.deputies || []).map((d) => person(d, d?.title)), person(off.guidance, 'หัวหน้างานครูที่ปรึกษาและการแนะแนว')].filter(Boolean);
  if (!people.length) return '';
  return `<article class="card"><header class="card-head"><div><h3>${icon('users')} ผู้บริหารและผู้รับผิดชอบงานทุนการศึกษา</h3><p>ปีการศึกษา ${esc(year)}</p></div></header><div class="people">${people.join('')}</div></article>`;
}
function kpi(ic, label, value, unit, sub) {
  return `<article class="kpi"><div class="kpi-ic">${icon(ic)}</div><div class="kpi-body"><span class="kpi-label">${esc(label)}</span><div class="kpi-value">${esc(value)} <small>${esc(unit)}</small></div><span class="kpi-sub">${esc(sub)}</span></div></article>`;
}
function rankTable(rows, col, bars = false) {
  const max = Math.max(1, ...rows.map((r) => r.amount));
  return `<div class="table-wrap"><table class="table"><thead><tr><th class="n">#</th><th>${col}</th><th class="n">ทุน</th><th class="n">ยอดเงิน (บาท)</th></tr></thead><tbody>
    ${rows.map((r, i) => `<tr><td class="n">${i + 1}</td><td>${esc(r.name)}${bars ? `<div class="inline-bar"><i style="width:${(r.amount / max) * 100}%"></i></div>` : ''}</td><td class="n">${num(r.count)}</td><td class="n strong">${num(r.amount)}</td></tr>`).join('')}
  </tbody></table></div>`;
}
function annItem(a) {
  return `<a class="feed-item" href="#/announcements">
    <div class="feed-date"><b>${thDate(a.date, { day: 'numeric' })}</b><span>${thDate(a.date, { month: 'short' })}</span></div>
    <div><div class="feed-title">${a.pinned ? icon('pin', 'pin') : ''}${esc(a.title)}</div><p>${esc((a.body || '').slice(0, 110))}${(a.body || '').length > 110 ? '…' : ''}</p></div></a>`;
}

// ======================= SCHOLARSHIPS =======================
const sf = { q: '', type: '', level: '', dept: '', cat: '', year: '', status: 'open' };
export const scholarships = {
  title: 'ทุนการศึกษา', live: true,
  render(v) {
    return `<header class="page-head"><div><h1>ทุนการศึกษา</h1><p>ค้นหาทุนที่เหมาะกับคุณ ตรวจสอบคุณสมบัติ และยื่นสมัครออนไลน์พร้อมแนบเอกสาร</p></div>
      <div class="head-actions"><a class="btn ghost" href="#/qr">${icon('qr')} QR Code สมัครทุน</a><a class="btn ghost" href="#/track">${icon('search')} ติดตามสถานะ</a></div></header>
    <div class="filters">
      <label class="search">${icon('search')}<input id="q" type="search" placeholder="ค้นหาชื่อทุน หรือหน่วยงาน" value="${esc(sf.q)}"></label>
      ${yearSelect(v, sf.year, 'fYear')}
      ${catSelect(v, sf.cat)}
      <select id="fType">${opt('', 'ภายใน/ภายนอก', sf.type)}${Object.entries(TYPES).map(([k, l]) => opt(k, l, sf.type)).join('')}</select>
      <select id="fLevel">${opt('', 'ทุกระดับชั้น', sf.level)}${LEVELS.map((l) => opt(l, l, sf.level)).join('')}</select>
      <select id="fDept">${opt('', 'ทุกแผนกวิชา', sf.dept)}${deptOpts(v).map((o) => opt(o.value, o.label, sf.dept)).join('')}</select>
      <select id="fStatus">${opt('open', 'เปิดรับสมัคร', sf.status)}${opt('', 'ทั้งหมด', sf.status)}${opt('closed', 'ปิดรับแล้ว', sf.status)}</select>
    </div>
    <div id="schList" class="cards"></div>`;
  },
  mount(el, v) {
    const draw = () => {
      const q = sf.q.toLowerCase();
      const list = v.scholarships.filter((s) =>
        (!q || `${s.title} ${sponsor(v, s.sponsorId).name}`.toLowerCase().includes(q)) &&
        (!sf.year || String(s.year) === sf.year) && (!sf.cat || s.categoryId === sf.cat) &&
        (!sf.type || s.type === sf.type) &&
        (!sf.level || !s.levels?.length || s.levels.includes(sf.level)) &&
        (!sf.dept || !s.departments?.length || s.departments.includes(sf.dept)) &&
        (!sf.status || (sf.status === 'open' ? isOpen(s) : !isOpen(s))))
        .sort((a, b) => isOpen(b) - isOpen(a) || String(b.year).localeCompare(String(a.year)) || (a.deadline || '').localeCompare(b.deadline || ''));
      $('#schList', el).innerHTML = list.map((s) => schCard(v, s)).join('') || empty('ไม่พบทุนที่ตรงกับเงื่อนไข');
      $$('[data-detail]', el).forEach((b) => (b.onclick = () => schDetail(v, b.dataset.detail)));
    };
    $('#q', el).oninput = (e) => { sf.q = e.target.value; draw(); };
    [['#fYear', 'year'], ['#fCat', 'cat'], ['#fType', 'type'], ['#fLevel', 'level'], ['#fDept', 'dept'], ['#fStatus', 'status']].forEach(([id, k]) => ($(id, el).onchange = (e) => { sf[k] = e.target.value; draw(); }));
    draw();
  },
};

function schCard(v, s) {
  const sp = sponsor(v, s.sponsorId);
  const quotaLeft = Math.max(0, (Number(s.quota) || 0) - (s.approved || 0));
  return `<article class="card sch-card ${isOpen(s) ? '' : 'is-closed'} ${s.poster ? 'has-poster' : ''}">
    ${s.poster ? `<button class="sch-poster" data-detail="${esc(s.id)}" aria-label="ดูโปสเตอร์"><img src="${esc(s.poster)}" alt="โปสเตอร์ ${esc(s.title)}" loading="lazy"></button>` : ''}
    <div class="sch-top">${catName(v, s.categoryId) ? badge(catName(v, s.categoryId), 'info', 'tag') : ''}${deadlineBadge(s)}</div>
    <h3>${esc(s.title)}</h3>
    <p class="sch-sponsor">${icon('building')} ${esc(sp.name || '-')} · <span class="muted">${esc(TYPES[s.type] || '')}</span></p>
    <div class="sch-amount"><b>${num(s.amount)}</b> บาท/ทุน</div>
    <ul class="sch-facts">
      <li>${icon('users')} โควตา ${num(s.quota)} ทุน · คงเหลือ ${num(quotaLeft)}</li>
      <li>${icon('graduation')} ${esc((s.levels || []).join(' / ') || 'ทุกระดับ')} ${s.minGpa ? `· GPA ≥ ${Number(s.minGpa).toFixed(2)}` : ''}</li>
      <li>${icon('calendar')} ปีการศึกษา ${esc(s.year)} · ผู้สมัครแล้ว ${num(s.applicants)} คน</li>
    </ul>
    <div class="sch-actions">
      <button class="btn ghost" data-detail="${esc(s.id)}">${icon('eye')} รายละเอียด</button>
      ${isOpen(s) ? `<a class="btn primary" href="#/apply/${esc(s.id)}">${icon('send')} สมัครทุนนี้</a>` : ''}
    </div>
  </article>`;
}

export function schDetail(v, id) {
  const s = v.scholarships.find((x) => x.id === id);
  if (!s) return;
  const sp = sponsor(v, s.sponsorId);
  const depts = s.departments?.length ? s.departments.map((d) => deptName(v, d)).join(', ') : 'ทุกแผนกวิชา';
  const open = isOpen(s);
  modal({
    title: s.title, size: 'lg',
    body: `<div class="detail">
      ${s.poster ? `<a class="detail-poster" href="${esc(s.poster)}" target="_blank" rel="noopener"><img src="${esc(s.poster)}" alt="โปสเตอร์ประชาสัมพันธ์"></a>` : ''}
      <div class="detail-badges">${catName(v, s.categoryId) ? badge(catName(v, s.categoryId), 'info', 'tag') : ''}${badge(TYPES[s.type], 'neutral')}${deadlineBadge(s)}${badge(`ปีการศึกษา ${s.year}`, 'neutral')}</div>
      <div class="detail-stats"><div><span>จำนวนเงิน</span><b>${baht(s.amount)}</b></div><div><span>จำนวนทุน</span><b>${num(s.quota)} ทุน</b></div><div><span>รับสมัคร</span><b>${thDate(s.openDate)} – ${thDate(s.deadline)}</b></div></div>
      <div class="detail-cols"><div>
        <p>${esc(s.description || '')}</p>
        <h4>หน่วยงานผู้ให้ทุน</h4><p>${esc(sp.name || '-')} ${sp.website ? `· <a href="${esc(sp.website)}" target="_blank" rel="noopener">เว็บไซต์</a>` : ''}</p>
        <h4>คุณสมบัติผู้สมัคร</h4>
        <ul class="checklist">
          <li>${icon('check')} ระดับชั้น: ${esc((s.levels || []).join(', ') || 'ทุกระดับ')}</li>
          <li>${icon('check')} แผนกวิชา: ${esc(depts)}</li>
          ${s.minGpa ? `<li>${icon('check')} เกรดเฉลี่ยสะสมไม่ต่ำกว่า ${Number(s.minGpa).toFixed(2)}</li>` : ''}
          ${s.maxIncome ? `<li>${icon('check')} รายได้ครอบครัวไม่เกิน ${num(s.maxIncome)} บาท/ปี</li>` : ''}
          ${(s.requirements || []).map((r) => `<li>${icon('check')} ${esc(r)}</li>`).join('')}
        </ul>
        <h4>เอกสาร/หลักฐานประกอบการสมัคร</h4>
        <ul class="checklist">${(s.documents || []).map((d) => `<li>${icon('paperclip')} ${esc(d)}</li>`).join('')}</ul>
      </div>
      ${open ? `<aside class="qr-box"><img src="${qrDataUrl(applyUrl(s.id), 220)}" alt="QR Code สมัครทุน"><b>สแกนเพื่อสมัคร</b><small>ใช้กล้องโทรศัพท์สแกน QR Code</small></aside>` : ''}</div>
    </div>`,
    actions: `<button class="btn ghost" data-poster>${icon('printer')} พิมพ์ประกาศ + QR (A4)</button><span class="spacer"></span><button class="btn ghost" data-close>ปิด</button>${open ? `<a class="btn primary" href="#/apply/${esc(s.id)}" data-close>${icon('send')} สมัครทุนนี้</a>` : ''}`,
    onMount: (m) => ($('[data-poster]', m).onclick = () => printScholarshipPoster(s, v)),
  });
}

// ======================= QR CODES =======================
export const qr = {
  title: 'QR Code สมัครทุน', live: true,
  render(v) {
    const open = v.scholarships.filter((s) => isOpen(s));
    const home = `${location.origin}${location.pathname}#/scholarships`;
    return `<header class="page-head"><div><h1>QR Code สมัครขอรับทุน</h1><p>สแกนเพื่อเปิดหน้าใบสมัครบนโทรศัพท์ได้ทันที — พิมพ์ติดบอร์ดประชาสัมพันธ์หรือแชร์ในกลุ่มไลน์</p></div></header>
    <div class="cards qr-cards">
      <article class="card qr-card main"><img src="${qrDataUrl(home, 260)}" alt="QR"><h3>รวมทุนการศึกษาทั้งหมด</h3><p class="muted">${esc(home)}</p><button class="btn ghost sm" data-copy="${esc(home)}">${icon('link')} คัดลอกลิงก์</button></article>
      ${open.map((s) => `<article class="card qr-card"><img src="${qrDataUrl(applyUrl(s.id), 220)}" alt="QR ${esc(s.title)}"><h3>${esc(s.title)}</h3><p class="muted">${num(s.amount)} บาท · ปิดรับ ${thDate(s.deadline)}</p>
        <div class="btn-row center-row"><button class="btn ghost sm" data-copy="${esc(applyUrl(s.id))}">${icon('link')} คัดลอกลิงก์</button><button class="btn primary sm" data-poster="${esc(s.id)}">${icon('printer')} พิมพ์ประกาศ A4</button></div></article>`).join('')}
    </div>`;
  },
  mount(el, v) {
    $$('[data-copy]', el).forEach((b) => (b.onclick = async () => { try { await navigator.clipboard.writeText(b.dataset.copy); toast('คัดลอกลิงก์แล้ว'); } catch { toast('คัดลอกไม่สำเร็จ', 'warning'); } }));
    $$('[data-poster]', el).forEach((b) => (b.onclick = () => printScholarshipPoster(v.scholarships.find((s) => s.id === b.dataset.poster), v)));
  },
};

// ======================= ANNOUNCEMENTS =======================
export const announcements = {
  title: 'ประกาศประชาสัมพันธ์', live: true,
  render(v) {
    const list = [...v.announcements].sort((a, b) => (b.pinned - a.pinned) || (b.date || '').localeCompare(a.date || ''));
    return `<header class="page-head"><div><h1>ประกาศประชาสัมพันธ์ทุนการศึกษา</h1><p>ข่าวสารทุนการศึกษาจากหน่วยงานภายในและภายนอกสถานศึกษา</p></div>
      ${store.can('post') ? `<a class="btn primary" href="#/admin/announcements">${icon('plus')} โพสต์ประกาศ</a>` : ''}</header>
    <div class="ann-list">${list.map((a) => {
      const s = v.scholarships.find((x) => x.id === a.scholarshipId);
      const sp = sponsor(v, a.sponsorId || s?.sponsorId);
      const poster = a.poster || s?.poster;
      return `<article class="card ann ${a.pinned ? 'pinned' : ''} ${poster ? 'with-poster' : ''}">
        ${poster ? `<a class="ann-poster" href="${esc(poster)}" target="_blank" rel="noopener"><img src="${esc(poster)}" alt="โปสเตอร์ประกาศ" loading="lazy"></a>` : ''}
        <div class="ann-content">
        <div class="ann-meta">${a.pinned ? badge('ปักหมุด', 'warning', 'pin') : ''}${a.tag ? badge(a.tag, 'info') : ''}<span class="muted">${thDate(a.date, { day: 'numeric', month: 'long', year: 'numeric' })}${a.author ? ` · โดย ${esc(a.author)}` : ''}</span></div>
        <h3>${esc(a.title)}</h3>
        ${sp.name ? `<p class="sch-sponsor">${icon('building')} ${esc(sp.name)}</p>` : ''}
        <p class="ann-body">${esc(a.body).replace(/\n/g, '<br>')}</p>
        <div class="ann-actions">${s ? `<button class="btn ghost sm" data-detail="${esc(s.id)}">${icon('eye')} รายละเอียดทุน</button>${isOpen(s) ? `<a class="btn primary sm" href="#/apply/${esc(s.id)}">${icon('send')} สมัคร</a>` : ''}` : ''}${a.link ? `<a class="btn ghost sm" href="${esc(a.link)}" target="_blank" rel="noopener">${icon('link')} ลิงก์ที่เกี่ยวข้อง</a>` : ''}</div>
        </div></article>`;
    }).join('') || empty('ยังไม่มีประกาศ', 'megaphone')}</div>`;
  },
  mount(el, v) { $$('[data-detail]', el).forEach((b) => (b.onclick = () => schDetail(v, b.dataset.detail))); },
};

// ======================= SPONSORS =======================
const spf = { q: '', type: '', cat: '' };
export const sponsors = {
  title: 'แหล่งทุนและผู้สนับสนุน', live: true,
  render(v) {
    const cats = [...new Set(v.sponsors.map((s) => s.category).filter(Boolean))];
    return `<header class="page-head"><div><h1>ฐานข้อมูลแหล่งทุนและหน่วยงานผู้สนับสนุน</h1><p>รวบรวมหน่วยงานที่ให้การสนับสนุนทุนการศึกษาแก่นักเรียน นักศึกษา</p></div></header>
    <div class="filters">
      <label class="search">${icon('search')}<input id="q" type="search" placeholder="ค้นหาหน่วยงาน" value="${esc(spf.q)}"></label>
      <select id="fType">${opt('', 'ภายใน/ภายนอก', spf.type)}${Object.entries(TYPES).map(([k, l]) => opt(k, l, spf.type)).join('')}</select>
      <select id="fCat">${opt('', 'ทุกหมวดหมู่หน่วยงาน', spf.cat)}${cats.map((c) => opt(c, c, spf.cat)).join('')}</select>
    </div><div id="spList" class="cards"></div>`;
  },
  mount(el, v) {
    const all = stats(v, '');
    const draw = () => {
      const q = spf.q.toLowerCase();
      const list = v.sponsors.filter((s) => (!q || `${s.name} ${s.category}`.toLowerCase().includes(q)) && (!spf.type || s.type === spf.type) && (!spf.cat || s.category === spf.cat))
        .map((s) => ({ s, st: all.bySponsor.find((x) => x.key === s.id) || { count: 0, amount: 0 }, progs: v.scholarships.filter((x) => x.sponsorId === s.id) }))
        .sort((a, b) => b.st.amount - a.st.amount);
      $('#spList', el).innerHTML = list.map(({ s, st, progs }) => `<article class="card sp-card">
        <div class="sp-head"><div class="avatar">${esc([...(s.name || '?')].find((c) => /[ก-ฮA-Za-z]/.test(c)) || '?')}</div><div><h3>${esc(s.name)}</h3><div class="sp-tags">${badge(TYPES[s.type] || '-', s.type === 'external' ? 'info' : 'neutral')}${s.category ? badge(s.category, 'neutral') : ''}</div></div></div>
        <div class="sp-stats"><div><span>ยอดทุนสะสม</span><b>${num(st.amount)}</b><small>บาท</small></div><div><span>ทุนที่มอบ</span><b>${num(st.count)}</b><small>ทุน</small></div><div><span>โครงการทุน</span><b>${progs.length}</b><small>รายการ</small></div></div>
        ${s.description ? `<p class="muted">${esc(s.description)}</p>` : ''}
        <ul class="sp-contact">${s.contact ? `<li>${icon('users')} ${esc(s.contact)}</li>` : ''}${s.phone ? `<li>${icon('phone')} ${esc(s.phone)}</li>` : ''}${s.email ? `<li>${icon('mail')} ${esc(s.email)}</li>` : ''}${s.website ? `<li>${icon('globe')} <a href="${esc(s.website)}" target="_blank" rel="noopener">${esc(s.website.replace(/^https?:\/\//, ''))}</a></li>` : ''}</ul>
      </article>`).join('') || empty('ไม่พบหน่วยงาน', 'building');
    };
    $('#q', el).oninput = (e) => { spf.q = e.target.value; draw(); };
    $('#fType', el).onchange = (e) => { spf.type = e.target.value; draw(); };
    $('#fCat', el).onchange = (e) => { spf.cat = e.target.value; draw(); };
    draw();
  },
};

// ======================= RECIPIENTS =======================
const rf = { q: '', year: '', dept: '', level: '', type: '', cat: '', sponsor: '', page: 1 };
export const recipients = {
  title: 'ผู้ได้รับทุน', live: true,
  render(v) {
    return `<header class="page-head"><div><h1>ข้อมูลผู้ได้รับทุนการศึกษา</h1><p>ค้นหารายปี รายแผนกวิชา และรายประเภททุน${store.isStaff ? '' : ' (แสดงชื่อแบบย่อเพื่อคุ้มครองข้อมูลส่วนบุคคล)'}</p></div>
      <button class="btn ghost" id="pdf">${icon('printer')} ส่งออก PDF</button></header>
    <div class="filters">
      <label class="search">${icon('search')}<input id="q" type="search" placeholder="ค้นหาชื่อ หรือชื่อทุน" value="${esc(rf.q)}"></label>
      ${yearSelect(v, rf.year, 'fYear')}
      <select id="fDept">${opt('', 'ทุกแผนกวิชา', rf.dept)}${deptOpts(v).map((o) => opt(o.value, o.label, rf.dept)).join('')}</select>
      ${catSelect(v, rf.cat)}
      <select id="fLevel">${opt('', 'ทุกระดับชั้น', rf.level)}${LEVELS.map((l) => opt(l, l, rf.level)).join('')}</select>
      <select id="fType">${opt('', 'ภายใน/ภายนอก', rf.type)}${Object.entries(TYPES).map(([k, l]) => opt(k, l, rf.type)).join('')}</select>
      <select id="fSp">${opt('', 'ทุกแหล่งทุน', rf.sponsor)}${v.sponsors.map((s) => opt(s.id, s.name, rf.sponsor)).join('')}</select>
    </div>
    <div id="recSummary" class="summary-strip"></div>
    <article class="card flush"><div id="recTable"></div></article>`;
  },
  mount(el, v) {
    const PER = 25;
    const filtered = () => {
      const q = rf.q.toLowerCase();
      return v.recipients.filter((r) => (!q || `${r.name} ${r.scholarshipTitle}`.toLowerCase().includes(q)) && (!rf.year || String(r.year) === rf.year) && (!rf.dept || r.departmentId === rf.dept) && (!rf.cat || r.categoryId === rf.cat) && (!rf.level || r.level === rf.level) && (!rf.type || r.type === rf.type) && (!rf.sponsor || r.sponsorId === rf.sponsor))
        .sort((a, b) => String(b.year).localeCompare(String(a.year)) || b.amount - a.amount);
    };
    const draw = () => {
      const list = filtered();
      const pages = Math.max(1, Math.ceil(list.length / PER));
      rf.page = Math.min(rf.page, pages);
      const rows = list.slice((rf.page - 1) * PER, rf.page * PER);
      const total = list.reduce((t, r) => t + (Number(r.amount) || 0), 0);
      $('#recSummary', el).innerHTML = `<span>พบ <b>${num(list.length)}</b> รายการ</span><span>ยอดเงินรวม <b>${num(total)}</b> บาท</span><span>ภายนอก <b>${num(list.filter((r) => r.type === 'external').length)}</b> · ภายใน <b>${num(list.filter((r) => r.type !== 'external').length)}</b></span>`;
      $('#recTable', el).innerHTML = rows.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>ชื่อ-สกุล</th><th>ระดับ</th><th>แผนกวิชา</th><th>ทุนการศึกษา</th><th>ประเภททุน</th><th>แหล่งทุน</th><th>ปี</th><th class="n">จำนวนเงิน</th></tr></thead><tbody>
        ${rows.map((r) => `<tr><td><b>${esc(r.name)}</b>${store.isStaff && r.studentId ? `<small class="block muted">${esc(r.studentId)}</small>` : ''}</td><td>${esc(r.level)}${r.classYear ? `/${esc(r.classYear)}` : ''}</td><td>${esc(deptName(v, r.departmentId).replace('แผนกวิชา', ''))}</td><td>${esc(r.scholarshipTitle)}</td><td>${esc(catName(v, r.categoryId) || '-')}</td><td>${badge(r.type === 'external' ? 'ภายนอก' : 'ภายใน', r.type === 'external' ? 'info' : 'neutral')} <span class="muted">${esc(sponsor(v, r.sponsorId).name || '')}</span></td><td>${esc(r.year)}</td><td class="n strong">${num(r.amount)}</td></tr>`).join('')}
        </tbody></table></div>
        <div class="pager"><button class="btn ghost sm" data-pg="-1" ${rf.page <= 1 ? 'disabled' : ''}>ก่อนหน้า</button><span>หน้า ${rf.page} / ${pages}</span><button class="btn ghost sm" data-pg="1" ${rf.page >= pages ? 'disabled' : ''}>ถัดไป</button></div>` : empty('ไม่พบข้อมูลตามเงื่อนไข', 'users');
      $$('[data-pg]', el).forEach((b) => (b.onclick = () => { rf.page += Number(b.dataset.pg); draw(); }));
    };
    $('#q', el).oninput = (e) => { rf.q = e.target.value; rf.page = 1; draw(); };
    [['#fYear', 'year'], ['#fDept', 'dept'], ['#fCat', 'cat'], ['#fLevel', 'level'], ['#fType', 'type'], ['#fSp', 'sponsor']].forEach(([id, k]) => ($(id, el).onchange = (e) => { rf[k] = e.target.value; rf.page = 1; draw(); }));
    $('#pdf', el).onclick = () => printReport('recipients', v, { year: rf.year, rec: filtered() });
    draw();
  },
};

// ======================= APPLY =======================
const studentFields = (v) => [
  { name: 'prefix', label: 'คำนำหน้า', type: 'select', options: PREFIXES.map((p) => ({ value: p, label: p })), required: true },
  { name: 'firstName', label: 'ชื่อ', required: true },
  { name: 'lastName', label: 'นามสกุล', required: true },
  { name: 'studentId', label: 'รหัสนักศึกษา', required: true, inputmode: 'numeric', pattern: '[0-9]{5,15}', hint: 'ตัวเลข 5–15 หลัก' },
  { name: 'level', label: 'ระดับชั้น', type: 'select', options: LEVELS.map((l) => ({ value: l, label: l })), required: true, empty: 'เลือกระดับชั้น' },
  { name: 'classYear', label: 'ชั้นปี', type: 'select', options: ['1', '2', '3'].map((y) => ({ value: y, label: `ปีที่ ${y}` })), required: true, empty: 'เลือกชั้นปี' },
  { name: 'departmentId', label: 'แผนกวิชา', type: 'select', options: deptOpts(v), required: true, empty: 'เลือกแผนกวิชา', span: 2 },
  { name: 'gpa', label: 'เกรดเฉลี่ยสะสม (GPAX)', type: 'number', step: '0.01', min: 0, max: 4, required: true },
  { name: 'birthDate', label: 'วันเกิด', type: 'date' },
  { name: 'phone', label: 'เบอร์โทรศัพท์', type: 'tel', required: true, placeholder: '08x-xxx-xxxx' },
  { name: 'email', label: 'อีเมล', type: 'email' },
  { name: 'address', label: 'ที่อยู่ปัจจุบัน', type: 'textarea', rows: 2, required: true, span: 3 },
];
const familyFields = [
  { name: 'parentName', label: 'ชื่อ-สกุล ผู้ปกครอง', required: true },
  { name: 'parentRelation', label: 'ความเกี่ยวข้อง', placeholder: 'บิดา / มารดา / ผู้ปกครอง' },
  { name: 'parentJob', label: 'อาชีพผู้ปกครอง', required: true },
  { name: 'parentPhone', label: 'โทรศัพท์ผู้ปกครอง', type: 'tel' },
  { name: 'income', label: 'รายได้ครอบครัวรวม (บาท/ปี)', type: 'number', min: 0, required: true },
  { name: 'siblings', label: 'จำนวนพี่น้อง (รวมตนเอง)', type: 'number', min: 1 },
];
const last = { submitted: null };

function prefillFromUser() {
  const u = store.user;
  if (!u || u.role !== 'student') return { prefix: 'นาย' };
  const m = String(u.name || '').match(/^(นาย|นางสาว|นาง)?\s*(\S+)\s*(.*)$/) || [];
  return { prefix: m[1] || 'นาย', firstName: m[2] || '', lastName: m[3] || '', studentId: u.username, level: u.level, classYear: u.classYear, departmentId: u.departmentId, phone: u.phone, email: u.email };
}

export const apply = {
  title: 'ยื่นสมัครขอรับทุน', live: false,
  render(v, [id]) {
    const s = v.scholarships.find((x) => x.id === id);
    if (!s) return `<div class="card">${empty('ไม่พบทุนการศึกษานี้', 'alert')}<div class="center"><a class="btn primary" href="#/scholarships">กลับไปหน้าทุนการศึกษา</a></div></div>`;
    if (last.submitted?.application.scholarshipId === id) return successView(last.submitted);
    const sp = sponsor(v, s.sponsorId);
    const staffMode = store.can('docCheck');
    const relayMissing = store.mode !== 'github' && !store.relayUrl();
    const pre = prefillFromUser();
    return `<a class="back" href="#/scholarships">← กลับไปหน้าทุนการศึกษา</a>
    <header class="page-head"><div><h1>ใบสมัครขอรับทุนการศึกษา</h1><p>${esc(s.title)} · ${esc(sp.name || '')}</p></div></header>
    ${relayMissing ? `<div class="notice tone-warning">${icon('alert')}<div><b>ระบบรับสมัครออนไลน์ยังไม่เปิดใช้งาน</b><p>ผู้ดูแลระบบยังไม่ได้ตั้งค่าตัวรับใบสมัคร (Relay) — กรุณาติดต่องานครูที่ปรึกษาและการแนะแนว หรือกรอกข้อมูลแล้วพิมพ์ใบสมัครเพื่อยื่นด้วยตนเอง</p></div></div>` : ''}
    ${staffMode ? `<div class="notice tone-info">${icon('shield')}<div><b>โหมดเจ้าหน้าที่</b><p>ใบสมัครจะบันทึกในนาม ${esc(store.user.name)}</p></div></div>` : ''}
    <div class="apply-layout">
      <form id="appForm" class="apply-form" novalidate>
        <section class="card"><h3 class="sec-title"><span>1</span>ข้อมูลผู้สมัคร</h3><div class="form-grid">${studentFields(v).map((f) => field(f, pre[f.name] ?? '')).join('')}</div></section>
        <section class="card"><h3 class="sec-title"><span>2</span>ข้อมูลครอบครัว</h3><div class="form-grid">${familyFields.map((f) => field(f, '')).join('')}</div></section>
        <section class="card"><h3 class="sec-title"><span>3</span>เหตุผลและผลงาน</h3>
          <div class="form-grid">${field({ name: 'reason', label: 'เหตุผลความจำเป็นในการขอรับทุน', type: 'textarea', rows: 5, required: true, span: 3, placeholder: 'อธิบายสภาพครอบครัว ความจำเป็น และเป้าหมายทางการศึกษา' })}
          ${field({ name: 'achievements', label: 'ผลงาน / กิจกรรม / ความสามารถพิเศษ (ถ้ามี)', type: 'textarea', rows: 3, span: 3 })}</div></section>
        <section class="card"><h3 class="sec-title"><span>4</span>แนบเอกสารและหลักฐานประกอบ</h3>
          <p class="muted">รองรับไฟล์ PDF, JPG, PNG ขนาดไม่เกิน ${CONFIG.maxFileMB} MB ต่อไฟล์ — เจ้าหน้าที่จะตรวจสอบเอกสารทุกรายการ</p>
          <div class="uploads">${(s.documents || []).map((d, i) => uploadSlot(`doc${i}`, d, true)).join('')}${uploadSlot('extra', 'หลักฐานเพิ่มเติม (ถ้ามี)', false, true)}</div></section>
        <section class="card consent">
          <label class="switch"><input type="checkbox" id="consent" required><span>ข้าพเจ้ายืนยันว่าข้อมูลเป็นความจริง และยินยอมให้สถานศึกษาเก็บรวบรวมและใช้ข้อมูลส่วนบุคคลเพื่อการพิจารณาทุนการศึกษาตาม พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562</span></label>
          <div class="form-actions"><button type="button" class="btn ghost" id="previewPdf">${icon('printer')} พิมพ์ใบสมัคร (ร่าง)</button><button class="btn primary lg" id="submitBtn" ${relayMissing ? 'disabled' : ''}>${icon('send')} ยื่นใบสมัคร</button></div>
          <div id="progress" class="progress-line" hidden></div>
        </section>
      </form>
      <aside class="apply-side"><div class="card sticky">
        ${s.poster ? `<img class="side-poster" src="${esc(s.poster)}" alt="">` : ''}
        <span class="eyebrow">${icon('award')} ทุนที่สมัคร</span>
        <h3>${esc(s.title)}</h3>
        <div class="sch-amount"><b>${num(s.amount)}</b> บาท/ทุน</div>
        <div class="side-row"><span>ประเภททุน</span><b>${esc(catName(v, s.categoryId) || TYPES[s.type])}</b></div>
        <div class="side-row"><span>โควตา</span><b>${num(s.quota)} ทุน</b></div>
        <div class="side-row"><span>ปิดรับสมัคร</span><b>${thDate(s.deadline)}</b></div>
        <div class="divider"></div>
        <h4 class="mini-title">ตรวจสอบคุณสมบัติอัตโนมัติ</h4>
        <ul id="elig" class="elig"></ul>
      </div></aside>
    </div>`;
  },
  mount(el, v, [id]) {
    const s = v.scholarships.find((x) => x.id === id);
    if (!s) return;
    if (last.submitted?.application.scholarshipId === id) {
      $('#printApp', el).onclick = () => printApplication(last.submitted.application, store.view());
      $('#newApp', el).onclick = () => { last.submitted = null; rerender(); };
      return;
    }
    const form = $('#appForm', el);
    const fields = [...studentFields(v), ...familyFields];
    const read = () => {
      const st = {};
      for (const f of fields) st[f.name] = form.elements[f.name].value.trim();
      ['gpa', 'income', 'siblings'].forEach((k) => (st[k] = st[k] === '' ? '' : Number(st[k])));
      return st;
    };
    const syncClass = () => {
      const allowed = CLASS_YEARS[form.elements.level.value] || ['1', '2', '3'];
      const cy = form.elements.classYear;
      [...cy.options].forEach((o) => (o.hidden = o.value && !allowed.includes(o.value)));
      if (cy.value && !allowed.includes(cy.value)) cy.value = '';
    };
    const drawElig = () => {
      const e = eligibility(s, read());
      $('#elig', el).innerHTML = e.checks.map((c) => `<li class="${c.ok === true ? 'ok' : c.ok === false ? 'bad' : 'wait'}">${icon(c.ok === true ? 'check' : c.ok === false ? 'x' : 'clock')}<span>${esc(c.label)}</span></li>`).join('');
      return e;
    };
    if (store.isStudent) form.elements.studentId.readOnly = true;
    form.addEventListener('input', drawElig);
    form.elements.level.addEventListener('change', syncClass);
    drawElig();
    bindUploads(el);
    const collect = () => ({ scholarshipId: s.id, year: s.year, student: read(), reason: form.elements.reason.value.trim(), achievements: form.elements.achievements.value.trim() });
    $('#previewPdf', el).onclick = () => printApplication({ ...collect(), code: 'ฉบับร่าง', status: '', submittedAt: new Date().toISOString(), files: gatherFiles(el).map((f) => ({ label: f.label, name: f.file.name })) }, v);

    form.onsubmit = async (e) => {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      const missing = $$('.upload[data-required="1"]', el).filter((u) => !u._files?.length);
      if (missing.length && !store.can('docCheck')) { toast(`กรุณาแนบเอกสาร: ${missing[0].dataset.label}`, 'warning'); missing[0].scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
      const elig = drawElig();
      if (!elig.ok) {
        if (!store.can('docCheck')) { toast('คุณสมบัติไม่ตรงตามเงื่อนไขของทุนนี้ กรุณาตรวจสอบ', 'warning'); return; }
        if (!(await confirmBox('คุณสมบัติไม่ตรงตามเงื่อนไขทุน (หรืออยู่นอกช่วงรับสมัคร) ต้องการบันทึกใบสมัครต่อในนามเจ้าหน้าที่หรือไม่?', { okText: 'บันทึกต่อ' }))) return;
      }
      const btn = $('#submitBtn', el); const prog = $('#progress', el);
      btn.disabled = true; prog.hidden = false;
      try {
        const application = collect();
        const files = gatherFiles(el);
        const res = await store.submitApplication(application, files, (m) => (prog.textContent = m));
        last.submitted = { code: res.code, application: res.application || { ...application, code: res.code, status: 'submitted', submittedAt: new Date().toISOString(), files: files.map((f) => ({ label: f.label, name: f.file.name })) } };
        toast('ยื่นใบสมัครเรียบร้อยแล้ว');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        rerender();
      } catch (err) {
        toast(err.message, 'critical'); btn.disabled = false; prog.hidden = true;
      }
    };
  },
};
export function uploadSlot(key, label, required, multiple = false) {
  return `<div class="upload" data-key="${key}" data-label="${esc(label)}" data-required="${required ? 1 : 0}">
    <label class="drop">${icon('upload')}<div><b>${esc(label)}${required ? ' <span class="req">*</span>' : ''}</b><small>คลิกหรือลากไฟล์มาวาง</small></div>
      <input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/*" ${multiple ? 'multiple' : ''}></label>
    <ul class="file-list"></ul></div>`;
}
export function bindUploads(el) {
  $$('.upload', el).forEach((u) => {
    u._files = [];
    const input = $('input', u); const list = $('.file-list', u); const drop = $('.drop', u);
    const draw = () => {
      list.innerHTML = u._files.map((f, i) => `<li>${icon('paperclip')}<span>${esc(f.name)}</span><small>${fileSize(f.size)}</small><button type="button" class="icon-btn sm" data-rm="${i}" aria-label="ลบไฟล์">${icon('x')}</button></li>`).join('');
      u.classList.toggle('has', u._files.length > 0);
      $$('[data-rm]', list).forEach((b) => (b.onclick = () => { u._files.splice(Number(b.dataset.rm), 1); draw(); }));
    };
    const add = (files) => {
      for (const f of files) {
        if (f.size > CONFIG.maxFileMB * 1048576) { toast(`ไฟล์ ${f.name} ใหญ่เกิน ${CONFIG.maxFileMB} MB`, 'warning'); continue; }
        if (!/pdf|image\//.test(f.type) && !/\.(pdf|jpe?g|png)$/i.test(f.name)) { toast(`ไม่รองรับไฟล์ ${f.name}`, 'warning'); continue; }
        if (gatherFiles(el).length >= CONFIG.maxFiles) { toast(`แนบได้สูงสุด ${CONFIG.maxFiles} ไฟล์`, 'warning'); break; }
        if (input.multiple) u._files.push(f); else u._files = [f];
      }
      draw();
    };
    input.onchange = () => { add([...input.files]); input.value = ''; };
    drop.ondragover = (e) => { e.preventDefault(); drop.classList.add('over'); };
    drop.ondragleave = () => drop.classList.remove('over');
    drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove('over'); add([...e.dataTransfer.files]); };
  });
}
export const gatherFiles = (el) => $$('.upload', el).flatMap((u) => (u._files || []).map((file) => ({ file, label: u.dataset.key === 'extra' ? 'หลักฐานเพิ่มเติม' : u.dataset.label })));

function successView(r) {
  return `<div class="success card">
    <div class="success-ic">${icon('check')}</div>
    <h1>ยื่นใบสมัครเรียบร้อยแล้ว</h1>
    <p>กรุณาบันทึกเลขที่ใบสมัครไว้เพื่อใช้ติดตามสถานะ</p>
    <div class="code-box">${esc(r.code)}</div>
    <div class="success-actions">
      <button class="btn primary" id="printApp">${icon('printer')} ดาวน์โหลดใบสมัคร PDF (A4)</button>
      <a class="btn ghost" href="${store.isStudent ? '#/my' : '#/track'}">${icon('search')} ติดตามสถานะ</a>
      <button class="btn ghost" id="newApp">${icon('plus')} สมัครทุนอื่น</button>
    </div>
    <p class="muted small">เจ้าหน้าที่จะตรวจสอบเอกสารและหลักฐาน หากไม่ครบถ้วน ระบบจะแจ้งสถานะ "เอกสารไม่ครบ" และสามารถแนบเพิ่มเติมได้ที่หน้าติดตามสถานะ</p>
  </div>`;
}

// ======================= TRACK / MY APPLICATIONS =======================
function reviewSteps(a) {
  const rv = a.review || {};
  const steps = [
    { label: 'ยื่นใบสมัคร', done: true, at: a.submittedAt },
    { label: 'ตรวจสอบเอกสาร/หลักฐาน', done: !!rv.docCheck, bad: rv.docCheck && (rv.docCheck.result || rv.docCheck.decision) === 'incomplete', at: rv.docCheck?.at },
    ...STAGES.filter((s) => !s.optional || rv[s.key]).map((s) => ({ label: s.label.replace('ผลการพิจารณาของ', '').replace('ความเห็น', ''), done: !!rv[s.key], bad: rv[s.key] && ['oppose', 'reject'].includes(rv[s.key].decision), at: rv[s.key]?.at })),
  ];
  return `<ol class="steps">${steps.map((s) => `<li class="${s.done ? (s.bad ? 'bad' : 'done') : ''}"><i>${icon(s.done ? (s.bad ? 'x' : 'check') : 'clock')}</i><b>${esc(s.label)}</b><span>${s.at ? thDate(s.at) : 'รอดำเนินการ'}</span></li>`).join('')}</ol>`;
}
function appCard(a, v, { canAdd }) {
  const s = v.scholarships.find((x) => x.id === a.scholarshipId);
  const st = STATUS[a.status] || {};
  return `<article class="card">
    <div class="track-head"><div><span class="muted">เลขที่ ${esc(a.code)}</span><h3>${esc(s?.title || a.scholarshipTitle || '-')}</h3></div>${badge(st.label || a.status, st.tone, st.icon)}</div>
    ${reviewSteps(a)}
    ${a.status === 'needs_docs' || canAdd ? `<div class="notice tone-warning addfiles" data-app="${esc(a.code)}">${icon('paperclip')}<div><b>${a.status === 'needs_docs' ? 'เจ้าหน้าที่ขอเอกสารเพิ่มเติม' : 'แนบเอกสาร/หลักฐานเพิ่มเติม'}</b>
      <p>${esc([...(a.history || [])].reverse().find((h) => h.status === 'needs_docs')?.note || 'แนบไฟล์หลักฐานเพิ่มเติมได้ที่นี่')}</p>
      <div class="uploads">${uploadSlot('extra', 'เลือกไฟล์เอกสารเพิ่มเติม', false, true)}</div><button class="btn primary sm" data-send>${icon('upload')} ส่งเอกสารเพิ่มเติม</button></div></div>` : ''}
    <details class="table-toggle"><summary>ประวัติการดำเนินการ</summary>
    <ol class="timeline">${(a.history || []).slice().reverse().map((h) => `<li class="tone-${STATUS[h.status]?.tone || 'neutral'}"><b>${esc(STATUS[h.status]?.label || h.status)}</b><span>${thDateTime(h.at)}</span>${h.note ? `<p>${esc(h.note)}</p>` : ''}</li>`).join('')}</ol></details>
  </article>`;
}
function bindAddFiles(box, ident) {
  bindUploads(box);
  $('[data-send]', box).onclick = async (e) => {
    const files = gatherFiles(box);
    if (!files.length) return toast('กรุณาเลือกไฟล์', 'warning');
    e.target.disabled = true;
    try { await store.addFiles(ident, files); toast('ส่งเอกสารเพิ่มเติมแล้ว'); rerender(); } catch (err) { toast(err.message, 'critical'); e.target.disabled = false; }
  };
}

export const track = {
  title: 'ติดตามสถานะใบสมัคร', live: false,
  render() {
    return `<header class="page-head"><div><h1>ติดตามสถานะใบสมัคร</h1><p>กรอกเลขที่ใบสมัครและรหัสนักศึกษาเพื่อตรวจสอบผลการพิจารณา และแนบเอกสารเพิ่มเติม</p></div></header>
    <div class="track-layout"><form id="trackForm" class="card">
      <div class="form-grid cols-1">${field({ name: 'code', label: 'เลขที่ใบสมัคร', required: true, placeholder: 'เช่น TL69-ABC123' })}${field({ name: 'studentId', label: 'รหัสนักศึกษา', required: true, inputmode: 'numeric' })}</div>
      <button class="btn primary block">${icon('search')} ตรวจสอบสถานะ</button></form>
      <div id="trackResult"></div></div>`;
  },
  mount(el, v) {
    const form = $('#trackForm', el);
    form.onsubmit = async (e) => {
      e.preventDefault();
      const box = $('#trackResult', el);
      box.innerHTML = `<div class="card"><div class="skeleton"></div></div>`;
      const code = form.elements.code.value; const studentId = form.elements.studentId.value;
      try {
        const { application: a } = await store.track(code, studentId);
        box.innerHTML = appCard(a, v, { canAdd: !['approved', 'rejected'].includes(a.status) });
        const add = $('.addfiles', box);
        if (add) bindAddFiles(add, { code: code.trim().toUpperCase(), studentId: studentId.trim(), appId: store.isStaff ? a.id : undefined });
      } catch (err) { box.innerHTML = `<div class="notice tone-critical">${icon('alert')}<div><b>ไม่พบข้อมูล</b><p>${esc(err.message)}</p></div></div>`; }
    };
  },
};

export const my = {
  title: 'ใบสมัครของฉัน', live: true, student: true,
  render(v) {
    const mine = store.mine || [];
    return `<header class="page-head"><div><h1>ใบสมัครของฉัน</h1><p>${esc(store.user?.name)} · รหัส ${esc(store.user?.username)}</p></div><a class="btn primary" href="#/scholarships">${icon('plus')} สมัครทุนใหม่</a></header>
    <div class="stack">${mine.length ? mine.map((a) => appCard(a, v, { canAdd: !['approved', 'rejected'].includes(a.status) })).join('') : `<div class="card">${empty('ยังไม่มีใบสมัคร', 'file')}</div>`}</div>`;
  },
  mount(el) {
    $$('.addfiles', el).forEach((box) => { const a = (store.mine || []).find((x) => x.code === box.dataset.app); bindAddFiles(box, { appId: a.id }); });
  },
};

// ======================= ACCOUNT =======================
export const account = {
  title: 'บัญชีของฉัน', live: false, auth: true,
  render() {
    const u = store.user;
    const me = (store.view()?.users || []).find((x) => x.id === u.id) || u;
    const relay = store.mode === 'relay';
    const dept = store.view()?.departments.find((d) => d.id === u.departmentId);
    return `<header class="page-head"><div><span class="eyebrow">${icon('user')} บัญชีผู้ใช้งาน</span><h1>${esc(u.name)}</h1><p>${esc(ROLES[u.role]?.label)}${u.position ? ` · ${esc(u.position)}` : ''}${u.division ? ` · ${esc(u.division)}` : ''}${dept ? ` · ${esc(dept.name)}` : ''}</p></div></header>
    ${!relay ? `<div class="notice tone-info">${icon('key')}<div><b>เข้าสู่ระบบด้วย GitHub Token</b><p>บัญชีนี้เป็นผู้ดูแลระบบสูงสุด — ลายเซ็นของผู้บริหารแต่ละท่านกำหนดได้ที่ ตั้งค่า → ผู้ใช้งาน หรือให้แต่ละท่านเข้าสู่ระบบด้วยบัญชีของตนเองเพื่อลงลายมือชื่อ</p></div></div>` : ''}
    <div class="grid g-2">
      ${relay && u.role !== 'student' ? `<article class="card"><h3>${icon('pen')} ลายมือชื่ออิเล็กทรอนิกส์</h3>
        <p class="muted">ใช้ลงนามในขั้นตอนพิจารณาทุนและเอกสาร PDF — วาดลายเซ็นด้วยเมาส์/นิ้ว หรืออัปโหลดรูปลายเซ็นพื้นหลังโปร่งใส</p>
        ${me.signature ? `<div class="sig-current"><span>ลายเซ็นปัจจุบัน</span><img src="${esc(me.signature)}" alt="ลายเซ็น"></div>` : ''}
        <canvas id="sigPad" class="sig-pad"></canvas>
        <div class="btn-row"><button class="btn ghost" id="sigClear">${icon('refresh')} ล้าง</button><label class="btn ghost">${icon('upload')} อัปโหลดรูป<input type="file" id="sigFile" accept="image/png" hidden></label><button class="btn primary" id="sigSave">${icon('check')} บันทึกลายเซ็น</button></div></article>` : ''}
      ${relay ? `<form class="card" id="pwForm"><h3>${icon('key')} เปลี่ยนรหัสผ่าน</h3>
        <div class="form-grid cols-1">${field({ name: 'old', label: 'รหัสผ่านเดิม', type: 'password', required: true })}${field({ name: 'nw', label: 'รหัสผ่านใหม่ (อย่างน้อย 6 ตัวอักษร)', type: 'password', required: true })}${field({ name: 'nw2', label: 'ยืนยันรหัสผ่านใหม่', type: 'password', required: true })}</div>
        <button class="btn primary">${icon('check')} เปลี่ยนรหัสผ่าน</button></form>
        <form class="card" id="profForm"><h3>${icon('phone')} ข้อมูลติดต่อ</h3><div class="form-grid cols-1">${field({ name: 'phone', label: 'โทรศัพท์', type: 'tel' }, me.phone)}${field({ name: 'email', label: 'อีเมล', type: 'email' }, me.email)}</div><button class="btn primary">${icon('check')} บันทึก</button></form>` : ''}
    </div>`;
  },
  mount(el) {
    const canvas = $('#sigPad', el);
    if (canvas) {
      const pad = signaturePad(canvas);
      let uploaded = '';
      $('#sigClear', el).onclick = () => { pad.clear(); uploaded = ''; };
      $('#sigFile', el).onchange = (e) => {
        const f = e.target.files[0]; if (!f) return;
        if (f.size > 200000) return toast('ไฟล์ลายเซ็นต้องไม่เกิน 200 KB', 'warning');
        const r = new FileReader(); r.onload = () => { uploaded = r.result; toast('เลือกรูปลายเซ็นแล้ว กด "บันทึกลายเซ็น"'); }; r.readAsDataURL(f);
      };
      $('#sigSave', el).onclick = async () => {
        const data = uploaded || pad.toDataURL();
        if (!data) return toast('กรุณาวาดลายเซ็นก่อน', 'warning');
        try { await store.op('myProfile', { signature: data }, 'บันทึกลายเซ็น'); toast('บันทึกลายเซ็นแล้ว'); rerender(); } catch (err) { toast(err.message, 'critical'); }
      };
    }
    $('#pwForm', el)?.addEventListener('submit', async (e) => {
      e.preventDefault(); const f = e.target;
      if (f.nw.value !== f.nw2.value) return toast('รหัสผ่านใหม่ไม่ตรงกัน', 'warning');
      try { await store.changePassword(f.old.value, f.nw.value); toast('เปลี่ยนรหัสผ่านแล้ว'); f.reset(); } catch (err) { toast(err.message, 'critical'); }
    });
    $('#profForm', el)?.addEventListener('submit', async (e) => {
      e.preventDefault();
      try { await store.op('myProfile', { phone: e.target.phone.value, email: e.target.email.value }, 'แก้ไขข้อมูลติดต่อ'); toast('บันทึกแล้ว'); } catch (err) { toast(err.message, 'critical'); }
    });
  },
};
