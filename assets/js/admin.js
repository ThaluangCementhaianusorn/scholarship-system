// ส่วนผู้ดูแลระบบ (Admin): ใบสมัคร, ทุน, ผู้รับทุน, แหล่งทุน, ประกาศ, รายงาน, ตั้งค่า
import { $, $$, esc, num, baht, thDate, thDateTime, fileSize, icon, badge, toast, modal, confirmBox, formGrid, readForm, empty } from './ui.js';
import { LEVELS, TYPES, STATUS, SCHOLARSHIP_STATUS, SPONSOR_CATEGORIES, DEFAULT_DOCS, newId, eligibility, countsByScholarship, years } from './model.js';
import { printApplication, printReport } from './print.js';
import { store } from './store.js';
import { CONFIG } from './config.js';

const TABS = [
  ['', 'ภาพรวม', 'dashboard'], ['applications', 'ใบสมัคร', 'file'], ['scholarships', 'ทุนการศึกษา', 'award'],
  ['recipients', 'ผู้รับทุน', 'users'], ['sponsors', 'แหล่งทุน', 'building'], ['announcements', 'ประกาศ', 'megaphone'],
  ['reports', 'รายงาน PDF', 'printer'], ['settings', 'ตั้งค่า', 'settings'],
];
const opt = (value, label, cur) => `<option value="${esc(value)}" ${String(cur) === String(value) ? 'selected' : ''}>${esc(label)}</option>`;
const deptName = (id) => store.db.departments.find((d) => d.id === id)?.name || '-';
const spName = (id) => store.db.sponsors.find((d) => d.id === id)?.name || '-';
const schTitle = (id) => store.db.scholarships.find((d) => d.id === id)?.title || '-';
const fullName = (st = {}) => `${st.prefix || ''}${st.firstName || ''} ${st.lastName || ''}`.trim();
const rerender = () => window.dispatchEvent(new Event('rerender'));
async function save(fn, msg, ok = 'บันทึกเรียบร้อย') {
  try { const r = await store.mutate(fn, msg); toast(ok); return r ?? true; } catch (e) { toast(e.message, 'critical'); return false; }
}

function shell(tab, inner) {
  const sample = store.db.meta?.sample;
  return `<header class="page-head"><div><span class="eyebrow">${icon('shield')} ผู้ดูแลระบบ</span><h1>${esc(TABS.find((t) => t[0] === tab)?.[1] || '')}</h1></div>
    <div class="head-actions"><a class="btn ghost" href="#/scholarships">${icon('filePlus')} บันทึกใบสมัครแทนนักศึกษา</a></div></header>
  <nav class="tabs" aria-label="เมนูผู้ดูแล">${TABS.map(([k, l, ic]) => `<a href="#/admin${k ? `/${k}` : ''}" class="${k === tab ? 'active' : ''}">${icon(ic)}<span>${l}</span></a>`).join('')}</nav>
  ${sample ? `<div class="notice tone-info">${icon('database')}<div><b>ระบบกำลังแสดงข้อมูลตัวอย่าง</b><p>ลบข้อมูลตัวอย่างได้ที่ ตั้งค่า → ข้อมูลตัวอย่าง ก่อนเริ่มใช้งานจริง</p></div></div>` : ''}
  ${inner}`;
}

// ======================= LOGIN =======================
export const login = {
  title: 'เข้าสู่ระบบผู้ดูแล', live: false,
  render() {
    return `<div class="login-wrap"><form id="loginForm" class="card login">
      <div class="login-ic">${icon('shield')}</div>
      <h1>เข้าสู่ระบบผู้ดูแล</h1>
      <p class="muted">ยืนยันตัวตนด้วย GitHub Access Token ที่มีสิทธิ์เขียน repo ฐานข้อมูล <code>${esc(CONFIG.owner)}/${esc(CONFIG.dbRepo)}</code></p>
      <div class="field"><label for="tok">GitHub Personal Access Token</label><input id="tok" type="password" autocomplete="off" required placeholder="github_pat_..."></div>
      <button class="btn primary block lg" id="loginBtn">${icon('key')} เข้าสู่ระบบ</button>
      <details class="howto"><summary>วิธีสร้าง Token (ครั้งแรก)</summary><ol>
        <li>เข้า GitHub ด้วยบัญชีผู้ดูแล → <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">Settings → Fine-grained tokens → Generate new token</a></li>
        <li>Resource owner: <b>${esc(CONFIG.owner)}</b> · Repository access: <b>Only select repositories</b> → เลือก <b>${esc(CONFIG.dbRepo)}</b> และ <b>${esc(CONFIG.siteRepo)}</b></li>
        <li>Permissions → Repository permissions → <b>Contents: Read and write</b></li>
        <li>กด Generate แล้วคัดลอก token มาวางที่ช่องด้านบน (token จะถูกเก็บไว้เฉพาะในเบราว์เซอร์เครื่องนี้)</li>
      </ol></details>
    </form></div>`;
  },
  mount(el) {
    $('#loginForm', el).onsubmit = async (e) => {
      e.preventDefault();
      const b = $('#loginBtn', el); b.disabled = true; b.innerHTML = `${icon('refresh', 'spin')} กำลังตรวจสอบ...`;
      try { await store.login($('#tok', el).value); toast('เข้าสู่ระบบสำเร็จ'); location.hash = '#/admin'; }
      catch (err) { toast(err.message, 'critical'); b.disabled = false; b.innerHTML = `${icon('key')} เข้าสู่ระบบ`; }
    };
  },
};

