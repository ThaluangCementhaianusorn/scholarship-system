// ส่วนบุคลากร/ผู้ดูแลระบบ: ใบสมัคร + การพิจารณา, ทุน, ผู้รับทุน, แหล่งทุน, ประกาศ, รายงาน, ตั้งค่า
import { $, $$, esc, num, baht, thDate, thDateTime, fileSize, icon, badge, toast, modal, confirmBox, formGrid, readForm, empty, bindImageFields } from './ui.js';
import { LEVELS, TYPES, STATUS, STAGES, ROLES, DIVISIONS, SCHOLARSHIP_STATUS, SPONSOR_CATEGORIES, DEFAULT_DOCS, eligibility, countsByScholarship, years } from './model.js';
import { appVisible } from './ops.js';
import { printApplication, printReport } from './print.js';
import { store, hashPassword, newSalt } from './store.js';
import { CONFIG } from './config.js';

const TABS = [
  ['', 'ภาพรวม', 'dashboard', 'staff'], ['applications', 'ใบสมัคร/พิจารณาทุน', 'clipboard', 'viewApps'], ['scholarships', 'ทุนการศึกษา', 'award', 'scholarships'],
  ['recipients', 'ผู้รับทุน', 'users', 'recipients'], ['sponsors', 'แหล่งทุน', 'building', 'sponsors'], ['announcements', 'ประกาศ', 'megaphone', 'announcements'],
  ['reports', 'รายงาน PDF', 'printer', 'reports'], ['settings', 'ตั้งค่าระบบ', 'settings', 'admin'],
];
export const adminTabs = () => TABS.filter((t) => store.can(t[3]));
const opt = (value, label, cur) => `<option value="${esc(value)}" ${String(cur) === String(value) ? 'selected' : ''}>${esc(label)}</option>`;
const db = () => store.db;
const deptName = (id) => db().departments.find((d) => d.id === id)?.name || '-';
const spName = (id) => db().sponsors.find((d) => d.id === id)?.name || '-';
const schTitle = (id) => db().scholarships.find((d) => d.id === id)?.title || '-';
const catName = (id) => db().categories.find((c) => c.id === id)?.name || '';
const fullName = (st = {}) => `${st.prefix || ''}${st.firstName || ''} ${st.lastName || ''}`.trim();
const rerender = () => window.dispatchEvent(new Event('rerender'));
const uploadImg = (f) => store.uploadPublicImage(f, 'posters');
async function run(type, payload, msg, ok = 'บันทึกเรียบร้อย') {
  try { const r = await store.op(type, payload, msg); toast(ok); return r ?? true; } catch (e) { toast(e.message, 'critical'); return false; }
}

function shell(tab, inner) {
  return `<header class="page-head"><div><span class="eyebrow">${icon('shield')} ${esc(ROLES[store.user.role]?.label)} · ${esc(store.user.name)}</span><h1>${esc(TABS.find((t) => t[0] === tab)?.[1] || '')}</h1></div>
    ${store.can('docCheck') ? `<div class="head-actions"><a class="btn ghost" href="#/scholarships">${icon('filePlus')} บันทึกใบสมัครแทนนักศึกษา</a></div>` : ''}</header>
  <nav class="tabs" aria-label="เมนูบุคลากร">${adminTabs().map(([k, l, ic]) => `<a href="#/admin${k ? `/${k}` : ''}" class="${k === tab ? 'active' : ''}">${icon(ic)}<span>${l}</span></a>`).join('')}</nav>
  ${db().meta?.sample && store.isAdmin ? `<div class="notice tone-info">${icon('database')}<div><b>ระบบกำลังแสดงข้อมูลตัวอย่าง</b><p>ลบข้อมูลตัวอย่างได้ที่ ตั้งค่าระบบ → ระบบ ก่อนเริ่มใช้งานจริง</p></div></div>` : ''}
  ${inner}`;
}

// ======================= LOGIN =======================
export const login = {
  title: 'เข้าสู่ระบบ', live: false,
  render() {
    const relay = !!store.relayUrl();
    return `<div class="login-wrap"><div class="card login">
      <img class="login-logo" src="${esc(store.view()?.institution?.logo || 'assets/img/logo.png')}" alt="">
      <h1>เข้าสู่ระบบ</h1>
      <p class="muted">ผู้ดูแลระบบ · ผู้อำนวยการ · รองผู้อำนวยการ · หัวหน้าแผนกวิชา · หัวหน้างานครูที่ปรึกษาและการแนะแนว · นักเรียน นักศึกษา</p>
      <div class="seg-tabs"><button class="active" data-t="pw">${icon('user')} บัญชีผู้ใช้</button><button data-t="tok">${icon('key')} GitHub Token (ผู้ดูแลระบบ)</button></div>
      <form id="pwForm" class="stack-sm">
        ${relay ? '' : `<div class="notice tone-warning">${icon('alert')}<div><b>ยังไม่เปิดใช้ระบบบัญชีผู้ใช้</b><p>ผู้ดูแลระบบต้องติดตั้ง Relay (Google Apps Script) และตั้งค่า Relay URL ก่อน — ระหว่างนี้ผู้ดูแลระบบเข้าสู่ระบบด้วย GitHub Token ได้</p></div></div>`}
        <div class="field"><label for="un">ชื่อผู้ใช้ / รหัสนักศึกษา</label><input id="un" autocomplete="username" required ${relay ? '' : 'disabled'}></div>
        <div class="field"><label for="pw">รหัสผ่าน</label><input id="pw" type="password" autocomplete="current-password" required ${relay ? '' : 'disabled'}></div>
        <button class="btn primary block lg" ${relay ? '' : 'disabled'}>${icon('user')} เข้าสู่ระบบ</button>
      </form>
      <form id="tokForm" class="stack-sm" hidden>
        <div class="field"><label for="tok">GitHub Personal Access Token</label><input id="tok" type="password" autocomplete="off" required placeholder="github_pat_..."></div>
        <button class="btn primary block lg">${icon('key')} เข้าสู่ระบบผู้ดูแลระบบ</button>
        <details class="howto"><summary>วิธีสร้าง Token</summary><ol>
          <li>เข้า GitHub ด้วยบัญชีเจ้าของระบบ → <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">Settings → Fine-grained tokens → Generate new token</a></li>
          <li>Resource owner: <b>${esc(CONFIG.owner)}</b> · Repository access: <b>Only select repositories</b> → <b>${esc(CONFIG.dbRepo)}</b> และ <b>${esc(CONFIG.siteRepo)}</b></li>
          <li>Repository permissions → <b>Contents: Read and write</b> → Generate แล้วคัดลอกมาวาง</li>
        </ol></details>
      </form>
    </div></div>`;
  },
  mount(el) {
    $$('[data-t]', el).forEach((b) => (b.onclick = () => { $$('[data-t]', el).forEach((x) => x.classList.toggle('active', x === b)); $('#pwForm', el).hidden = b.dataset.t !== 'pw'; $('#tokForm', el).hidden = b.dataset.t !== 'tok'; }));
    const go = () => { location.hash = store.isStudent ? '#/my' : '#/admin'; };
    const busy = (f, on) => { const b = $('button:not([type])', f) || $('button', f); b.disabled = on; };
    $('#pwForm', el).onsubmit = async (e) => {
      e.preventDefault(); busy(e.target, true);
      try { await store.loginPassword($('#un', el).value, $('#pw', el).value); toast(`ยินดีต้อนรับ ${store.user.name}`); go(); } catch (err) { toast(err.message, 'critical'); busy(e.target, false); }
    };
    $('#tokForm', el).onsubmit = async (e) => {
      e.preventDefault(); busy(e.target, true);
      try { await store.loginToken($('#tok', el).value); toast('เข้าสู่ระบบผู้ดูแลระบบสำเร็จ'); go(); } catch (err) { toast(err.message, 'critical'); busy(e.target, false); }
    };
  },
};

// ======================= OVERVIEW =======================
const visibleApps = () => db().applications.filter((a) => appVisible(store.user, a));
function myQueue() {
  const u = store.user;
  return visibleApps().filter((a) => {
    if (['approved', 'rejected'].includes(a.status)) return false;
    const rv = a.review || {};
    if (store.can('docCheck') && !rv.docCheck) return true;
    return STAGES.some((s) => !s.optional && !rv[s.key] && s.roles.includes(u.role) && store.can('stage', { stage: s.key, app: a }));
  });
}
export const overview = {
  title: 'บุคลากร · ภาพรวม', live: true, admin: 'staff',
  render() {
    const apps = visibleApps();
    const c = (...st) => apps.filter((a) => st.includes(a.status)).length;
    const counts = countsByScholarship(db().applications);
    const open = db().scholarships.filter((s) => s.status === 'open');
    const queue = myQueue();
    return shell('', `
    <section class="kpis">
      ${mini('file', 'ใบสมัครทั้งหมด', apps.length)}${mini('clock', 'รอพิจารณา', c('submitted', 'reviewing', 'interview'))}${mini('alert', 'เอกสารไม่ครบ', c('needs_docs'))}
      ${mini('check', 'อนุมัติแล้ว', c('approved'))}${mini('x', 'ไม่ผ่าน', c('rejected'))}
    </section>
    <section class="grid g-3-2">
      <article class="card"><header class="card-head"><div><h3>${icon('clipboard')} รายการรอการดำเนินการของฉัน</h3><p>ใบสมัครที่รอให้คุณตรวจเอกสาร/ให้ความเห็น/ลงนาม</p></div><span class="pill-count">${queue.length}</span></header>
        <div class="feed">${queue.slice(0, 8).map((a) => `<button class="feed-item as-btn" data-app="${esc(a.id)}"><div class="avatar sm">${esc((a.student?.firstName || '?')[0])}</div><div><div class="feed-title">${esc(fullName(a.student))}</div><p>${esc(schTitle(a.scholarshipId))} · ${esc(deptName(a.student?.departmentId).replace('แผนกวิชา', ''))}</p></div>${badge(STATUS[a.status]?.label, STATUS[a.status]?.tone)}</button>`).join('') || empty('ไม่มีรายการค้าง', 'check')}</div>
      </article>
      <article class="card"><header class="card-head"><div><h3>การใช้โควตาทุนที่เปิดรับ</h3><p>อนุมัติแล้ว / โควตา</p></div></header>
        ${open.length ? `<div class="quota-list">${open.map((s) => { const a = counts[s.id]?.approved || 0; return `<div class="meter"><div class="meter-top"><span>${esc(s.title)}</span><span>${a}/${num(s.quota)} · สมัคร ${counts[s.id]?.applicants || 0}</span></div><div class="meter-bar ${a > s.quota ? 'over' : ''}"><i style="width:${Math.min(100, (a / (s.quota || 1)) * 100)}%"></i></div></div>`; }).join('')}</div>` : empty('ไม่มีทุนที่เปิดรับ', 'award')}
      </article>
    </section>`);
  },
  mount(el) { $$('[data-app]', el).forEach((b) => (b.onclick = () => appDetail(b.dataset.app))); },
};
const mini = (ic, label, n) => `<article class="kpi"><div class="kpi-ic">${icon(ic)}</div><div class="kpi-body"><span class="kpi-label">${label}</span><div class="kpi-value">${num(n)}</div></div></article>`;