// ======================= OVERVIEW =======================
export const overview = {
  title: 'ผู้ดูแล · ภาพรวม', live: true, admin: true,
  render() {
    const apps = store.db.applications;
    const c = (st) => apps.filter((a) => a.status === st).length;
    const counts = countsByScholarship(apps);
    const open = store.db.scholarships.filter((s) => s.status === 'open');
    const recent = [...apps].sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || '')).slice(0, 6);
    return shell('', `
    <section class="kpis">
      ${mini('file', 'ใบสมัครทั้งหมด', apps.length)}${mini('clock', 'รอพิจารณา', c('submitted') + c('reviewing') + c('interview'))}
      ${mini('check', 'อนุมัติแล้ว', c('approved'))}${mini('list', 'สำรอง', c('waitlist'))}${mini('x', 'ไม่ผ่าน', c('rejected'))}
    </section>
    <section class="grid g-3-2">
      <article class="card"><header class="card-head"><div><h3>การใช้โควตาทุนที่เปิดรับ</h3><p>อนุมัติแล้ว / โควตาทั้งหมด</p></div></header>
        ${open.length ? `<div class="quota-list">${open.map((s) => { const a = counts[s.id]?.approved || 0; const pct = Math.min(100, (a / (s.quota || 1)) * 100); return `<div class="meter"><div class="meter-top"><span>${esc(s.title)}</span><span>${a}/${num(s.quota)} · ผู้สมัคร ${counts[s.id]?.applicants || 0}</span></div><div class="meter-bar ${a > s.quota ? 'over' : ''}"><i style="width:${pct}%"></i></div></div>`; }).join('')}</div>` : empty('ไม่มีทุนที่เปิดรับ', 'award')}
      </article>
      <article class="card"><header class="card-head"><div><h3>ใบสมัครล่าสุด</h3></div><a class="link" href="#/admin/applications">ทั้งหมด ${icon('arrowRight')}</a></header>
        <div class="feed">${recent.map((a) => `<button class="feed-item as-btn" data-app="${esc(a.id)}"><div class="avatar sm">${esc((a.student?.firstName || '?')[0])}</div><div><div class="feed-title">${esc(fullName(a.student))}</div><p>${esc(schTitle(a.scholarshipId))} · ${thDateTime(a.submittedAt)}</p></div>${badge(STATUS[a.status]?.label, STATUS[a.status]?.tone)}</button>`).join('') || empty('ยังไม่มีใบสมัคร', 'file')}</div>
      </article>
    </section>`);
  },
  mount(el) { $$('[data-app]', el).forEach((b) => (b.onclick = () => appDetail(b.dataset.app))); },
};
const mini = (ic, label, n) => `<article class="kpi"><div class="kpi-ic">${icon(ic)}</div><div class="kpi-body"><span class="kpi-label">${label}</span><div class="kpi-value">${num(n)}</div></div></article>`;

// ======================= APPLICATIONS =======================
const af = { q: '', sch: '', status: '', dept: '' };
export const applications = {
  title: 'ผู้ดูแล · ใบสมัคร', live: true, admin: true,
  render() {
    const db = store.db;
    return shell('applications', `<div class="filters">
      <label class="search">${icon('search')}<input id="q" type="search" placeholder="ค้นหาชื่อ รหัสนักศึกษา หรือเลขที่ใบสมัคร" value="${esc(af.q)}"></label>
      <select id="fSch">${opt('', 'ทุกทุนการศึกษา', af.sch)}${db.scholarships.map((s) => opt(s.id, `${s.title} (${s.year})`, af.sch)).join('')}</select>
      <select id="fStatus">${opt('', 'ทุกสถานะ', af.status)}${Object.entries(STATUS).map(([k, s]) => opt(k, s.label, af.status)).join('')}</select>
      <select id="fDept">${opt('', 'ทุกแผนกวิชา', af.dept)}${db.departments.map((d) => opt(d.id, d.name, af.dept)).join('')}</select>
      <button class="btn ghost" id="csv">${icon('download')} CSV</button>
    </div><article class="card flush"><div id="appTable"></div></article>`);
  },
  mount(el) {
    const filtered = () => {
      const q = af.q.toLowerCase();
      return store.db.applications.filter((a) => (!q || `${fullName(a.student)} ${a.student?.studentId} ${a.code}`.toLowerCase().includes(q)) && (!af.sch || a.scholarshipId === af.sch) && (!af.status || a.status === af.status) && (!af.dept || a.student?.departmentId === af.dept))
        .sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''));
    };
    const draw = () => {
      const list = filtered();
      $('#appTable', el).innerHTML = list.length ? `<div class="table-wrap"><table class="table hover"><thead><tr><th>เลขที่</th><th>ผู้สมัคร</th><th>แผนก/ระดับ</th><th class="n">GPA</th><th>ทุน</th><th>ยื่นเมื่อ</th><th>เอกสาร</th><th>สถานะ</th></tr></thead><tbody>
        ${list.map((a) => `<tr data-app="${esc(a.id)}" tabindex="0"><td><code>${esc(a.code)}</code></td><td><b>${esc(fullName(a.student))}</b><small class="block muted">${esc(a.student?.studentId)}</small></td><td>${esc(deptName(a.student?.departmentId).replace('แผนกวิชา', ''))}<small class="block muted">${esc(a.student?.level)} ปี ${esc(a.student?.classYear)}</small></td><td class="n">${esc(a.student?.gpa)}</td><td>${esc(schTitle(a.scholarshipId))}</td><td>${thDate(a.submittedAt)}</td><td>${icon('paperclip')} ${(a.files || []).length}</td><td>${badge(STATUS[a.status]?.label || a.status, STATUS[a.status]?.tone, STATUS[a.status]?.icon)}</td></tr>`).join('')}
      </tbody></table></div>` : empty('ไม่พบใบสมัคร', 'file');
      $$('[data-app]', el).forEach((r) => { r.onclick = () => appDetail(r.dataset.app); r.onkeydown = (e) => e.key === 'Enter' && appDetail(r.dataset.app); });
    };
    $('#q', el).oninput = (e) => { af.q = e.target.value; draw(); };
    [['#fSch', 'sch'], ['#fStatus', 'status'], ['#fDept', 'dept']].forEach(([id, k]) => ($(id, el).onchange = (e) => { af[k] = e.target.value; draw(); }));
    $('#csv', el).onclick = () => downloadCSV(`applications_${new Date().toISOString().slice(0, 10)}.csv`,
      ['เลขที่', 'รหัสนักศึกษา', 'ชื่อ-สกุล', 'ระดับ', 'ชั้นปี', 'แผนกวิชา', 'GPA', 'โทรศัพท์', 'รายได้ครอบครัว/ปี', 'ทุน', 'สถานะ', 'วันที่ยื่น'],
      filtered().map((a) => [a.code, a.student?.studentId, fullName(a.student), a.student?.level, a.student?.classYear, deptName(a.student?.departmentId), a.student?.gpa, a.student?.phone, a.student?.income, schTitle(a.scholarshipId), STATUS[a.status]?.label, a.submittedAt?.slice(0, 10)]));
    draw();
  },
};