// ======================= APPLICATIONS =======================
const af = { q: '', sch: '', status: '', dept: '', year: '', cat: '', mine: false };
export const applications = {
  title: 'บุคลากร · ใบสมัคร', live: true, admin: 'viewApps',
  render() {
    const v = store.view();
    return shell('applications', `<div class="filters">
      <label class="search">${icon('search')}<input id="q" type="search" placeholder="ค้นหาชื่อ รหัสนักศึกษา หรือเลขที่ใบสมัคร" value="${esc(af.q)}"></label>
      <select id="fYear">${opt('', 'ทุกปีการศึกษา', af.year)}${years(v).map((y) => opt(y, `ปี ${y}`, af.year)).join('')}</select>
      <select id="fCat">${opt('', 'ทุกประเภททุน', af.cat)}${db().categories.map((c) => opt(c.id, c.name, af.cat)).join('')}</select>
      <select id="fSch">${opt('', 'ทุกทุนการศึกษา', af.sch)}${db().scholarships.map((s) => opt(s.id, `${s.title} (${s.year})`, af.sch)).join('')}</select>
      <select id="fStatus">${opt('', 'ทุกสถานะ', af.status)}${Object.entries(STATUS).map(([k, s]) => opt(k, s.label, af.status)).join('')}</select>
      ${store.user.role === 'depthead' ? '' : `<select id="fDept">${opt('', 'ทุกแผนกวิชา', af.dept)}${db().departments.map((d) => opt(d.id, d.name, af.dept)).join('')}</select>`}
      <label class="switch inline"><input type="checkbox" id="fMine" ${af.mine ? 'checked' : ''}><span>เฉพาะที่รอฉัน</span></label>
      <button class="btn ghost" id="csv">${icon('download')} CSV</button>
    </div><article class="card flush"><div id="appTable"></div></article>`);
  },
  mount(el) {
    const filtered = () => {
      const q = af.q.toLowerCase();
      const queue = af.mine ? new Set(myQueue().map((a) => a.id)) : null;
      return visibleApps().filter((a) => {
        const s = db().scholarships.find((x) => x.id === a.scholarshipId) || {};
        return (!q || `${fullName(a.student)} ${a.student?.studentId} ${a.code}`.toLowerCase().includes(q)) && (!af.sch || a.scholarshipId === af.sch) && (!af.status || a.status === af.status) && (!af.dept || a.student?.departmentId === af.dept) && (!af.year || String(a.year) === af.year) && (!af.cat || s.categoryId === af.cat) && (!queue || queue.has(a.id));
      }).sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''));
    };
    const draw = () => {
      const list = filtered();
      $('#appTable', el).innerHTML = list.length ? `<div class="table-wrap"><table class="table hover"><thead><tr><th>เลขที่</th><th>ผู้สมัคร</th><th>แผนก/ระดับ</th><th class="n">GPA</th><th>ทุน</th><th>ความคืบหน้า</th><th>สถานะ</th></tr></thead><tbody>
        ${list.map((a) => `<tr data-app="${esc(a.id)}" tabindex="0"><td><code>${esc(a.code)}</code><small class="block muted">${thDate(a.submittedAt)}</small></td><td><b>${esc(fullName(a.student))}</b><small class="block muted">${esc(a.student?.studentId)}</small></td><td>${esc(deptName(a.student?.departmentId).replace('แผนกวิชา', ''))}<small class="block muted">${esc(a.student?.level)} ปี ${esc(a.student?.classYear)}</small></td><td class="n">${esc(a.student?.gpa)}</td><td>${esc(schTitle(a.scholarshipId))}<small class="block muted">${icon('paperclip')} ${(a.files || []).length} ไฟล์</small></td><td>${progressDots(a)}</td><td>${badge(STATUS[a.status]?.label || a.status, STATUS[a.status]?.tone, STATUS[a.status]?.icon)}</td></tr>`).join('')}
      </tbody></table></div><div class="table-foot">${list.length} รายการ</div>` : empty('ไม่พบใบสมัคร', 'file');
      $$('[data-app]', el).forEach((r) => { r.onclick = () => appDetail(r.dataset.app); r.onkeydown = (e) => e.key === 'Enter' && appDetail(r.dataset.app); });
    };
    $('#q', el).oninput = (e) => { af.q = e.target.value; draw(); };
    [['#fSch', 'sch'], ['#fStatus', 'status'], ['#fDept', 'dept'], ['#fYear', 'year'], ['#fCat', 'cat']].forEach(([id, k]) => { const s = $(id, el); if (s) s.onchange = (e) => { af[k] = e.target.value; draw(); }; });
    $('#fMine', el).onchange = (e) => { af.mine = e.target.checked; draw(); };
    $('#csv', el).onclick = () => downloadCSV(`applications_${new Date().toISOString().slice(0, 10)}.csv`,
      ['เลขที่', 'รหัสนักศึกษา', 'ชื่อ-สกุล', 'ระดับ', 'ชั้นปี', 'แผนกวิชา', 'GPA', 'โทรศัพท์', 'รายได้ครอบครัว/ปี', 'ทุน', 'ประเภททุน', 'สถานะ', 'วันที่ยื่น'],
      filtered().map((a) => { const s = db().scholarships.find((x) => x.id === a.scholarshipId) || {}; return [a.code, a.student?.studentId, fullName(a.student), a.student?.level, a.student?.classYear, deptName(a.student?.departmentId), a.student?.gpa, a.student?.phone, a.student?.income, s.title, catName(s.categoryId), STATUS[a.status]?.label, a.submittedAt?.slice(0, 10)]; }));
    draw();
  },
};
function progressDots(a) {
  const rv = a.review || {};
  const steps = [['เอกสาร', rv.docCheck, rv.docCheck?.result === 'incomplete'], ...STAGES.filter((s) => !s.optional).map((s) => [s.label.replace(/ความเห็น|ผลการพิจารณาของ/g, '').replace('หัวหน้างานครูที่ปรึกษาและการแนะแนว', 'งานแนะแนว'), rv[s.key], rv[s.key] && ['oppose', 'reject'].includes(rv[s.key].decision)])];
  return `<div class="dots">${steps.map(([l, done, bad]) => `<i class="${done ? (bad ? 'bad' : 'done') : ''}" title="${esc(l)}"></i>`).join('')}</div>`;
}

function meWithSig() { return (store.view()?.users || []).find((u) => u.id === store.user.id); }