function appDetail(id) {
  const a = store.db.applications.find((x) => x.id === id);
  if (!a) return;
  const s = store.db.scholarships.find((x) => x.id === a.scholarshipId) || {};
  const st = a.student || {};
  const el = eligibility({ ...s, status: 'open', openDate: '', deadline: '' }, st).checks.slice(0, -1);
  const approvedCount = store.db.applications.filter((x) => x.scholarshipId === a.scholarshipId && x.status === 'approved').length;
  modal({
    title: `ใบสมัคร ${a.code}`, size: 'xl',
    body: `<div class="app-detail">
      <div class="app-main">
        <div class="app-person"><div class="avatar lg">${esc((st.firstName || '?')[0])}</div><div><h3>${esc(fullName(st))}</h3><p class="muted">รหัส ${esc(st.studentId)} · ${esc(st.level)} ปีที่ ${esc(st.classYear)} · ${esc(deptName(st.departmentId))}</p></div>${badge(STATUS[a.status]?.label, STATUS[a.status]?.tone, STATUS[a.status]?.icon)}</div>
        <dl class="dl">
          <dt>ทุนที่สมัคร</dt><dd>${esc(s.title)} (${baht(s.amount)})</dd>
          <dt>GPA</dt><dd>${esc(st.gpa)}</dd><dt>โทรศัพท์</dt><dd>${esc(st.phone)}</dd><dt>อีเมล</dt><dd>${esc(st.email || '-')}</dd>
          <dt>ที่อยู่</dt><dd>${esc(st.address)}</dd>
          <dt>ผู้ปกครอง</dt><dd>${esc(st.parentName)} (${esc(st.parentRelation || '-')}) · ${esc(st.parentJob)} · ${esc(st.parentPhone || '')}</dd>
          <dt>รายได้ครอบครัว</dt><dd>${st.income !== '' && st.income != null ? baht(st.income) + '/ปี' : '-'} · พี่น้อง ${esc(st.siblings ?? '-')} คน</dd>
        </dl>
        <h4>เหตุผลความจำเป็น</h4><p class="prose">${esc(a.reason).replace(/\n/g, '<br>')}</p>
        ${a.achievements ? `<h4>ผลงาน / กิจกรรม</h4><p class="prose">${esc(a.achievements).replace(/\n/g, '<br>')}</p>` : ''}
        <h4>เอกสารแนบ (${(a.files || []).length})</h4>
        <ul class="file-list big">${(a.files || []).map((f, i) => `<li>${icon('paperclip')}<span><b>${esc(f.label || 'เอกสาร')}</b><small class="block muted">${esc(f.name)} · ${f.size ? fileSize(f.size) : ''}</small></span>${f.path ? `<button class="btn ghost sm" data-file="${i}">${icon('eye')} เปิดดู</button>` : '<small class="muted">ไม่มีไฟล์</small>'}</li>`).join('') || '<li class="muted">ไม่มีเอกสารแนบ</li>'}</ul>
      </div>
      <aside class="app-side">
        <h4>ตรวจสอบคุณสมบัติ</h4>
        <ul class="elig">${el.map((c) => `<li class="${c.ok === true ? 'ok' : c.ok === false ? 'bad' : 'wait'}">${icon(c.ok ? 'check' : c.ok === false ? 'x' : 'clock')}<span>${esc(c.label)}</span></li>`).join('')}</ul>
        <div class="side-row"><span>โควตาที่อนุมัติแล้ว</span><b>${approvedCount}/${num(s.quota)}</b></div>
        <div class="divider"></div>
        <form id="decision"><h4>บันทึกผลการพิจารณา</h4>
          <div class="field"><label for="dStatus">สถานะ</label><select id="dStatus">${Object.entries(STATUS).map(([k, x]) => opt(k, x.label, a.status)).join('')}</select></div>
          <div class="field"><label for="dNote">หมายเหตุ (แสดงให้นักศึกษาเห็น)</label><textarea id="dNote" rows="2" placeholder="เช่น นัดสัมภาษณ์วันที่..."></textarea></div>
          <button class="btn primary block">${icon('check')} บันทึกผล</button>
        </form>
        <h4>ประวัติ</h4>
        <ol class="timeline compact">${(a.history || []).slice().reverse().map((h) => `<li class="tone-${STATUS[h.status]?.tone || 'neutral'}"><b>${esc(STATUS[h.status]?.label || h.status)}</b><span>${thDateTime(h.at)} · ${esc(h.by || '')}</span>${h.note ? `<p>${esc(h.note)}</p>` : ''}</li>`).join('')}</ol>
      </aside></div>`,
    actions: `<button class="btn danger-ghost" data-del>${icon('trash')} ลบใบสมัคร</button><span class="spacer"></span><button class="btn ghost" data-print>${icon('printer')} ใบสมัคร PDF (A4)</button>`,
    onMount: (m, api) => {
      $$('[data-file]', m).forEach((b) => (b.onclick = async () => { const f = a.files[b.dataset.file]; b.disabled = true; try { await store.openFile(f.path, f.type); } catch (e) { toast(e.message, 'critical'); } b.disabled = false; }));
      $('[data-print]', m).onclick = () => printApplication(a, store.view());
      $('[data-del]', m).onclick = async () => {
        if (!(await confirmBox(`ลบใบสมัคร ${a.code} ของ ${fullName(st)}? (ข้อมูลผู้รับทุนที่เชื่อมกันจะถูกลบด้วย)`, { okText: 'ลบ', tone: 'danger' }))) return;
        if (await save((db) => { db.applications = db.applications.filter((x) => x.id !== a.id); db.recipients = db.recipients.filter((r) => r.appId !== a.id); }, `ลบใบสมัคร ${a.code}`, 'ลบใบสมัครแล้ว')) api.close();
      };
      $('#decision', m).onsubmit = async (e) => {
        e.preventDefault();
        const status = $('#dStatus', m).value; const note = $('#dNote', m).value.trim();
        if (status === 'approved' && a.status !== 'approved' && approvedCount >= Number(s.quota || 0) &&
          !(await confirmBox(`ทุนนี้อนุมัติครบโควตา ${s.quota} ทุนแล้ว ต้องการอนุมัติเกินโควตาหรือไม่?`, { okText: 'อนุมัติเกินโควตา' }))) return;
        const ok = await save((db) => {
          const x = db.applications.find((y) => y.id === a.id);
          x.status = status;
          (x.history ||= []).push({ at: new Date().toISOString(), status, by: 'เจ้าหน้าที่', note });
          db.recipients = db.recipients.filter((r) => r.appId !== a.id);
          if (status === 'approved') {
            const sc = db.scholarships.find((y) => y.id === x.scholarshipId) || {};
            db.recipients.push({ id: `rec_${x.id}`, appId: x.id, studentId: x.student.studentId, name: fullName(x.student), level: x.student.level, classYear: x.student.classYear, departmentId: x.student.departmentId, scholarshipId: sc.id, scholarshipTitle: sc.title, sponsorId: sc.sponsorId, type: sc.type, amount: Number(sc.amount) || 0, year: String(sc.year || x.year) });
          }
        }, `${a.code} → ${STATUS[status].label}`, `บันทึกผล: ${STATUS[status].label}`);
        if (ok) api.close();
      };
    },
  });
}