function appDetail(id) {
  const a = db().applications.find((x) => x.id === id);
  if (!a) return;
  const v = store.view();
  const s = db().scholarships.find((x) => x.id === a.scholarshipId) || {};
  const st = a.student || {};
  const rv = a.review || {};
  const elig = eligibility({ ...s, status: 'open', openDate: '', deadline: '' }, st).checks.slice(0, -1);
  const approvedCount = db().applications.filter((x) => x.scholarshipId === a.scholarshipId && x.status === 'approved').length;
  const canDoc = store.can('docCheck');
  const me = meWithSig();
  const sigImg = (r) => (r?.signed ? `<img class="sig-img" src="${esc((v.users || []).find((u) => u.id === r.by)?.signature || '')}" alt="ลายเซ็น">` : '');
  const docsReview = rv.docs || {};
  const stageBlock = (stg) => {
    const r = rv[stg.key];
    const allowed = store.can('stage', { stage: stg.key, app: a });
    const head = `<div class="stage-head"><b>${esc(stg.label)}</b>${stg.optional ? '<span class="muted small">(ถ้ามี)</span>' : ''}</div>`;
    const done = r ? `<div class="stage-done ${['oppose', 'reject'].includes(r.decision) ? 'bad' : 'ok'}">${badge(stg.decisions[r.decision], ['oppose', 'reject'].includes(r.decision) ? 'critical' : r.decision === 'waitlist' ? 'neutral' : 'good')}
      ${r.note ? `<p>${esc(r.note)}</p>` : ''}<div class="signed">${sigImg(r)}<span>${esc(r.name)}<small>${esc(r.position)} · ${thDateTime(r.at)}${r.signed ? ' · ลงนามอิเล็กทรอนิกส์' : ''}</small></span></div></div>` : '';
    const form = allowed && !['approved', 'rejected'].includes(a.status) || (allowed && stg.key === 'director') ? `<form class="stage-form" data-stage="${stg.key}">
      <div class="seg-choice">${Object.entries(stg.decisions).map(([k, l], i) => `<label><input type="radio" name="decision" value="${k}" ${r ? (r.decision === k ? 'checked' : '') : i === 0 ? 'checked' : ''}><span>${esc(l)}</span></label>`).join('')}</div>
      <textarea name="note" rows="2" placeholder="ความเห็นเพิ่มเติม">${esc(r?.note || '')}</textarea>
      <label class="switch"><input type="checkbox" name="sign" ${me?.signature ? 'checked' : 'disabled'}><span>${me?.signature ? 'ลงลายมือชื่ออิเล็กทรอนิกส์' : store.mode === 'relay' ? 'ยังไม่มีลายเซ็น — ตั้งค่าได้ที่ <a href="#/account" data-close>บัญชีของฉัน</a>' : 'บัญชี GitHub Token ไม่มีลายเซ็นอิเล็กทรอนิกส์'}</span></label>
      <button class="btn primary sm">${icon('pen')} ${r ? 'แก้ไขและลงนาม' : 'บันทึกและลงนาม'}</button></form>` : (!r ? `<p class="muted small">รอ${esc(stg.roles.map((x) => ROLES[x].label).join('/'))}</p>` : '');
    return `<div class="stage ${r ? 'is-done' : ''}">${head}${done}${form}</div>`;
  };
  modal({
    title: `ใบสมัคร ${a.code}`, size: 'xl',
    body: `<div class="app-detail">
      <div class="app-main">
        <div class="app-person"><div class="avatar lg">${esc((st.firstName || '?')[0])}</div><div><h3>${esc(fullName(st))}</h3><p class="muted">รหัส ${esc(st.studentId)} · ${esc(st.level)} ปีที่ ${esc(st.classYear)} · ${esc(deptName(st.departmentId))}</p></div>${badge(STATUS[a.status]?.label, STATUS[a.status]?.tone, STATUS[a.status]?.icon)}</div>
        <dl class="dl">
          <dt>ทุนที่สมัคร</dt><dd>${esc(s.title)} (${baht(s.amount)})${catName(s.categoryId) ? ` · ${esc(catName(s.categoryId))}` : ''}</dd>
          <dt>GPA</dt><dd>${esc(st.gpa)}</dd><dt>โทรศัพท์</dt><dd>${esc(st.phone)}</dd><dt>อีเมล</dt><dd>${esc(st.email || '-')}</dd>
          <dt>ที่อยู่</dt><dd>${esc(st.address)}</dd>
          <dt>ผู้ปกครอง</dt><dd>${esc(st.parentName)} (${esc(st.parentRelation || '-')}) · ${esc(st.parentJob)} · ${esc(st.parentPhone || '')}</dd>
          <dt>รายได้ครอบครัว</dt><dd>${st.income !== '' && st.income != null ? `${baht(st.income)}/ปี` : '-'} · พี่น้อง ${esc(st.siblings ?? '-')} คน</dd>
        </dl>
        <h4>เหตุผลความจำเป็น</h4><p class="prose">${esc(a.reason).replace(/\n/g, '<br>')}</p>
        ${a.achievements ? `<h4>ผลงาน / กิจกรรม</h4><p class="prose">${esc(a.achievements).replace(/\n/g, '<br>')}</p>` : ''}

        <h4>${icon('clipboard')} ขั้นตอนที่ 1 · ตรวจสอบเอกสารและหลักฐาน (${(a.files || []).length} ไฟล์)</h4>
        <form id="docForm" class="doc-review">
        <ul class="file-list big">${(a.files || []).map((f, i) => { const d = docsReview[i] || {}; return `<li class="${d.ok === true ? 'ok' : d.ok === false ? 'bad' : ''}">${icon('paperclip')}<span><b>${esc(f.label || 'เอกสาร')}</b><small class="block muted">${esc(f.name)}${f.size ? ` · ${fileSize(f.size)}` : ''}${f.addedAt ? ` · แนบเพิ่ม ${thDate(f.addedAt)}` : ''}</small>
          ${canDoc ? `<span class="doc-check"><label><input type="radio" name="d${i}" value="1" ${d.ok === true ? 'checked' : ''}><span>${icon('check')} ถูกต้อง</span></label><label><input type="radio" name="d${i}" value="0" ${d.ok === false ? 'checked' : ''}><span>${icon('x')} ไม่ถูกต้อง</span></label><input name="n${i}" placeholder="หมายเหตุ" value="${esc(d.note || '')}"></span>` : d.ok != null ? badge(d.ok ? 'ถูกต้อง' : 'ไม่ถูกต้อง', d.ok ? 'good' : 'critical') : ''}</span>
          ${f.path ? `<button type="button" class="btn ghost sm" data-file="${i}">${icon('eye')} เปิดดู</button>` : ''}</li>`; }).join('') || '<li class="muted">ไม่มีเอกสารแนบ</li>'}</ul>
        ${(s.documents || []).filter((d) => !(a.files || []).some((f) => f.label === d)).map((d) => `<div class="notice tone-warning slim">${icon('alert')}<span>ยังไม่ได้แนบ: ${esc(d)}</span></div>`).join('')}
        ${rv.docCheck ? `<div class="stage-done ${rv.docCheck.result === 'complete' ? 'ok' : 'bad'}">${badge(rv.docCheck.result === 'complete' ? 'เอกสารครบถ้วน' : 'เอกสารไม่ครบถ้วน', rv.docCheck.result === 'complete' ? 'good' : 'warning')} <span class="muted small">${esc(rv.docCheck.name)} · ${thDateTime(rv.docCheck.at)}</span>${rv.docCheck.note ? `<p>${esc(rv.docCheck.note)}</p>` : ''}</div>` : ''}
        ${canDoc ? `<div class="doc-actions"><input name="note" placeholder="แจ้งนักศึกษา เช่น ขอสำเนาทะเบียนบ้านเพิ่มเติม"><button type="button" class="btn ghost sm" data-doc="incomplete">${icon('alert')} เอกสารไม่ครบ/ขอเพิ่ม</button><button type="button" class="btn primary sm" data-doc="complete">${icon('check')} เอกสารครบถ้วน</button></div>` : ''}
        </form>
      </div>
      <aside class="app-side">
        <h4>ตรวจสอบคุณสมบัติ</h4>
        <ul class="elig">${elig.map((c) => `<li class="${c.ok === true ? 'ok' : c.ok === false ? 'bad' : 'wait'}">${icon(c.ok ? 'check' : c.ok === false ? 'x' : 'clock')}<span>${esc(c.label)}</span></li>`).join('')}</ul>
        <div class="side-row"><span>อนุมัติแล้ว/โควตา</span><b>${approvedCount}/${num(s.quota)}</b></div>
        <h4>${icon('pen')} ขั้นตอนพิจารณาและลงนาม</h4>
        ${STAGES.map(stageBlock).join('')}
        ${store.can('setStatus') ? `<details class="override"><summary>ปรับสถานะด้วยตนเอง (เจ้าหน้าที่)</summary><form id="statusForm"><select name="status">${Object.entries(STATUS).map(([k, x]) => opt(k, x.label, a.status)).join('')}</select><input name="note" placeholder="หมายเหตุ เช่น นัดสัมภาษณ์วันที่..."><button class="btn ghost sm">บันทึกสถานะ</button></form></details>` : ''}
        <h4>ประวัติ</h4>
        <ol class="timeline compact">${(a.history || []).slice().reverse().map((h) => `<li class="tone-${STATUS[h.status]?.tone || 'neutral'}"><b>${esc(STATUS[h.status]?.label || h.status)}</b><span>${thDateTime(h.at)} · ${esc(h.by || '')}</span>${h.note ? `<p>${esc(h.note)}</p>` : ''}</li>`).join('')}</ol>
      </aside></div>`,
    actions: `${store.isAdmin ? `<button class="btn danger-ghost" data-del>${icon('trash')} ลบใบสมัคร</button>` : ''}<span class="spacer"></span><button class="btn ghost" data-print>${icon('printer')} ใบสมัคร + ผลพิจารณา PDF (A4)</button>`,
    onMount: (m, api) => {
      const reopen = () => { api.close(); setTimeout(() => appDetail(id), 250); };
      $$('[data-file]', m).forEach((b) => (b.onclick = async () => { b.disabled = true; try { await store.openFile(a.files[b.dataset.file]); } catch (e) { toast(e.message, 'critical'); } b.disabled = false; }));
      $('[data-print]', m).onclick = () => printApplication(db().applications.find((x) => x.id === id), store.view());
      $('[data-del]', m)?.addEventListener('click', async () => {
        if (!(await confirmBox(`ลบใบสมัคร ${a.code} ของ ${fullName(st)}?`, { okText: 'ลบ', tone: 'danger' }))) return;
        if (await run('deleteApp', { appId: a.id }, `ลบใบสมัคร ${a.code}`, 'ลบใบสมัครแล้ว')) api.close();
      });
      $$('[data-doc]', m).forEach((b) => (b.onclick = async () => {
        const f = $('#docForm', m); const docs = {};
        (a.files || []).forEach((_, i) => { const r = f.querySelector(`input[name="d${i}"]:checked`); docs[i] = { ok: r ? r.value === '1' : null, note: f.elements[`n${i}`]?.value || '' }; });
        if (b.dataset.doc === 'complete' && Object.values(docs).some((d) => d.ok === false) && !(await confirmBox('มีเอกสารที่ทำเครื่องหมาย "ไม่ถูกต้อง" ยืนยันว่าเอกสารครบถ้วน?'))) return;
        b.disabled = true;
        if (await run('docCheck', { appId: a.id, docs, result: b.dataset.doc, note: f.elements.note.value }, `ตรวจเอกสาร ${a.code}`, b.dataset.doc === 'complete' ? 'บันทึก: เอกสารครบถ้วน' : 'แจ้งนักศึกษาให้แนบเอกสารเพิ่มแล้ว')) reopen(); else b.disabled = false;
      }));
      $$('.stage-form', m).forEach((f) => (f.onsubmit = async (e) => {
        e.preventDefault();
        const stage = f.dataset.stage; const decision = f.querySelector('input[name=decision]:checked')?.value;
        if (stage === 'director' && decision === 'approve' && a.status !== 'approved' && approvedCount >= Number(s.quota || 0) && !(await confirmBox(`ทุนนี้อนุมัติครบโควตา ${s.quota} ทุนแล้ว ต้องการอนุมัติเกินโควตาหรือไม่?`, { okText: 'อนุมัติเกินโควตา' }))) return;
        $('button', f).disabled = true;
        if (await run('stage', { appId: a.id, stage, decision, note: f.elements.note.value, sign: f.elements.sign.checked }, `${stage} ${a.code}`, 'บันทึกความเห็นและลงนามแล้ว')) reopen(); else $('button', f).disabled = false;
      }));
      $('#statusForm', m)?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (await run('setStatus', { appId: a.id, status: e.target.status.value, note: e.target.note.value }, `${a.code} สถานะ`, 'บันทึกสถานะแล้ว')) reopen();
      });
    },
  });
}

// ======================= GENERIC CRUD =======================
function crud(cfg) {
  const state = { q: '' };
  const body = () => `<div class="filters">
        <label class="search">${icon('search')}<input id="q" type="search" placeholder="ค้นหา" value="${esc(state.q)}"></label>
        ${cfg.extraFilter ? cfg.extraFilter(state) : ''}
        <button class="btn primary" id="add">${icon('plus')} เพิ่ม${cfg.noun}</button>
      </div><article class="card flush"><div id="tbl"></div></article>`;
  return {
    title: `บุคลากร · ${cfg.title}`, live: true, admin: cfg.collection,
    body, render() { return shell(cfg.tab, body()); },
    mount(el) {
      const draw = () => {
        const q = state.q.toLowerCase();
        const rows = (db()[cfg.collection] || []).filter((r) => (!q || cfg.searchText(r).toLowerCase().includes(q)) && (!cfg.filterFn || cfg.filterFn(r, state))).sort(cfg.sort || (() => 0));
        $('#tbl', el).innerHTML = rows.length ? `<div class="table-wrap"><table class="table hover"><thead><tr>${cfg.columns.map((c) => `<th class="${c.cls || ''}">${c.label}</th>`).join('')}<th class="n">จัดการ</th></tr></thead><tbody>
          ${rows.map((r) => `<tr>${cfg.columns.map((c) => `<td class="${c.cls || ''}">${c.render(r)}</td>`).join('')}<td class="n nowrap"><button class="icon-btn" data-edit="${esc(r.id)}" aria-label="แก้ไข">${icon('edit')}</button><button class="icon-btn danger" data-del="${esc(r.id)}" aria-label="ลบ">${icon('trash')}</button></td></tr>`).join('')}
          </tbody></table></div><div class="table-foot">${rows.length} รายการ</div>` : empty('ไม่พบข้อมูล');
        $$('[data-edit]', el).forEach((b) => (b.onclick = () => edit(db()[cfg.collection].find((r) => r.id === b.dataset.edit))));
        $$('[data-del]', el).forEach((b) => (b.onclick = async () => {
          const item = db()[cfg.collection].find((r) => r.id === b.dataset.del);
          if (!(await confirmBox(`ลบ "${cfg.label(item)}" ใช่หรือไม่?`, { okText: 'ลบ', tone: 'danger' }))) return;
          run('delete', { collection: cfg.collection, id: item.id }, `ลบ${cfg.noun} ${cfg.label(item)}`, 'ลบแล้ว');
        }));
      };
      const edit = (item) => {
        const isNew = !item;
        const fields = cfg.fields();
        const data = item || (cfg.defaults ? cfg.defaults() : {});
        modal({
          title: `${isNew ? 'เพิ่ม' : 'แก้ไข'}${cfg.noun}`, size: cfg.size || 'lg',
          body: `<form id="crudForm" novalidate>${formGrid(fields, data)}</form>`,
          actions: `<button class="btn ghost" data-close>ยกเลิก</button><button class="btn primary" data-save>${icon('check')} บันทึก</button>`,
          onMount: (m, api) => {
            const form = $('#crudForm', m);
            bindImageFields(form, uploadImg);
            cfg.onFormMount?.(form);
            const submit = async () => {
              if (!form.checkValidity()) { form.reportValidity(); return; }
              const vals = readForm(form, fields);
              const b = $('[data-save]', m); b.disabled = true;
              const ok = await run('save', { collection: cfg.collection, item: isNew ? vals : { ...vals, id: item.id } }, `${isNew ? 'เพิ่ม' : 'แก้ไข'}${cfg.noun} ${cfg.label(vals)}`);
              if (ok) api.close(); else b.disabled = false;
            };
            $('[data-save]', m).onclick = submit;
            form.onsubmit = (e) => { e.preventDefault(); submit(); };
          },
        });
      };
      $('#q', el).oninput = (e) => { state.q = e.target.value; draw(); };
      $$('[data-f]', el).forEach((s) => (s.onchange = (e) => { state[s.dataset.f] = e.target.value; draw(); }));
      $('#add', el).onclick = () => edit(null);
      draw();
    },
  };
}

const deptOptions = () => db().departments.map((d) => ({ value: d.id, label: d.name.replace('แผนกวิชา', '') }));
const spOptions = () => db().sponsors.map((s) => ({ value: s.id, label: s.name }));
const catOptions = () => db().categories.map((c) => ({ value: c.id, label: c.name }));
const yearOptions = () => { const ys = new Set(db().academicYears.map((y) => String(y.year))); const y = Number(store.currentYear()) || new Date().getFullYear() + 543; [y + 1, y, y - 1, y - 2].forEach((x) => ys.add(String(x))); return [...ys].sort().reverse().map((x) => ({ value: x, label: x })); };
const yearFilter = (s) => `<select data-f="year">${opt('', 'ทุกปีการศึกษา', s.year)}${years(store.view()).map((y) => opt(y, `ปี ${y}`, s.year)).join('')}</select>`;

export const adminScholarships = crud({
  tab: 'scholarships', title: 'ทุนการศึกษา', noun: 'ทุนการศึกษา', collection: 'scholarships',
  label: (r) => r.title, searchText: (r) => `${r.title} ${spName(r.sponsorId)}`,
  extraFilter: (s) => `${yearFilter(s)}<select data-f="cat">${opt('', 'ทุกประเภททุน', s.cat)}${catOptions().map((c) => opt(c.value, c.label, s.cat)).join('')}</select>`,
  filterFn: (r, s) => (!s.year || String(r.year) === s.year) && (!s.cat || r.categoryId === s.cat),
  sort: (a, b) => String(b.year).localeCompare(String(a.year)) || (a.deadline || '').localeCompare(b.deadline || ''),
  defaults: () => ({ year: store.currentYear(), type: 'external', status: 'open', levels: [...LEVELS], documents: [...DEFAULT_DOCS], quota: 1 }),
  columns: [
    { label: 'ทุนการศึกษา', render: (r) => `<div class="row-media">${r.poster ? `<img src="${esc(r.poster)}" alt="">` : ''}<div><b>${esc(r.title)}</b><small class="block muted">${esc(spName(r.sponsorId))}</small></div></div>` },
    { label: 'ปี', render: (r) => esc(r.year) },
    { label: 'ประเภท', render: (r) => `${catName(r.categoryId) ? badge(catName(r.categoryId), 'info') : '-'}<small class="block muted">${esc(TYPES[r.type] || '')}</small>` },
    { label: 'จำนวนเงิน', cls: 'n', render: (r) => num(r.amount) },
    { label: 'โควตา', cls: 'n', render: (r) => { const c = countsByScholarship(db().applications)[r.id] || {}; return `${c.approved || 0}/${num(r.quota)}<small class="block muted">สมัคร ${c.applicants || 0}</small>`; } },
    { label: 'ปิดรับ', render: (r) => thDate(r.deadline) },
    { label: 'สถานะ', render: (r) => badge(SCHOLARSHIP_STATUS[r.status]?.label, SCHOLARSHIP_STATUS[r.status]?.tone) },
  ],
  fields: () => [
    { name: 'title', label: 'ชื่อทุนการศึกษา', required: true, span: 3 },
    { name: 'categoryId', label: 'ประเภททุน', type: 'select', options: catOptions(), required: true, empty: 'เลือกประเภททุน' },
    { name: 'sponsorId', label: 'หน่วยงานผู้ให้ทุน', type: 'select', options: spOptions(), required: true, empty: 'เลือกหน่วยงาน', span: 2 },
    { name: 'type', label: 'แหล่งทุน', type: 'select', options: Object.entries(TYPES).map(([k, l]) => ({ value: k, label: l })) },
    { name: 'year', label: 'ปีการศึกษา', type: 'select', options: yearOptions(), required: true },
    { name: 'status', label: 'สถานะ', type: 'select', options: Object.entries(SCHOLARSHIP_STATUS).map(([k, s]) => ({ value: k, label: s.label })) },
    { name: 'amount', label: 'จำนวนเงิน (บาท/ทุน)', type: 'number', min: 0, required: true },
    { name: 'quota', label: 'จำนวนทุน (โควตา)', type: 'number', min: 1, required: true },
    { name: 'minGpa', label: 'เกรดเฉลี่ยขั้นต่ำ', type: 'number', step: '0.01', min: 0, max: 4 },
    { name: 'openDate', label: 'วันเปิดรับสมัคร', type: 'date' },
    { name: 'deadline', label: 'วันปิดรับสมัคร', type: 'date', required: true },
    { name: 'maxIncome', label: 'รายได้ครอบครัวสูงสุด (บาท/ปี)', type: 'number', min: 0, hint: 'เว้นว่าง = ไม่จำกัด' },
    { name: 'levels', label: 'ระดับชั้นที่สมัครได้', type: 'chips', options: LEVELS.map((l) => ({ value: l, label: l })), span: 3 },
    { name: 'departments', label: 'แผนกวิชาที่สมัครได้ (ไม่เลือก = ทุกแผนก)', type: 'chips', options: deptOptions(), span: 3 },
    { name: 'poster', label: 'โปสเตอร์ประชาสัมพันธ์', type: 'image', span: 3 },
    { name: 'description', label: 'รายละเอียดทุน', type: 'textarea', rows: 3, span: 3 },
    { name: 'requirements', label: 'คุณสมบัติผู้สมัครเพิ่มเติม (บรรทัดละ 1 ข้อ)', type: 'lines', span: 3 },
    { name: 'documents', label: 'เอกสาร/หลักฐานที่ต้องแนบ (บรรทัดละ 1 รายการ)', type: 'lines', span: 3 },
  ],
});