// ======================= GENERIC CRUD =======================
function crud(cfg) {
  const state = { q: '' };
  return {
    title: `ผู้ดูแล · ${cfg.title}`, live: true, admin: true,
    render() {
      return shell(cfg.tab, `<div class="filters">
        <label class="search">${icon('search')}<input id="q" type="search" placeholder="ค้นหา" value="${esc(state.q)}"></label>
        ${cfg.extraFilter ? cfg.extraFilter(state) : ''}
        <button class="btn primary" id="add">${icon('plus')} เพิ่ม${cfg.noun}</button>
      </div><article class="card flush"><div id="tbl"></div></article>`);
    },
    mount(el) {
      const draw = () => {
        const q = state.q.toLowerCase();
        const rows = (store.db[cfg.collection] || []).filter((r) => (!q || cfg.searchText(r).toLowerCase().includes(q)) && (!cfg.filterFn || cfg.filterFn(r, state))).sort(cfg.sort || (() => 0));
        $('#tbl', el).innerHTML = rows.length ? `<div class="table-wrap"><table class="table hover"><thead><tr>${cfg.columns.map((c) => `<th class="${c.cls || ''}">${c.label}</th>`).join('')}<th class="n">จัดการ</th></tr></thead><tbody>
          ${rows.map((r) => `<tr>${cfg.columns.map((c) => `<td class="${c.cls || ''}">${c.render(r)}</td>`).join('')}<td class="n nowrap"><button class="icon-btn" data-edit="${esc(r.id)}" aria-label="แก้ไข">${icon('edit')}</button><button class="icon-btn danger" data-del="${esc(r.id)}" aria-label="ลบ">${icon('trash')}</button></td></tr>`).join('')}
          </tbody></table></div><div class="table-foot">${rows.length} รายการ</div>` : empty('ไม่พบข้อมูล');
        $$('[data-edit]', el).forEach((b) => (b.onclick = () => edit(store.db[cfg.collection].find((r) => r.id === b.dataset.edit))));
        $$('[data-del]', el).forEach((b) => (b.onclick = async () => {
          const item = store.db[cfg.collection].find((r) => r.id === b.dataset.del);
          if (cfg.canDelete) { const why = cfg.canDelete(item); if (why) { toast(why, 'warning'); return; } }
          if (!(await confirmBox(`ลบ "${cfg.label(item)}" ใช่หรือไม่?`, { okText: 'ลบ', tone: 'danger' }))) return;
          save((db) => { db[cfg.collection] = db[cfg.collection].filter((r) => r.id !== item.id); }, `ลบ${cfg.noun} ${cfg.label(item)}`, 'ลบแล้ว');
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
            cfg.onFormMount?.(form);
            const submit = async () => {
              if (!form.checkValidity()) { form.reportValidity(); return; }
              const vals = readForm(form, fields);
              const b = $('[data-save]', m); b.disabled = true;
              const ok = await save((db) => {
                if (isNew) db[cfg.collection].push({ id: newId(cfg.idPrefix), ...vals });
                else Object.assign(db[cfg.collection].find((r) => r.id === item.id), vals);
                cfg.afterSave?.(db);
              }, `${isNew ? 'เพิ่ม' : 'แก้ไข'}${cfg.noun} ${cfg.label(vals)}`);
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

const deptOptions = () => store.db.departments.map((d) => ({ value: d.id, label: d.name.replace('แผนกวิชา', '') }));
const spOptions = () => store.db.sponsors.map((s) => ({ value: s.id, label: s.name }));
const yearOptions = () => { const y = Number(store.db.institution?.academicYear) || new Date().getFullYear() + 543; return [y + 1, y, y - 1, y - 2, y - 3].map((x) => ({ value: String(x), label: String(x) })); };

export const adminScholarships = crud({
  tab: 'scholarships', title: 'ทุนการศึกษา', noun: 'ทุนการศึกษา', collection: 'scholarships', idPrefix: 'sch',
  label: (r) => r.title, searchText: (r) => `${r.title} ${spName(r.sponsorId)}`,
  extraFilter: (s) => `<select data-f="year">${opt('', 'ทุกปี', s.year)}${years(store.view()).map((y) => opt(y, `ปี ${y}`, s.year)).join('')}</select>`,
  filterFn: (r, s) => !s.year || String(r.year) === s.year,
  sort: (a, b) => String(b.year).localeCompare(String(a.year)) || (a.deadline || '').localeCompare(b.deadline || ''),
  defaults: () => ({ year: String(store.db.institution?.academicYear || ''), type: 'external', status: 'open', levels: [...LEVELS], documents: [...DEFAULT_DOCS], quota: 1 }),
  canDelete: (r) => (store.db.applications.some((a) => a.scholarshipId === r.id) ? 'มีใบสมัครของทุนนี้อยู่ — เปลี่ยนสถานะเป็น "ปิดรับสมัคร" แทนการลบ' : ''),
  columns: [
    { label: 'ทุนการศึกษา', render: (r) => `<b>${esc(r.title)}</b><small class="block muted">${esc(spName(r.sponsorId))}</small>` },
    { label: 'ปี', render: (r) => esc(r.year) },
    { label: 'ประเภท', render: (r) => badge(TYPES[r.type], r.type === 'external' ? 'info' : 'neutral') },
    { label: 'จำนวนเงิน', cls: 'n', render: (r) => num(r.amount) },
    { label: 'โควตา', cls: 'n', render: (r) => { const c = countsByScholarship(store.db.applications)[r.id] || {}; return `${c.approved || 0}/${num(r.quota)}<small class="block muted">สมัคร ${c.applicants || 0}</small>`; } },
    { label: 'คุณสมบัติ', render: (r) => `${esc((r.levels || []).join('/'))}${r.minGpa ? ` · GPA ≥ ${Number(r.minGpa).toFixed(2)}` : ''}<small class="block muted">${r.departments?.length ? `${r.departments.length} แผนก` : 'ทุกแผนก'}</small>` },
    { label: 'ปิดรับ', render: (r) => thDate(r.deadline) },
    { label: 'สถานะ', render: (r) => badge(SCHOLARSHIP_STATUS[r.status]?.label, SCHOLARSHIP_STATUS[r.status]?.tone) },
  ],
  fields: () => [
    { name: 'title', label: 'ชื่อทุนการศึกษา', required: true, span: 3 },
    { name: 'sponsorId', label: 'หน่วยงานผู้ให้ทุน', type: 'select', options: spOptions(), required: true, empty: 'เลือกหน่วยงาน', span: 2 },
    { name: 'type', label: 'ประเภททุน', type: 'select', options: Object.entries(TYPES).map(([k, l]) => ({ value: k, label: l })) },
    { name: 'year', label: 'ปีการศึกษา', type: 'select', options: yearOptions(), required: true },
    { name: 'amount', label: 'จำนวนเงิน (บาท/ทุน)', type: 'number', min: 0, required: true },
    { name: 'quota', label: 'จำนวนทุน (โควตา)', type: 'number', min: 1, required: true },
    { name: 'minGpa', label: 'เกรดเฉลี่ยขั้นต่ำ', type: 'number', step: '0.01', min: 0, max: 4 },
    { name: 'maxIncome', label: 'รายได้ครอบครัวสูงสุด (บาท/ปี)', type: 'number', min: 0, hint: 'เว้นว่าง = ไม่จำกัด' },
    { name: 'status', label: 'สถานะ', type: 'select', options: Object.entries(SCHOLARSHIP_STATUS).map(([k, s]) => ({ value: k, label: s.label })) },
    { name: 'openDate', label: 'วันเปิดรับสมัคร', type: 'date' },
    { name: 'deadline', label: 'วันปิดรับสมัคร', type: 'date', required: true },
    { name: 'levels', label: 'ระดับชั้นที่สมัครได้', type: 'chips', options: LEVELS.map((l) => ({ value: l, label: l })), span: 3 },
    { name: 'departments', label: 'แผนกวิชาที่สมัครได้ (ไม่เลือก = ทุกแผนก)', type: 'chips', options: deptOptions(), span: 3 },
    { name: 'description', label: 'รายละเอียดทุน', type: 'textarea', rows: 3, span: 3 },
    { name: 'requirements', label: 'คุณสมบัติเพิ่มเติม (บรรทัดละ 1 ข้อ)', type: 'lines', span: 3 },
    { name: 'documents', label: 'เอกสารที่ต้องแนบ (บรรทัดละ 1 รายการ — นักศึกษาต้องแนบทุกรายการ)', type: 'lines', span: 3 },
  ],
  afterSave: (db) => db.scholarships.forEach((s) => { if (s.type !== 'internal' && s.type !== 'external') s.type = 'external'; }),
});

export const adminSponsors = crud({
  tab: 'sponsors', title: 'แหล่งทุน', noun: 'แหล่งทุน', collection: 'sponsors', idPrefix: 'sp',
  label: (r) => r.name, searchText: (r) => `${r.name} ${r.category} ${r.contact}`,
  sort: (a, b) => a.name.localeCompare(b.name, 'th'),
  defaults: () => ({ type: 'external', category: SPONSOR_CATEGORIES[0] }),
  canDelete: (r) => (store.db.scholarships.some((s) => s.sponsorId === r.id) || store.db.recipients.some((s) => s.sponsorId === r.id) ? 'หน่วยงานนี้มีทุนหรือผู้รับทุนเชื่อมอยู่ จึงลบไม่ได้' : ''),
  columns: [
    { label: 'หน่วยงาน', render: (r) => `<b>${esc(r.name)}</b><small class="block muted">${esc(r.category || '')}</small>` },
    { label: 'ประเภท', render: (r) => badge(TYPES[r.type], r.type === 'external' ? 'info' : 'neutral') },
    { label: 'ผู้ประสานงาน', render: (r) => `${esc(r.contact || '-')}<small class="block muted">${esc(r.phone || '')} ${esc(r.email || '')}</small>` },
    { label: 'ยอดทุนสะสม', cls: 'n', render: (r) => num(store.db.recipients.filter((x) => x.sponsorId === r.id).reduce((t, x) => t + (Number(x.amount) || 0), 0)) },
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
  tab: 'announcements', title: 'ประกาศ', noun: 'ประกาศ', collection: 'announcements', idPrefix: 'ann',
  label: (r) => r.title, searchText: (r) => `${r.title} ${r.body}`,
  sort: (a, b) => (b.date || '').localeCompare(a.date || ''),
  defaults: () => ({ date: new Date().toISOString().slice(0, 10) }),
  columns: [
    { label: 'หัวข้อ', render: (r) => `${r.pinned ? icon('pin', 'pin') : ''}<b>${esc(r.title)}</b><small class="block muted">${esc((r.body || '').slice(0, 80))}</small>` },
    { label: 'วันที่', render: (r) => thDate(r.date) },
    { label: 'แท็ก', render: (r) => (r.tag ? badge(r.tag, 'info') : '-') },
    { label: 'สถานะ', render: (r) => (r.draft ? badge('ฉบับร่าง', 'warning') : badge('เผยแพร่', 'good')) },
  ],
  fields: () => [
    { name: 'title', label: 'หัวข้อประกาศ', required: true, span: 3 },
    { name: 'date', label: 'วันที่ประกาศ', type: 'date', required: true },
    { name: 'tag', label: 'แท็ก', placeholder: 'เช่น เปิดรับสมัคร, ประกาศผล' },
    { name: 'scholarshipId', label: 'เชื่อมกับทุน', type: 'select', empty: '— ไม่ระบุ —', options: store.db.scholarships.map((s) => ({ value: s.id, label: `${s.title} (${s.year})` })) },
    { name: 'sponsorId', label: 'หน่วยงาน', type: 'select', empty: '— ไม่ระบุ —', options: spOptions(), span: 2 },
    { name: 'link', label: 'ลิงก์ภายนอก', type: 'url', placeholder: 'https://' },
    { name: 'body', label: 'เนื้อหาประกาศ', type: 'textarea', rows: 6, required: true, span: 3 },
    { name: 'pinned', label: 'ปักหมุด', type: 'checkbox', text: 'แสดงไว้บนสุด' },
    { name: 'draft', label: 'ฉบับร่าง', type: 'checkbox', text: 'ยังไม่เผยแพร่' },
  ],
});

export const adminRecipients = crud({
  tab: 'recipients', title: 'ผู้รับทุน', noun: 'ผู้รับทุน', collection: 'recipients', idPrefix: 'rec', size: 'lg',
  label: (r) => r.name, searchText: (r) => `${r.name} ${r.studentId} ${r.scholarshipTitle}`,
  extraFilter: (s) => `<select data-f="year">${opt('', 'ทุกปี', s.year)}${years(store.view()).map((y) => opt(y, `ปี ${y}`, s.year)).join('')}</select>`,
  filterFn: (r, s) => !s.year || String(r.year) === s.year,
  sort: (a, b) => String(b.year).localeCompare(String(a.year)) || a.name.localeCompare(b.name, 'th'),
  defaults: () => ({ year: String(store.db.institution?.academicYear || ''), type: 'external', level: 'ปวช.' }),
  columns: [
    { label: 'ชื่อ-สกุล', render: (r) => `<b>${esc(r.name)}</b><small class="block muted">${esc(r.studentId)}${r.appId ? ' · จากใบสมัคร' : ''}</small>` },
    { label: 'ระดับ/แผนก', render: (r) => `${esc(r.level)}<small class="block muted">${esc(deptName(r.departmentId).replace('แผนกวิชา', ''))}</small>` },
    { label: 'ทุน', render: (r) => `${esc(r.scholarshipTitle)}<small class="block muted">${esc(spName(r.sponsorId))}</small>` },
    { label: 'ปี', render: (r) => esc(r.year) },
    { label: 'จำนวนเงิน', cls: 'n', render: (r) => num(r.amount) },
  ],
  fields: () => [
    { name: 'studentId', label: 'รหัสนักศึกษา', required: true }, { name: 'name', label: 'ชื่อ-สกุล', required: true, span: 2 },
    { name: 'level', label: 'ระดับชั้น', type: 'select', options: LEVELS.map((l) => ({ value: l, label: l })) },
    { name: 'classYear', label: 'ชั้นปี', type: 'select', empty: '-', options: ['1', '2', '3'].map((y) => ({ value: y, label: y })) },
    { name: 'departmentId', label: 'แผนกวิชา', type: 'select', options: deptOptions(), required: true, empty: 'เลือกแผนก' },
    { name: 'scholarshipId', label: 'ทุน (เลือกจากรายการ เพื่อกรอกอัตโนมัติ)', type: 'select', empty: '— ทุนอื่น ๆ / ระบุเอง —', options: store.db.scholarships.map((s) => ({ value: s.id, label: `${s.title} (${s.year})` })), span: 3 },
    { name: 'scholarshipTitle', label: 'ชื่อทุน', required: true, span: 2 },
    { name: 'year', label: 'ปีการศึกษา', type: 'select', options: yearOptions(), required: true },
    { name: 'sponsorId', label: 'แหล่งทุน', type: 'select', options: spOptions(), required: true, empty: 'เลือกแหล่งทุน', span: 2 },
    { name: 'type', label: 'ประเภท', type: 'select', options: Object.entries(TYPES).map(([k, l]) => ({ value: k, label: l })) },
    { name: 'amount', label: 'จำนวนเงิน (บาท)', type: 'number', min: 0, required: true },
  ],
  onFormMount: (form) => {
    form.elements.scholarshipId.onchange = (e) => {
      const s = store.db.scholarships.find((x) => x.id === e.target.value);
      if (!s) return;
      form.elements.scholarshipTitle.value = s.title; form.elements.sponsorId.value = s.sponsorId;
      form.elements.type.value = s.type; form.elements.amount.value = s.amount; form.elements.year.value = String(s.year);
    };
  },
});

// ======================= REPORTS =======================
export const reports = {
  title: 'ผู้ดูแล · รายงาน', live: false, admin: true,
  render() {
    const v = store.view();
    const ys = years(v);
    const card = (kind, ic, title, desc, extra = '') => `<article class="card report-card"><div class="kpi-ic">${icon(ic)}</div><h3>${title}</h3><p class="muted">${desc}</p>${extra}<button class="btn primary" data-kind="${kind}">${icon('printer')} ส่งออก PDF (A4)</button></article>`;
    return shell('reports', `<div class="filters"><label class="inline-label">ปีการศึกษา <select id="rYear">${opt('', 'ทุกปี', '')}${ys.map((y) => opt(y, y, v.institution?.academicYear)).join('')}</select></label></div>
    <div class="cards">
      ${card('summary', 'chart', 'รายงานสรุปผลการจัดสรรทุน', 'ภาพรวมงบประมาณ จัดอันดับแผนกวิชาและแหล่งทุน สรุปตามระดับชั้น')}
      ${card('external', 'building', 'รายงานทุนจากหน่วยงานภายนอก', 'สรุปยอดเงินและจำนวนทุนแยกตามหน่วยงาน พร้อมรายชื่อผู้ได้รับทุน')}
      ${card('department', 'users', 'รายงานรายแผนกวิชา', 'สรุปผู้ได้รับทุนของแต่ละแผนก พร้อมช่องลงนามหัวหน้าแผนก', `<select id="rDept">${store.db.departments.map((d) => opt(d.id, d.name, '')).join('')}</select>`)}
      ${card('recipients', 'list', 'บัญชีรายชื่อผู้ได้รับทุน', 'รายชื่อผู้ได้รับทุนทั้งหมด (ชื่อเต็ม) สำหรับเอกสารภายใน')}
    </div>
    <article class="card"><h3>ส่งออกข้อมูล</h3><p class="muted">ดาวน์โหลดข้อมูลเพื่อใช้งานต่อใน Excel หรือสำรองข้อมูล</p>
      <div class="btn-row"><button class="btn ghost" id="csvRec">${icon('download')} ผู้รับทุน (CSV)</button><button class="btn ghost" id="backup">${icon('database')} สำรองฐานข้อมูล (JSON)</button></div></article>`);
  },
  mount(el) {
    $$('[data-kind]', el).forEach((b) => (b.onclick = () => printReport(b.dataset.kind, store.view(), { year: $('#rYear', el).value, departmentId: $('#rDept', el).value })));
    $('#csvRec', el).onclick = () => downloadCSV('recipients.csv', ['รหัสนักศึกษา', 'ชื่อ-สกุล', 'ระดับ', 'ชั้นปี', 'แผนกวิชา', 'ทุน', 'แหล่งทุน', 'ประเภท', 'ปีการศึกษา', 'จำนวนเงิน'],
      store.db.recipients.map((r) => [r.studentId, r.name, r.level, r.classYear, deptName(r.departmentId), r.scholarshipTitle, spName(r.sponsorId), TYPES[r.type], r.year, r.amount]));
    $('#backup', el).onclick = () => download(`scholarship-db_${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(store.db, null, 2), 'application/json');
  },
};

// ======================= SETTINGS =======================
const instFields = [
  { name: 'schoolName', label: 'ชื่อสถานศึกษา', required: true, span: 2 }, { name: 'academicYear', label: 'ปีการศึกษาปัจจุบัน', required: true, inputmode: 'numeric' },
  { name: 'systemTitle', label: 'ชื่อระบบ', required: true, span: 2 }, { name: 'affiliation', label: 'สังกัด' },
  { name: 'subtitle', label: 'คำอธิบายระบบ', span: 3 },
  { name: 'director', label: 'ชื่อผู้อำนวยการ (ใช้ในช่องลงนาม)' }, { name: 'guidanceHead', label: 'หัวหน้างานแนะแนวอาชีพฯ' }, { name: 'contactPhone', label: 'โทรศัพท์ติดต่องานทุน' },
];
export const settings = {
  title: 'ผู้ดูแล · ตั้งค่า', live: false, admin: true,
  render() {
    const db = store.db;
    return shell('settings', `<div class="grid g-2">
      <form id="instForm" class="card"><h3>ข้อมูลสถานศึกษา</h3>${formGrid(instFields, db.institution)}<button class="btn primary">${icon('check')} บันทึก</button></form>
      <div class="stack">
        <form id="relayForm" class="card"><h3>${icon('send')} ระบบรับใบสมัครออนไลน์ (Relay)</h3>
          <p class="muted">URL ของ Google Apps Script Web App ที่ทำหน้าที่รับใบสมัครจากนักศึกษาและบันทึกลง GitHub (ดูวิธีติดตั้งในไฟล์ <code>relay/Code.gs</code>)</p>
          <div class="field"><label for="relay">Relay URL</label><input id="relay" type="url" placeholder="https://script.google.com/macros/s/.../exec" value="${esc(db.settings?.relayUrl || '')}"></div>
          <div class="btn-row"><button class="btn primary">${icon('check')} บันทึก</button><button type="button" class="btn ghost" id="testRelay">${icon('refresh')} ทดสอบการเชื่อมต่อ</button></div></form>
        <article class="card"><h3>${icon('database')} ฐานข้อมูล GitHub</h3>
          <dl class="dl"><dt>ฐานข้อมูล (Private)</dt><dd><a href="https://github.com/${CONFIG.owner}/${CONFIG.dbRepo}" target="_blank" rel="noopener">${CONFIG.owner}/${CONFIG.dbRepo}</a> · ${CONFIG.dbPath}</dd>
          <dt>ข้อมูลสาธารณะ</dt><dd><a href="https://github.com/${CONFIG.owner}/${CONFIG.siteRepo}/blob/${CONFIG.branch}/${CONFIG.publicPath}" target="_blank" rel="noopener">${CONFIG.siteRepo}/${CONFIG.publicPath}</a></dd>
          <dt>ปรับปรุงล่าสุด</dt><dd>${thDateTime(db.meta?.updatedAt)}</dd>
          <dt>จำนวนข้อมูล</dt><dd>ใบสมัคร ${db.applications.length} · ผู้รับทุน ${db.recipients.length} · ทุน ${db.scholarships.length} · แหล่งทุน ${db.sponsors.length}</dd></dl>
          <div class="btn-row"><button class="btn ghost" id="republish">${icon('refresh')} เผยแพร่ข้อมูลสาธารณะใหม่</button><button class="btn ghost" id="logout">${icon('logout')} ออกจากระบบ</button></div></article>
        ${db.meta?.sample ? `<article class="card"><h3>${icon('trash')} ข้อมูลตัวอย่าง</h3><p class="muted">ลบข้อมูลตัวอย่างทั้งหมด (ผู้รับทุน ใบสมัคร ทุน ประกาศ และแหล่งทุนที่สร้างไว้เพื่อสาธิต) โดยคงแผนกวิชาและการตั้งค่าไว้</p><button class="btn danger" id="clearSample">${icon('trash')} ลบข้อมูลตัวอย่าง</button></article>` : ''}
      </div></div>
      <article class="card"><header class="card-head"><div><h3>แผนกวิชา</h3><p>${db.departments.length} แผนก</p></div><button class="btn primary sm" id="addDept">${icon('plus')} เพิ่มแผนก</button></header>
        <div class="table-wrap"><table class="table"><thead><tr><th>แผนกวิชา</th><th>หัวหน้าแผนก</th><th class="n">ผู้รับทุน</th><th class="n">จัดการ</th></tr></thead><tbody>
        ${db.departments.map((d) => `<tr><td><b>${esc(d.name)}</b></td><td>${esc(d.head || '-')}</td><td class="n">${db.recipients.filter((r) => r.departmentId === d.id).length}</td><td class="n nowrap"><button class="icon-btn" data-dept="${esc(d.id)}" aria-label="แก้ไข">${icon('edit')}</button><button class="icon-btn danger" data-ddel="${esc(d.id)}" aria-label="ลบ">${icon('trash')}</button></td></tr>`).join('')}
        </tbody></table></div></article>`);
  },
  mount(el) {
    $('#instForm', el).onsubmit = (e) => { e.preventDefault(); const vals = readForm(e.target, instFields); save((db) => { db.institution = { ...db.institution, ...vals }; }, 'ตั้งค่าสถานศึกษา').then(rerender); };
    $('#relayForm', el).onsubmit = (e) => { e.preventDefault(); const url = $('#relay', el).value.trim(); save((db) => { db.settings = { ...(db.settings || {}), relayUrl: url }; }, 'ตั้งค่า Relay URL'); };
    $('#testRelay', el).onclick = async () => {
      const url = $('#relay', el).value.trim();
      if (!url) return toast('กรุณากรอก Relay URL', 'warning');
      try { const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'ping' }) }); const j = await r.json(); j.ok ? toast(`เชื่อมต่อสำเร็จ: ${j.repo || 'OK'}`) : toast(j.error || 'เชื่อมต่อไม่สำเร็จ', 'critical'); }
      catch (err) { toast(`เชื่อมต่อไม่สำเร็จ: ${err.message}`, 'critical'); }
    };
    $('#republish', el).onclick = async () => { try { store.pub = null; await store.publish('republish'); toast('เผยแพร่ข้อมูลสาธารณะแล้ว'); } catch (e) { toast(e.message, 'critical'); } };
    $('#logout', el).onclick = () => { store.logout(); location.hash = '#/'; toast('ออกจากระบบแล้ว'); };
    $('#clearSample', el)?.addEventListener('click', async () => {
      if (!(await confirmBox('ลบข้อมูลตัวอย่างทั้งหมด? การลบนี้ย้อนกลับได้จากประวัติ commit ของ GitHub เท่านั้น', { okText: 'ลบข้อมูลตัวอย่าง', tone: 'danger' }))) return;
      save((db) => { for (const k of ['applications', 'recipients', 'scholarships', 'announcements', 'sponsors']) db[k] = (db[k] || []).filter((x) => !x.sample); db.meta.sample = false; }, 'ลบข้อมูลตัวอย่าง', 'ลบข้อมูลตัวอย่างแล้ว').then(rerender);
    });
    const deptFields = [{ name: 'name', label: 'ชื่อแผนกวิชา', required: true, span: 3 }, { name: 'head', label: 'หัวหน้าแผนกวิชา', span: 3 }];
    const editDept = (d) => modal({
      title: d ? 'แก้ไขแผนกวิชา' : 'เพิ่มแผนกวิชา', size: 'sm', body: `<form id="dForm">${formGrid(deptFields, d || { name: 'แผนกวิชา' })}</form>`,
      actions: `<button class="btn ghost" data-close>ยกเลิก</button><button class="btn primary" data-save>บันทึก</button>`,
      onMount: (m, api) => ($('[data-save]', m).onclick = async () => {
        const f = $('#dForm', m); if (!f.checkValidity()) return f.reportValidity();
        const vals = readForm(f, deptFields);
        if (await save((db) => { if (d) Object.assign(db.departments.find((x) => x.id === d.id), vals); else db.departments.push({ id: newId('d'), ...vals }); }, `แผนกวิชา ${vals.name}`)) { api.close(); rerender(); }
      }),
    });
    $('#addDept', el).onclick = () => editDept(null);
    $$('[data-dept]', el).forEach((b) => (b.onclick = () => editDept(store.db.departments.find((d) => d.id === b.dataset.dept))));
    $$('[data-ddel]', el).forEach((b) => (b.onclick = async () => {
      const d = store.db.departments.find((x) => x.id === b.dataset.ddel);
      if (store.db.recipients.some((r) => r.departmentId === d.id) || store.db.applications.some((a) => a.student?.departmentId === d.id)) return toast('แผนกนี้มีข้อมูลผู้รับทุนหรือใบสมัครเชื่อมอยู่ จึงลบไม่ได้', 'warning');
      if (await confirmBox(`ลบ ${d.name}?`, { okText: 'ลบ', tone: 'danger' }) && await save((db) => { db.departments = db.departments.filter((x) => x.id !== d.id); }, `ลบ ${d.name}`)) rerender();
    }));
  },
};

// ---------- helpers ----------
function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
function downloadCSV(name, head, rows) {
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  download(name, '﻿' + [head, ...rows].map((r) => r.map(cell).join(',')).join('\r\n'), 'text/csv;charset=utf-8');
}