export const adminSponsors = crud({
  tab: 'sponsors', title: 'แหล่งทุน', noun: 'แหล่งทุน', collection: 'sponsors',
  label: (r) => r.name, searchText: (r) => `${r.name} ${r.category} ${r.contact}`,
  sort: (a, b) => a.name.localeCompare(b.name, 'th'),
  defaults: () => ({ type: 'external', category: SPONSOR_CATEGORIES[0] }),
  columns: [
    { label: 'หน่วยงาน', render: (r) => `<b>${esc(r.name)}</b><small class="block muted">${esc(r.category || '')}</small>` },
    { label: 'ประเภท', render: (r) => badge(TYPES[r.type], r.type === 'external' ? 'info' : 'neutral') },
    { label: 'ผู้ประสานงาน', render: (r) => `${esc(r.contact || '-')}<small class="block muted">${esc(r.phone || '')} ${esc(r.email || '')}</small>` },
    { label: 'ยอดทุนสะสม', cls: 'n', render: (r) => num(db().recipients.filter((x) => x.sponsorId === r.id).reduce((t, x) => t + (Number(x.amount) || 0), 0)) },
  ],
  fields: () => [
    { name: 'name', label: 'ชื่อหน่วยงาน', required: true, span: 3 },
    { name: 'type', label: 'ประเภท', type: 'select', options: Object.entries(TYPES).map(([k, l]) => ({ value: k, label: l })) },
    { name: 'category', label: 'หมวดหมู่', type: 'select', options: SPONSOR_CATEGORIES.map((c) => ({ value: c, label: c })) },
    { name: 'contact', label: 'ผู้ประสานงาน' },
    { name: 'phone', label: 'โทรศัพท์' }, { name: 'email', label: 'อีเมล', type: 'email' }, { name: 'website', label: 'เว็บไซต์', type: 'url', placeholder: 'https://' },
    { name: 'description', label: 'รายละเอียด', type: 'textarea', span: 3 },
  ],
});

export const adminAnnouncements = crud({
  tab: 'announcements', title: 'ประกาศ', noun: 'ประกาศ', collection: 'announcements',
  label: (r) => r.title, searchText: (r) => `${r.title} ${r.body}`,
  sort: (a, b) => (b.date || '').localeCompare(a.date || ''),
  defaults: () => ({ date: new Date().toISOString().slice(0, 10) }),
  columns: [
    { label: 'หัวข้อ', render: (r) => `<div class="row-media">${r.poster ? `<img src="${esc(r.poster)}" alt="">` : ''}<div>${r.pinned ? icon('pin', 'pin') : ''}<b>${esc(r.title)}</b><small class="block muted">${esc((r.body || '').slice(0, 80))}</small></div></div>` },
    { label: 'วันที่', render: (r) => `${thDate(r.date)}<small class="block muted">${esc(r.author || '')}</small>` },
    { label: 'แท็ก', render: (r) => (r.tag ? badge(r.tag, 'info') : '-') },
    { label: 'สถานะ', render: (r) => (r.draft ? badge('ฉบับร่าง', 'warning') : badge('เผยแพร่', 'good')) },
  ],
  fields: () => [
    { name: 'title', label: 'หัวข้อประกาศ', required: true, span: 3 },
    { name: 'date', label: 'วันที่ประกาศ', type: 'date', required: true },
    { name: 'tag', label: 'แท็ก', placeholder: 'เช่น เปิดรับสมัคร, ประกาศผล' },
    { name: 'scholarshipId', label: 'เชื่อมกับทุน', type: 'select', empty: '— ไม่ระบุ —', options: db().scholarships.map((s) => ({ value: s.id, label: `${s.title} (${s.year})` })) },
    { name: 'sponsorId', label: 'หน่วยงาน', type: 'select', empty: '— ไม่ระบุ —', options: spOptions(), span: 2 },
    { name: 'link', label: 'ลิงก์ภายนอก', type: 'url', placeholder: 'https://' },
    { name: 'poster', label: 'รูปภาพ/โปสเตอร์ประชาสัมพันธ์', type: 'image', span: 3 },
    { name: 'body', label: 'รายละเอียดประกาศ', type: 'textarea', rows: 6, required: true, span: 3 },
    { name: 'pinned', label: 'ปักหมุด', type: 'checkbox', text: 'แสดงไว้บนสุด' },
    { name: 'draft', label: 'ฉบับร่าง', type: 'checkbox', text: 'ยังไม่เผยแพร่' },
  ],
});

export const adminRecipients = crud({
  tab: 'recipients', title: 'ผู้รับทุน', noun: 'ผู้รับทุน', collection: 'recipients',
  label: (r) => r.name, searchText: (r) => `${r.name} ${r.studentId} ${r.scholarshipTitle}`,
  extraFilter: (s) => `${yearFilter(s)}<select data-f="cat">${opt('', 'ทุกประเภททุน', s.cat)}${catOptions().map((c) => opt(c.value, c.label, s.cat)).join('')}</select><select data-f="dept">${opt('', 'ทุกแผนกวิชา', s.dept)}${deptOptions().map((c) => opt(c.value, c.label, s.dept)).join('')}</select>`,
  filterFn: (r, s) => (!s.year || String(r.year) === s.year) && (!s.cat || r.categoryId === s.cat) && (!s.dept || r.departmentId === s.dept),
  sort: (a, b) => String(b.year).localeCompare(String(a.year)) || a.name.localeCompare(b.name, 'th'),
  defaults: () => ({ year: store.currentYear(), type: 'external', level: 'ปวช.' }),
  columns: [
    { label: 'ชื่อ-สกุล', render: (r) => `<b>${esc(r.name)}</b><small class="block muted">${esc(r.studentId)}${r.appId ? ' · จากใบสมัคร' : ''}</small>` },
    { label: 'ระดับ/แผนก', render: (r) => `${esc(r.level)}<small class="block muted">${esc(deptName(r.departmentId).replace('แผนกวิชา', ''))}</small>` },
    { label: 'ทุน', render: (r) => `${esc(r.scholarshipTitle)}<small class="block muted">${esc(catName(r.categoryId))} · ${esc(spName(r.sponsorId))}</small>` },
    { label: 'ปี', render: (r) => esc(r.year) },
    { label: 'จำนวนเงิน', cls: 'n', render: (r) => num(r.amount) },
  ],
  fields: () => [
    { name: 'studentId', label: 'รหัสนักศึกษา', required: true }, { name: 'name', label: 'ชื่อ-สกุล', required: true, span: 2 },
    { name: 'level', label: 'ระดับชั้น', type: 'select', options: LEVELS.map((l) => ({ value: l, label: l })) },
    { name: 'classYear', label: 'ชั้นปี', type: 'select', empty: '-', options: ['1', '2', '3'].map((y) => ({ value: y, label: y })) },
    { name: 'departmentId', label: 'แผนกวิชา', type: 'select', options: deptOptions(), required: true, empty: 'เลือกแผนก' },
    { name: 'scholarshipId', label: 'ทุน (เลือกจากรายการ เพื่อกรอกอัตโนมัติ)', type: 'select', empty: '— ทุนอื่น ๆ / ระบุเอง —', options: db().scholarships.map((s) => ({ value: s.id, label: `${s.title} (${s.year})` })), span: 3 },
    { name: 'scholarshipTitle', label: 'ชื่อทุน', required: true, span: 2 },
    { name: 'year', label: 'ปีการศึกษา', type: 'select', options: yearOptions(), required: true },
    { name: 'categoryId', label: 'ประเภททุน', type: 'select', options: catOptions(), empty: 'เลือกประเภททุน' },
    { name: 'sponsorId', label: 'แหล่งทุน', type: 'select', options: spOptions(), required: true, empty: 'เลือกแหล่งทุน' },
    { name: 'type', label: 'ภายใน/ภายนอก', type: 'select', options: Object.entries(TYPES).map(([k, l]) => ({ value: k, label: l })) },
    { name: 'amount', label: 'จำนวนเงิน (บาท)', type: 'number', min: 0, required: true },
  ],
  onFormMount: (form) => {
    form.elements.scholarshipId.onchange = (e) => {
      const s = db().scholarships.find((x) => x.id === e.target.value);
      if (!s) return;
      Object.assign(form.elements, {});
      form.elements.scholarshipTitle.value = s.title; form.elements.sponsorId.value = s.sponsorId; form.elements.categoryId.value = s.categoryId || '';
      form.elements.type.value = s.type; form.elements.amount.value = s.amount; form.elements.year.value = String(s.year);
    };
  },
});

// ======================= REPORTS =======================
export const reports = {
  title: 'บุคลากร · รายงาน', live: false, admin: 'reports',
  render() {
    const v = store.view();
    const card = (kind, ic, title, desc, extra = '') => `<article class="card report-card"><div class="kpi-ic">${icon(ic)}</div><h3>${title}</h3><p class="muted">${desc}</p>${extra}<button class="btn primary" data-kind="${kind}">${icon('printer')} ส่งออก PDF (A4)</button></article>`;
    return shell('reports', `<div class="filters">
      <label class="inline-label">ปีการศึกษา <select id="rYear">${opt('', 'ทุกปี', '')}${years(v).map((y) => opt(y, y, store.currentYear())).join('')}</select></label>
      <label class="inline-label">ประเภททุน <select id="rCat">${opt('', 'ทุกประเภท', '')}${db().categories.map((c) => opt(c.id, c.name, '')).join('')}</select></label>
      <label class="switch inline"><input type="checkbox" id="rSig"><span>แสดงลายมือชื่ออิเล็กทรอนิกส์ของผู้บริหาร</span></label></div>
    <div class="cards">
      ${card('summary', 'chart', 'รายงานสรุปผลการจัดสรรทุน', 'ภาพรวมงบประมาณ จัดอันดับแผนกวิชา ประเภททุน และแหล่งทุน')}
      ${card('category', 'tag', 'รายงานจำแนกตามประเภททุน', 'สรุปจำนวนทุนและยอดเงินแยกตามประเภททุนและแผนกวิชา')}
      ${card('external', 'building', 'รายงานทุนจากหน่วยงานภายนอก', 'ยอดเงินและจำนวนทุนแยกตามหน่วยงาน พร้อมรายชื่อผู้ได้รับทุน')}
      ${card('department', 'users', 'รายงานรายแผนกวิชา', 'สรุปผู้ได้รับทุนของแต่ละแผนก พร้อมช่องลงนามหัวหน้าแผนก', `<select id="rDept">${db().departments.filter((d) => store.user.role !== 'depthead' || d.id === store.user.departmentId).map((d) => opt(d.id, d.name, '')).join('')}</select>`)}
      ${card('recipients', 'list', 'บัญชีรายชื่อผู้ได้รับทุน', 'รายชื่อผู้ได้รับทุน (ชื่อเต็ม) สำหรับเอกสารภายใน')}
    </div>
    <article class="card"><h3>ส่งออกข้อมูล</h3><p class="muted">ดาวน์โหลดข้อมูลเพื่อใช้งานต่อใน Excel หรือสำรองข้อมูล</p>
      <div class="btn-row"><button class="btn ghost" id="csvRec">${icon('download')} ผู้รับทุน (CSV)</button>${store.isAdmin ? `<button class="btn ghost" id="backup">${icon('database')} สำรองฐานข้อมูล (JSON)</button>` : ''}</div></article>`);
  },
  mount(el) {
    const v = () => store.view();
    $$('[data-kind]', el).forEach((b) => (b.onclick = () => printReport(b.dataset.kind, v(), { year: $('#rYear', el).value, categoryId: $('#rCat', el).value, departmentId: $('#rDept', el).value, signatures: $('#rSig', el).checked })));
    $('#csvRec', el).onclick = () => downloadCSV('recipients.csv', ['รหัสนักศึกษา', 'ชื่อ-สกุล', 'ระดับ', 'ชั้นปี', 'แผนกวิชา', 'ทุน', 'ประเภททุน', 'แหล่งทุน', 'ภายใน/ภายนอก', 'ปีการศึกษา', 'จำนวนเงิน'],
      db().recipients.map((r) => [r.studentId, r.name, r.level, r.classYear, deptName(r.departmentId), r.scholarshipTitle, catName(r.categoryId || db().scholarships.find((s) => s.id === r.scholarshipId)?.categoryId), spName(r.sponsorId), TYPES[r.type], r.year, r.amount]));
    $('#backup', el)?.addEventListener('click', () => download(`scholarship-db_${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(store.db, null, 2), 'application/json'));
  },
};

// ======================= SETTINGS =======================
const SUBTABS = [['school', 'สถานศึกษา & โลโก้', 'building'], ['years', 'ปีการศึกษา & ผู้บริหาร', 'calendar'], ['users', 'ผู้ใช้งาน & บทบาท', 'users'], ['departments', 'แผนกวิชา', 'list'], ['categories', 'ประเภททุน', 'tag'], ['system', 'ระบบ', 'database']];
const instFields = [
  { name: 'schoolName', label: 'ชื่อสถานศึกษา', required: true, span: 2 }, { name: 'affiliation', label: 'สังกัด' },
  { name: 'systemTitle', label: 'ชื่อระบบ', required: true, span: 2 }, { name: 'contactPhone', label: 'โทรศัพท์ติดต่องานทุน' },
  { name: 'subtitle', label: 'คำอธิบายระบบ', span: 3 },
  { name: 'address', label: 'ที่อยู่สถานศึกษา', span: 3 },
  { name: 'logo', label: 'โลโก้สถานศึกษา', type: 'image', span: 3, hint: 'แนะนำ PNG พื้นหลังโปร่งใส ขนาดจัตุรัส' },
];
const settingsSub = { tab: 'school' };
const deptCrud = crud({
  tab: 'settings', title: 'แผนกวิชา', noun: 'แผนกวิชา', collection: 'departments', size: 'md',
  label: (r) => r.name, searchText: (r) => `${r.name} ${r.head}`,
  defaults: () => ({ name: 'แผนกวิชา' }),
  columns: [{ label: 'แผนกวิชา', render: (r) => `<b>${esc(r.name)}</b>` }, { label: 'หัวหน้าแผนกวิชา', render: (r) => { const o = store.view().officials?.[store.currentYear()]?.deptHeads?.[r.id]; return esc(o?.name || r.head || '-'); } },
    { label: 'ผู้รับทุน', cls: 'n', render: (r) => db().recipients.filter((x) => x.departmentId === r.id).length }],
  fields: () => [{ name: 'name', label: 'ชื่อแผนกวิชา', required: true, span: 3 }, { name: 'head', label: 'ชื่อหัวหน้าแผนก (กรณีไม่มีบัญชีผู้ใช้)', span: 3 }],
});
const catCrud = crud({
  tab: 'settings', title: 'ประเภททุน', noun: 'ประเภททุน', collection: 'categories', size: 'md',
  label: (r) => r.name, searchText: (r) => `${r.name} ${r.description || ''}`,
  columns: [{ label: 'ประเภททุน', render: (r) => `<b>${esc(r.name)}</b><small class="block muted">${esc(r.description || '')}</small>` }, { label: 'จำนวนทุน', cls: 'n', render: (r) => db().scholarships.filter((s) => s.categoryId === r.id).length }],
  fields: () => [{ name: 'name', label: 'ชื่อประเภททุน', required: true, span: 3 }, { name: 'description', label: 'คำอธิบาย', type: 'textarea', span: 3 }],
});
const yearCrud = crud({
  tab: 'settings', title: 'ปีการศึกษา', noun: 'ปีการศึกษา', collection: 'academicYears', size: 'md',
  label: (r) => r.year, searchText: (r) => `${r.year}`, sort: (a, b) => String(b.year).localeCompare(String(a.year)),
  defaults: () => ({ year: String(Number(store.currentYear() || 2569) + 1), status: 'archived' }),
  columns: [{ label: 'ปีการศึกษา', render: (r) => `<b>${esc(r.year)}</b>${r.note ? `<small class="block muted">${esc(r.note)}</small>` : ''}` },
    { label: 'สถานะ', render: (r) => (r.status === 'active' ? badge('ปีปัจจุบัน', 'good', 'check') : badge('จัดเก็บแล้ว', 'neutral')) },
    { label: 'ทุน / ผู้รับทุน / ใบสมัคร', render: (r) => `${db().scholarships.filter((s) => String(s.year) === String(r.year)).length} / ${db().recipients.filter((s) => String(s.year) === String(r.year)).length} / ${db().applications.filter((s) => String(s.year) === String(r.year)).length}` },
    { label: 'ช่วงเวลา', render: (r) => `${thDate(r.startDate)} – ${thDate(r.endDate)}` }],
  fields: () => [{ name: 'year', label: 'ปีการศึกษา (พ.ศ.)', required: true, pattern: '25[0-9]{2}', inputmode: 'numeric' }, { name: 'status', label: 'สถานะ', type: 'select', options: [{ value: 'active', label: 'ปีปัจจุบัน' }, { value: 'archived', label: 'จัดเก็บ (ปีที่ผ่านมา/ล่วงหน้า)' }] },
    { name: 'startDate', label: 'วันเริ่มปีการศึกษา', type: 'date' }, { name: 'endDate', label: 'วันสิ้นสุด', type: 'date' }, { name: 'note', label: 'หมายเหตุ', span: 2 }],
});

export const settings = {
  title: 'ตั้งค่าระบบ', live: true, admin: 'admin',
  render(v, params) {
    settingsSub.tab = params?.[0] || settingsSub.tab;
    const t = settingsSub.tab;
    const nav = `<nav class="subtabs">${SUBTABS.map(([k, l, ic]) => `<a href="#/admin/settings/${k}" class="${k === t ? 'active' : ''}">${icon(ic)} ${l}</a>`).join('')}</nav>`;
    let inner = '';
    if (t === 'school') inner = `<form id="instForm" class="card"><h3>ข้อมูลสถานศึกษา</h3>${formGrid(instFields, { ...db().institution, logo: db().institution.logo || '' })}<button class="btn primary">${icon('check')} บันทึก</button></form>`;
    else if (t === 'years') inner = `${yearCrud.body()}${officialsForm()}`;
    else if (t === 'users') inner = usersView();
    else if (t === 'departments') inner = deptCrud.body();
    else if (t === 'categories') inner = catCrud.body();
    else inner = systemView();
    return shell('settings', nav + inner);
  },
  mount(el) {
    const t = settingsSub.tab;
    if (t === 'school') {
      const f = $('#instForm', el);
      bindImageFields(f, (file) => store.uploadPublicImage(file, 'logo'));
      f.onsubmit = (e) => { e.preventDefault(); run('settings', { institution: readForm(f, instFields) }, 'ตั้งค่าสถานศึกษา'); };
    } else if (t === 'years') { yearCrud.mount(el); mountOfficials(el); }
    else if (t === 'users') mountUsers(el);
    else if (t === 'departments') deptCrud.mount(el);
    else if (t === 'categories') catCrud.mount(el);
    else mountSystem(el);
  },
};

// ----- ผู้บริหารรายปี -----
const offState = { year: '' };
function officialsForm() {
  const year = offState.year || store.currentYear();
  const cfg = db().officials[year] || {};
  const res = store.view().officials?.[year] || {};
  const users = db().users.filter((u) => u.active !== false);
  const sel = (name, role, cur, extra = (u) => true) => `<select name="${name}">${opt('', '— อัตโนมัติตามบทบาท —', cur)}${users.filter((u) => u.role === role && extra(u)).map((u) => opt(u.id, `${u.name}${u.position ? ` (${u.position})` : ''}`, cur)).join('')}</select>`;
  return `<form id="offForm" class="card"><header class="card-head"><div><h3>${icon('users')} ผู้บริหารและผู้ลงนาม ประจำปีการศึกษา</h3><p>ใช้แสดงบนหน้าเว็บ ช่องลงนามในใบสมัคร และรายงาน PDF — ข้อมูลแยกเก็บรายปี</p></div>
    <select id="offYear">${db().academicYears.map((y) => opt(y.year, `ปีการศึกษา ${y.year}`, year)).join('')}</select></header>
    <div class="form-grid">
      <div class="field"><label>ผู้อำนวยการ</label>${sel('director', 'director', cfg.director)}<small class="hint">ปัจจุบัน: ${esc(res.director?.name || '-')}</small></div>
      <div class="field span-2"><label>หัวหน้างานครูที่ปรึกษาและการแนะแนว</label>${sel('guidance', 'guidance', cfg.guidance)}<small class="hint">ปัจจุบัน: ${esc(res.guidance?.name || '-')}</small></div>
      ${DIVISIONS.map((d, i) => `<div class="field ${i % 2 ? 'span-2' : ''}"><label>รองผู้อำนวยการ${esc(d)}</label>${sel(`dep_${i}`, 'deputy', cfg.deputies?.[d])}</div>`).join('')}
    </div>
    <h4>หัวหน้าแผนกวิชา</h4>
    <div class="form-grid">${db().departments.map((d) => `<div class="field"><label>${esc(d.name)}</label>${sel(`dh_${d.id}`, 'depthead', cfg.deptHeads?.[d.id], (u) => !u.departmentId || u.departmentId === d.id)}<small class="hint">ปัจจุบัน: ${esc(res.deptHeads?.[d.id]?.name || '-')}</small></div>`).join('')}</div>
    <p class="muted small">ผู้ที่ปรากฏในรายการต้องมีบัญชีผู้ใช้ตามบทบาท (เพิ่มได้ที่แท็บ ผู้ใช้งาน & บทบาท) — หากเลือก "อัตโนมัติ" ระบบจะใช้ผู้ใช้ตามบทบาทที่ใช้งานอยู่</p>
    <button class="btn primary">${icon('check')} บันทึกผู้บริหารปี ${esc(year)}</button></form>`;
}
function mountOfficials(el) {
  const f = $('#offForm', el); if (!f) return;
  $('#offYear', el).onchange = (e) => { offState.year = e.target.value; rerender(); };
  f.onsubmit = (e) => {
    e.preventDefault();
    const year = offState.year || store.currentYear();
    const data = { director: f.elements.director.value, guidance: f.elements.guidance.value, deputies: {}, deptHeads: {} };
    DIVISIONS.forEach((d, i) => { if (f.elements[`dep_${i}`].value) data.deputies[d] = f.elements[`dep_${i}`].value; });
    db().departments.forEach((d) => { const x = f.elements[`dh_${d.id}`].value; if (x) data.deptHeads[d.id] = x; });
    run('officials', { year, data }, `ผู้บริหารปี ${year}`);
  };
}

// ----- ผู้ใช้งาน -----
const uf = { role: '', q: '' };
function usersView() {
  const list = db().users.filter((u) => (!uf.role || u.role === uf.role) && (!uf.q || `${u.name} ${u.username} ${u.position}`.toLowerCase().includes(uf.q.toLowerCase())))
    .sort((a, b) => Object.keys(ROLES).indexOf(a.role) - Object.keys(ROLES).indexOf(b.role) || a.name.localeCompare(b.name, 'th'));
  const counts = Object.fromEntries(Object.keys(ROLES).map((r) => [r, db().users.filter((u) => u.role === r).length]));
  return `${store.mode === 'github' && !store.relayUrl() ? `<div class="notice tone-warning">${icon('alert')}<div><b>บัญชีผู้ใช้จะเข้าสู่ระบบได้เมื่อติดตั้ง Relay แล้ว</b><p>สร้างบัญชีและกำหนดบทบาทไว้ล่วงหน้าได้ทันที — ดูขั้นตอนที่แท็บ "ระบบ"</p></div></div>` : ''}
  <div class="role-chips">${Object.entries(ROLES).map(([k, r]) => `<button class="role-chip ${uf.role === k ? 'active' : ''}" data-role="${k}">${esc(r.label)} <b>${counts[k]}</b></button>`).join('')}</div>
  <div class="filters"><label class="search">${icon('search')}<input id="uq" type="search" placeholder="ค้นหาชื่อ / ชื่อผู้ใช้" value="${esc(uf.q)}"></label>
    <button class="btn ghost" id="importStu">${icon('upload')} นำเข้ารายชื่อนักศึกษา</button><button class="btn primary" id="addUser">${icon('plus')} เพิ่มผู้ใช้งาน</button></div>
  <article class="card flush"><div class="table-wrap"><table class="table hover"><thead><tr><th>ชื่อ-สกุล</th><th>ชื่อผู้ใช้</th><th>บทบาท</th><th>ตำแหน่ง / หน้าที่</th><th>ลายเซ็น</th><th>สถานะ</th><th class="n">จัดการ</th></tr></thead><tbody>
  ${list.map((u) => `<tr><td><b>${esc(u.name)}</b>${u.departmentId ? `<small class="block muted">${esc(deptName(u.departmentId))}</small>` : ''}</td><td><code>${esc(u.username)}</code></td><td>${badge(ROLES[u.role]?.short, ROLES[u.role]?.tone)}${u.division ? `<small class="block muted">${esc(u.division)}</small>` : ''}</td>
    <td>${esc(u.position || '-')}${u.duties ? `<small class="block muted">${esc(u.duties.slice(0, 70))}${u.duties.length > 70 ? '…' : ''}</small>` : ''}</td><td>${u.signature ? `<img class="sig-thumb" src="${esc(u.signature)}" alt="ลายเซ็น">` : u.role === 'student' ? '' : '<span class="muted small">ยังไม่มี</span>'}</td>
    <td>${u.active === false ? badge('ระงับ', 'critical') : badge('ใช้งาน', 'good')}</td><td class="n nowrap"><button class="icon-btn" data-uedit="${esc(u.id)}" aria-label="แก้ไข">${icon('edit')}</button><button class="icon-btn danger" data-udel="${esc(u.id)}" aria-label="ลบ">${icon('trash')}</button></td></tr>`).join('') || `<tr><td colspan="7">${empty('ยังไม่มีผู้ใช้งาน', 'users')}</td></tr>`}
  </tbody></table></div><div class="table-foot">${list.length} บัญชี</div></article>`;
}
function mountUsers(el) {
  $$('[data-role]', el).forEach((b) => (b.onclick = () => { uf.role = uf.role === b.dataset.role ? '' : b.dataset.role; rerender(); }));
  $('#uq', el).onchange = (e) => { uf.q = e.target.value; rerender(); };
  $('#addUser', el).onclick = () => editUser(null);
  $('#importStu', el).onclick = importStudents;
  $$('[data-uedit]', el).forEach((b) => (b.onclick = () => editUser(db().users.find((u) => u.id === b.dataset.uedit))));
  $$('[data-udel]', el).forEach((b) => (b.onclick = async () => {
    const u = db().users.find((x) => x.id === b.dataset.udel);
    if (await confirmBox(`ลบบัญชี ${u.name} (${u.username})?`, { okText: 'ลบ', tone: 'danger' })) run('deleteUser', { id: u.id }, `ลบผู้ใช้ ${u.username}`, 'ลบบัญชีแล้ว');
  }));
}
function editUser(u) {
  const isNew = !u;
  const fields = [
    { name: 'role', label: 'บทบาท', type: 'select', options: Object.entries(ROLES).map(([k, r]) => ({ value: k, label: r.label })), required: true },
    { name: 'username', label: 'ชื่อผู้ใช้ (นักศึกษาใช้รหัสนักศึกษา)', required: true, pattern: '[a-zA-Z0-9._\\-]{3,40}' },
    { name: 'password', label: isNew ? 'รหัสผ่าน (อย่างน้อย 6 ตัว)' : 'ตั้งรหัสผ่านใหม่ (เว้นว่าง = ไม่เปลี่ยน)', type: 'password', required: isNew },
    { name: 'name', label: 'ชื่อ-สกุล (พร้อมคำนำหน้า)', required: true, span: 2 },
    { name: 'position', label: 'ตำแหน่ง', placeholder: 'เช่น ครูชำนาญการพิเศษ' },
    { name: 'division', label: 'ฝ่าย (รองผู้อำนวยการ)', type: 'select', empty: '—', options: DIVISIONS.map((d) => ({ value: d, label: d })) },
    { name: 'departmentId', label: 'แผนกวิชา (หัวหน้าแผนก/นักศึกษา)', type: 'select', empty: '—', options: deptOptions() },
    { name: 'level', label: 'ระดับชั้น (นักศึกษา)', type: 'select', empty: '—', options: LEVELS.map((l) => ({ value: l, label: l })) },
    { name: 'classYear', label: 'ชั้นปี (นักศึกษา)', type: 'select', empty: '—', options: ['1', '2', '3'].map((y) => ({ value: y, label: y })) },
    { name: 'phone', label: 'โทรศัพท์' }, { name: 'email', label: 'อีเมล', type: 'email' },
    { name: 'active', label: 'สถานะบัญชี', type: 'checkbox', text: 'เปิดใช้งาน' },
    { name: 'duties', label: 'หน้าที่ / บทบาทความรับผิดชอบ', type: 'textarea', rows: 3, span: 3 },
  ];
  modal({
    title: isNew ? 'เพิ่มผู้ใช้งาน' : `แก้ไขผู้ใช้งาน · ${u.name}`, size: 'lg',
    body: `<form id="uForm" novalidate>${formGrid(fields, { active: true, ...(u || { role: 'guidance' }) })}
      <div class="field"><label>ลายมือชื่ออิเล็กทรอนิกส์ (PNG พื้นหลังโปร่งใส)</label><div class="sig-upload">${u?.signature ? `<img class="sig-thumb lg" src="${esc(u.signature)}" alt="">` : '<span class="muted small">ยังไม่มี — ผู้ใช้วาดเองได้ที่ "บัญชีของฉัน"</span>'}<label class="btn ghost sm">${icon('upload')} อัปโหลดลายเซ็น<input type="file" id="sigUp" accept="image/png" hidden></label>${u?.signature ? `<button type="button" class="btn ghost sm" id="sigDel">${icon('trash')} ลบ</button>` : ''}</div></div></form>`,
    actions: `<button class="btn ghost" data-close>ยกเลิก</button><button class="btn primary" data-save>${icon('check')} บันทึก</button>`,
    onMount: (m, api) => {
      const f = $('#uForm', m);
      let signature;
      const toggle = () => { const r = f.elements.role.value; f.elements.division.closest('.field').hidden = r !== 'deputy'; f.elements.departmentId.closest('.field').hidden = !['depthead', 'student'].includes(r); f.elements.level.closest('.field').hidden = r !== 'student'; f.elements.classYear.closest('.field').hidden = r !== 'student'; };
      f.elements.role.onchange = toggle; toggle();
      $('#sigUp', m).onchange = (e) => { const file = e.target.files[0]; if (!file) return; if (file.size > 200000) return toast('ไฟล์ต้องไม่เกิน 200 KB', 'warning'); const r = new FileReader(); r.onload = () => { signature = r.result; toast('เลือกลายเซ็นแล้ว กดบันทึก'); }; r.readAsDataURL(file); };
      $('#sigDel', m)?.addEventListener('click', () => { signature = ''; toast('จะลบลายเซ็นเมื่อกดบันทึก'); });
      $('[data-save]', m).onclick = async () => {
        if (!f.checkValidity()) return f.reportValidity();
        const vals = readForm(f, fields);
        const pw = vals.password; delete vals.password;
        if (pw && pw.length < 6) return toast('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร', 'warning');
        const payload = { user: { ...vals, id: u?.id } };
        if (signature !== undefined) payload.signature = signature;
        if (pw) { if (store.mode === 'relay') payload.password = pw; else { payload.salt = newSalt(); payload.passwordHash = await hashPassword(pw, payload.salt); } }
        if (await run('saveUser', payload, `ผู้ใช้ ${vals.username}`)) api.close();
      };
    },
  });
}
function importStudents() {
  modal({
    title: 'นำเข้ารายชื่อนักเรียน นักศึกษา', size: 'lg',
    body: `<p class="muted">วางข้อมูลจาก Excel บรรทัดละ 1 คน คั่นด้วยจุลภาคหรือแท็บ: <code>รหัสนักศึกษา, ชื่อ-สกุล, ระดับ(ปวช./ปวส.), ชั้นปี, แผนกวิชา</code><br>รหัสผ่านเริ่มต้น = รหัสนักศึกษา (นักศึกษาเปลี่ยนได้ภายหลัง)</p>
      <textarea id="stuText" rows="10" placeholder="67201010001, นายสมชาย ใจดี, ปวช., 1, แผนกวิชาช่างยนต์"></textarea><div id="impProg" class="progress-line"></div>`,
    actions: `<button class="btn ghost" data-close>ยกเลิก</button><button class="btn primary" data-go>${icon('upload')} นำเข้า</button>`,
    onMount: (m, api) => ($('[data-go]', m).onclick = async (e) => {
      const rows = $('#stuText', m).value.split('\n').map((l) => l.split(/\t|,/).map((x) => x.trim())).filter((r) => r[0]).map(([username, name, level, classYear, dept]) => ({
        username, name, level: LEVELS.includes(level) ? level : (level || '').includes('ส') ? 'ปวส.' : 'ปวช.', classYear: (classYear || '1').replace(/\D/g, '') || '1',
        departmentId: db().departments.find((d) => dept && (d.name === dept || d.name.includes(dept.replace('แผนกวิชา', ''))))?.id || '',
      })).filter((r) => /^\d{5,15}$/.test(r.username));
      if (!rows.length) return toast('ไม่พบข้อมูลที่ถูกต้อง', 'warning');
      e.target.disabled = true;
      if (store.mode === 'github') {
        for (let i = 0; i < rows.length; i++) { $('#impProg', m).textContent = `กำลังเข้ารหัสรหัสผ่าน ${i + 1}/${rows.length}`; rows[i].salt = newSalt(); rows[i].passwordHash = await hashPassword(rows[i].username, rows[i].salt); }
      }
      $('#impProg', m).textContent = 'กำลังบันทึก...';
      const r = await run('importStudents', { rows }, `นำเข้านักศึกษา ${rows.length} คน`, 'นำเข้าเรียบร้อย');
      if (r) { toast(`เพิ่มใหม่ ${r.added} · ปรับปรุง ${r.updated}`); api.close(); } else e.target.disabled = false;
    }),
  });
}

// ----- ระบบ -----
function systemView() {
  const d = db();
  return `<div class="grid g-2"><form id="relayForm" class="card"><h3>${icon('send')} Relay — บัญชีผู้ใช้ & รับใบสมัครออนไลน์</h3>
      <p class="muted">Google Apps Script ที่ทำหน้าที่ตรวจสอบรหัสผ่าน บังคับสิทธิ์ตามบทบาท รับใบสมัคร/ไฟล์แนบ และบันทึกลงฐานข้อมูล GitHub (ไฟล์ <a href="https://github.com/${CONFIG.owner}/${CONFIG.siteRepo}/blob/main/relay/Code.gs" target="_blank" rel="noopener">relay/Code.gs</a> มีขั้นตอนติดตั้งอยู่ในหัวไฟล์)</p>
      <div class="field"><label for="relay">Relay URL</label><input id="relay" type="url" placeholder="https://script.google.com/macros/s/.../exec" value="${esc(d.settings?.relayUrl || '')}"></div>
      <div class="btn-row"><button class="btn primary">${icon('check')} บันทึก</button><button type="button" class="btn ghost" id="testRelay">${icon('refresh')} ทดสอบการเชื่อมต่อ</button></div></form>
    <article class="card"><h3>${icon('database')} ฐานข้อมูล GitHub</h3>
      <dl class="dl"><dt>ฐานข้อมูล (Private)</dt><dd><a href="https://github.com/${CONFIG.owner}/${CONFIG.dbRepo}" target="_blank" rel="noopener">${CONFIG.owner}/${CONFIG.dbRepo}</a></dd>
      <dt>ข้อมูลสาธารณะ</dt><dd><a href="https://github.com/${CONFIG.owner}/${CONFIG.siteRepo}/blob/${CONFIG.branch}/${CONFIG.publicPath}" target="_blank" rel="noopener">${CONFIG.siteRepo}/${CONFIG.publicPath}</a></dd>
      <dt>ปรับปรุงล่าสุด</dt><dd>${thDateTime(d.meta?.updatedAt)}</dd>
      <dt>จำนวนข้อมูล</dt><dd>ใบสมัคร ${d.applications.length} · ผู้รับทุน ${d.recipients.length} · ทุน ${d.scholarships.length} · ผู้ใช้ ${d.users.length}</dd></dl>
      <div class="btn-row"><button class="btn ghost" id="republish">${icon('refresh')} เผยแพร่ข้อมูลสาธารณะใหม่</button></div></article>
    ${d.meta?.sample ? `<article class="card"><h3>${icon('trash')} ข้อมูลตัวอย่าง</h3><p class="muted">ลบข้อมูลตัวอย่างทั้งหมด (ผู้รับทุน ใบสมัคร ทุน ประกาศ แหล่งทุน และบัญชีผู้ใช้ตัวอย่าง) โดยคงแผนกวิชา ประเภททุน และการตั้งค่าไว้</p><button class="btn danger" id="clearSample">${icon('trash')} ลบข้อมูลตัวอย่าง</button></article>` : ''}</div>`;
}
function mountSystem(el) {
  $('#relayForm', el).onsubmit = (e) => { e.preventDefault(); run('settings', { settings: { relayUrl: $('#relay', el).value.trim() } }, 'ตั้งค่า Relay URL'); };
  $('#testRelay', el).onclick = async () => {
    const url = $('#relay', el).value.trim();
    if (!url) return toast('กรุณากรอก Relay URL', 'warning');
    try { const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'ping' }) }); const j = await r.json(); j.ok ? toast(`เชื่อมต่อสำเร็จ: ${j.repo || 'OK'}`) : toast(j.error || 'เชื่อมต่อไม่สำเร็จ', 'critical'); }
    catch (err) { toast(`เชื่อมต่อไม่สำเร็จ: ${err.message}`, 'critical'); }
  };
  $('#republish', el).onclick = async () => {
    if (store.mode !== 'github') return run('settings', {}, 'republish', 'เผยแพร่ข้อมูลสาธารณะแล้ว');
    try { store.pub = null; await store.publish('republish'); toast('เผยแพร่ข้อมูลสาธารณะแล้ว'); } catch (e) { toast(e.message, 'critical'); }
  };
  $('#clearSample', el)?.addEventListener('click', async () => {
    if (await confirmBox('ลบข้อมูลตัวอย่างทั้งหมด? (กู้คืนได้จากประวัติ commit ของ GitHub)', { okText: 'ลบข้อมูลตัวอย่าง', tone: 'danger' })) run('clearSample', {}, 'ลบข้อมูลตัวอย่าง', 'ลบข้อมูลตัวอย่างแล้ว');
  });
}

// ---------- helpers ----------
function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
function downloadCSV(name, head, rows) {
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  download(name, `﻿${[head, ...rows].map((r) => r.map(cell).join(',')).join('\r\n')}`, 'text/csv;charset=utf-8');
}
