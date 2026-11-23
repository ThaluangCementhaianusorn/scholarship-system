// ส่งออกเอกสาร PDF ขนาด A4 (ใช้ระบบพิมพ์ของเบราว์เซอร์ → "บันทึกเป็น PDF" รองรับภาษาไทยสมบูรณ์)
import { esc, num, baht, thDate, qrDataUrl, applyUrl } from './ui.js';
import { STATUS, STAGES, TYPES, stats } from './model.js';

export const logoUrl = (view) => view?.institution?.logo || 'assets/img/logo.png';

function run(title, html) {
  let root = document.getElementById('print-root');
  if (!root) { root = document.createElement('div'); root.id = 'print-root'; document.body.append(root); }
  root.innerHTML = html;
  const prev = document.title;
  document.title = title;
  document.body.classList.add('printing');
  const done = () => { document.body.classList.remove('printing'); document.title = prev; root.innerHTML = ''; window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  const imgs = [...root.querySelectorAll('img')].map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; }))).filter(Boolean);
  Promise.all([document.fonts?.ready, ...imgs]).then(() => setTimeout(() => window.print(), 150));
}

const fmtLong = (iso) => thDate(iso, { day: 'numeric', month: 'long', year: 'numeric' });
function header(view, title, sub = '') {
  const i = view.institution || {};
  return `<div class="p-head"><img class="p-logo" src="${esc(logoUrl(view))}" alt="">
    <div><div class="p-school">${esc(i.schoolName)}</div><div class="p-aff">${esc(i.affiliation)}</div></div></div>
  <h1 class="p-title">${esc(title)}</h1>${sub ? `<p class="p-sub">${sub}</p>` : ''}`;
}
const footer = (view) => `<div class="p-foot">พิมพ์จาก ${esc(view.institution?.systemTitle || 'TL Scholarship')} · ${new Date().toLocaleString('th-TH', { dateStyle: 'long', timeStyle: 'short' })}</div>`;
const sigOf = (view, userId) => (view.users || []).find((u) => u.id === userId)?.signature || '';

// ช่องลงนาม: ถ้ามีลายเซ็นออนไลน์จะแสดงรูปลายเซ็น
function sign(role, name = '', opt = {}) {
  const img = opt.signature ? `<img class="p-sigimg" src="${esc(opt.signature)}" alt="ลายเซ็น">` : '';
  return `<div class="p-sign">${opt.decision ? `<div class="p-dec">${esc(opt.decision)}</div>` : ''}${opt.note ? `<div class="p-note">${esc(opt.note)}</div>` : ''}
    <div class="p-line">${img}</div><div>(${name ? esc(name) : '.....................................................'})</div><div class="p-role">${esc(role)}</div>
    <div class="p-date">${opt.at ? `ลงนามออนไลน์ ${fmtLong(opt.at)}` : 'วันที่ ........./........./.........'}</div></div>`;
}
const row = (k, v) => `<tr><th>${esc(k)}</th><td>${v === '' || v == null ? '-' : esc(v)}</td></tr>`;

export function printApplication(app, view) {
  const s = view.scholarships.find((x) => x.id === app.scholarshipId) || {};
  const sp = view.sponsors.find((x) => x.id === s.sponsorId) || {};
  const cat = (view.categories || []).find((c) => c.id === s.categoryId) || {};
  const st = app.student || {};
  const dept = view.departments.find((d) => d.id === st.departmentId) || {};
  const off = (view.officials || {})[String(s.year || app.year)] || {};
  const rv = app.review || {};
  const docs = (s.documents || []).map((d) => ({ d, has: (app.files || []).some((f) => f.label === d) }));
  const extra = (app.files || []).filter((f) => !docs.some((x) => x.d === f.label));
  const stage = (key, fallbackName, title) => {
    const r = rv[key]; const def = STAGES.find((x) => x.key === key);
    return sign(r?.position || title, r?.name || fallbackName, r ? { decision: def.decisions[r.decision], note: r.note, at: r.at, signature: r.signed ? sigOf(view, r.by) : '' } : {});
  };
  const html = `<section class="page">
    ${header(view, 'ใบสมัครขอรับทุนการศึกษา', `ปีการศึกษา ${esc(s.year || app.year || '')}`)}
    <div class="p-photo">ติดรูปถ่าย<br>1 นิ้ว</div>
    <div class="p-meta"><div>เลขที่ใบสมัคร <b>${esc(app.code || '-')}</b></div><div>วันที่ยื่น ${fmtLong(app.submittedAt)}</div><div>สถานะ ${esc(STATUS[app.status]?.label || '-')}</div></div>
    <h2>1. ทุนการศึกษาที่สมัคร</h2>
    <table class="p-kv">${row('ชื่อทุน', s.title)}${row('ประเภททุน', [cat.name, TYPES[s.type]].filter(Boolean).join(' · '))}${row('หน่วยงานผู้ให้ทุน', sp.name)}${row('จำนวนเงิน', s.amount ? baht(s.amount) : '')}</table>
    <h2>2. ข้อมูลผู้สมัคร</h2>
    <table class="p-kv two">
      <tr><th>ชื่อ-สกุล</th><td>${esc(`${st.prefix || ''}${st.firstName || ''} ${st.lastName || ''}`)}</td><th>รหัสนักศึกษา</th><td>${esc(st.studentId)}</td></tr>
      <tr><th>ระดับชั้น</th><td>${esc(st.level)} ปีที่ ${esc(st.classYear)}</td><th>แผนกวิชา</th><td>${esc(dept.name)}</td></tr>
      <tr><th>เกรดเฉลี่ยสะสม</th><td>${esc(st.gpa)}</td><th>วันเกิด</th><td>${st.birthDate ? fmtLong(st.birthDate) : '-'}</td></tr>
      <tr><th>โทรศัพท์</th><td>${esc(st.phone)}</td><th>อีเมล</th><td>${esc(st.email || '-')}</td></tr>
      <tr><th>ที่อยู่ปัจจุบัน</th><td colspan="3">${esc(st.address)}</td></tr>
    </table>
    <h2>3. ข้อมูลครอบครัว</h2>
    <table class="p-kv two">
      <tr><th>ผู้ปกครอง</th><td>${esc(st.parentName)}</td><th>ความเกี่ยวข้อง</th><td>${esc(st.parentRelation || '-')}</td></tr>
      <tr><th>อาชีพผู้ปกครอง</th><td>${esc(st.parentJob)}</td><th>รายได้ครอบครัว/ปี</th><td>${st.income !== '' && st.income != null ? baht(st.income) : '-'}</td></tr>
      <tr><th>จำนวนพี่น้อง</th><td>${esc(st.siblings ?? '-')} คน</td><th>โทรศัพท์ผู้ปกครอง</th><td>${esc(st.parentPhone || '-')}</td></tr>
    </table>
    <h2>4. เหตุผลความจำเป็นในการขอรับทุน</h2>
    <div class="p-box">${esc(app.reason).replace(/\n/g, '<br>')}</div>
    ${app.achievements ? `<h2>5. ผลงาน / กิจกรรม / ความสามารถพิเศษ</h2><div class="p-box">${esc(app.achievements).replace(/\n/g, '<br>')}</div>` : ''}
    <h2>${app.achievements ? 6 : 5}. เอกสารและหลักฐานประกอบการสมัคร</h2>
    <ul class="p-docs">${docs.map((x) => `<li><span class="p-cb">${x.has ? '✓' : ''}</span>${esc(x.d)}</li>`).join('')}${extra.map((f) => `<li><span class="p-cb">✓</span>${esc(f.label || f.name)}</li>`).join('')}</ul>
    ${rv.docCheck ? `<p class="p-small">ผลการตรวจเอกสาร: <b>${rv.docCheck.result === 'complete' ? 'ครบถ้วน' : 'ไม่ครบถ้วน'}</b> ${rv.docCheck.note ? `(${esc(rv.docCheck.note)})` : ''} — ตรวจโดย ${esc(rv.docCheck.name)} ${fmtLong(rv.docCheck.at)}</p>` : ''}
    <p class="p-cert">ข้าพเจ้าขอรับรองว่าข้อความข้างต้นเป็นความจริงทุกประการ หากตรวจสอบพบว่าเป็นเท็จ ข้าพเจ้ายินยอมให้ตัดสิทธิ์การรับทุนการศึกษา</p>
    <div class="p-signs">${sign('ผู้สมัคร', `${st.prefix || ''}${st.firstName || ''} ${st.lastName || ''}`)}${sign('ผู้ปกครอง', st.parentName)}</div>
    <div class="p-officer"><b>ผลการพิจารณา</b>
      <div class="p-signs three">${stage('depthead', off.deptHeads?.[st.departmentId]?.name, `หัวหน้า${dept.name || 'แผนกวิชา'}`)}${stage('guidance', off.guidance?.name, 'หัวหน้างานครูที่ปรึกษาและการแนะแนว')}${stage('director', off.director?.name, 'ผู้อำนวยการ')}</div>
      ${rv.deputy ? `<div class="p-signs one">${stage('deputy', '', 'รองผู้อำนวยการ')}</div>` : ''}
    </div>
    ${footer(view)}
  </section>`;
  run(`ใบสมัคร_${app.code || ''}`, html);
}

// ประกาศทุนพร้อม QR Code (โปสเตอร์ A4)
export function printScholarshipPoster(s, view) {
  const sp = view.sponsors.find((x) => x.id === s.sponsorId) || {};
  const cat = (view.categories || []).find((c) => c.id === s.categoryId) || {};
  const qr = qrDataUrl(applyUrl(s.id), 420);
  const depts = s.departments?.length ? s.departments.map((d) => view.departments.find((x) => x.id === d)?.name || '').join(', ') : 'ทุกแผนกวิชา';
  const html = `<section class="page poster-page">
    ${header(view, 'ประกาศรับสมัครทุนการศึกษา', `ปีการศึกษา ${esc(s.year)}`)}
    <h2 class="pp-title">${esc(s.title)}</h2>
    <p class="pp-sponsor">${esc(sp.name || '')}${cat.name ? ` · ${esc(cat.name)}` : ''}</p>
    ${s.poster ? `<img class="pp-poster" src="${esc(s.poster)}" alt="">` : ''}
    <div class="pp-grid">
      <div><table class="p-kv">${row('จำนวนเงิน', `${num(s.amount)} บาท/ทุน`)}${row('จำนวนทุน', `${num(s.quota)} ทุน`)}${row('ระดับชั้น', (s.levels || []).join(', '))}${row('แผนกวิชา', depts)}${s.minGpa ? row('เกรดเฉลี่ยขั้นต่ำ', Number(s.minGpa).toFixed(2)) : ''}${row('รับสมัคร', `${fmtLong(s.openDate)} – ${fmtLong(s.deadline)}`)}</table>
        ${(s.requirements || []).length ? `<h2>คุณสมบัติเพิ่มเติม</h2><ul class="pp-list">${s.requirements.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>` : ''}
        <h2>เอกสารประกอบการสมัคร</h2><ul class="pp-list">${(s.documents || []).map((r) => `<li>${esc(r)}</li>`).join('')}</ul></div>
      <div class="pp-qr"><img src="${qr}" alt="QR"><b>สแกนเพื่อสมัครออนไลน์</b><small>${esc(applyUrl(s.id))}</small></div>
    </div>
    ${footer(view)}
  </section>`;
  run(`ประกาศทุน_${s.title}`, html);
}

const deptName = (view, id) => view.departments.find((d) => d.id === id)?.name || '-';
const spName = (view, id) => view.sponsors.find((d) => d.id === id)?.name || '-';

function rankTable(rows, firstCol) {
  const total = rows.reduce((t, r) => t + r.amount, 0);
  return `<table class="p-table"><thead><tr><th class="n">ลำดับ</th><th>${firstCol}</th><th class="n">จำนวนทุน</th><th class="n">จำนวนเงิน (บาท)</th><th class="n">ร้อยละ</th></tr></thead><tbody>
    ${rows.map((r, i) => `<tr><td class="n">${i + 1}</td><td>${esc(r.name)}</td><td class="n">${num(r.count)}</td><td class="n">${num(r.amount)}</td><td class="n">${total ? ((r.amount / total) * 100).toFixed(1) : '0.0'}</td></tr>`).join('')}
    </tbody><tfoot><tr><td></td><td>รวม</td><td class="n">${num(rows.reduce((t, r) => t + r.count, 0))}</td><td class="n">${num(total)}</td><td class="n">100.0</td></tr></tfoot></table>`;
}
function recipientTable(view, rec) {
  return `<table class="p-table small"><thead><tr><th class="n">ที่</th><th>ชื่อ-สกุล</th><th>ระดับ</th><th>แผนกวิชา</th><th>ทุนการศึกษา</th><th>แหล่งทุน</th><th class="n">จำนวนเงิน</th></tr></thead><tbody>
  ${rec.map((r, i) => `<tr><td class="n">${i + 1}</td><td>${esc(r.name)}</td><td>${esc(r.level)}</td><td>${esc(deptName(view, r.departmentId).replace('แผนกวิชา', ''))}</td><td>${esc(r.scholarshipTitle)}</td><td>${esc(spName(view, r.sponsorId))}</td><td class="n">${num(r.amount)}</td></tr>`).join('')}
  </tbody></table>`;
}
const kpis = (s) => `<div class="p-kpis">
  <div><span>งบประมาณทุนรวม</span><b>${num(s.total)}</b><small>บาท</small></div>
  <div><span>จำนวนทุนที่มอบ</span><b>${num(s.count)}</b><small>ทุน (${num(s.students)} คน)</small></div>
  <div><span>ทุนจากหน่วยงานภายนอก</span><b>${num(s.extAmount)}</b><small>บาท · ${num(s.extCount)} ทุน</small></div>
  <div><span>ทุนภายในสถานศึกษา</span><b>${num(s.intAmount)}</b><small>บาท</small></div></div>`;

// kind: summary | external | department | category | recipients
export function printReport(kind, view, { year = '', departmentId = '', categoryId = '', rec: customRec, signatures = false } = {}) {
  const s = stats(view, year, { categoryId });
  const off = (view.officials || {})[String(year || view.institution?.academicYear)] || {};
  const sg = (o, role) => sign(o?.position || role, o?.name, signatures && o?.userId ? { signature: sigOf(view, o.userId) } : {});
  const signOff = `<div class="p-signs">${sg(off.guidance, 'หัวหน้างานครูที่ปรึกษาและการแนะแนว')}${sg(off.director, 'ผู้อำนวยการ')}</div>`;
  const yl = `${year ? `ปีการศึกษา ${esc(year)}` : 'ทุกปีการศึกษา'}${categoryId ? ` · ${esc((view.categories || []).find((c) => c.id === categoryId)?.name || '')}` : ''}`;
  let title; let body;
  if (kind === 'external') {
    title = 'รายงานสรุปทุนการศึกษาจากหน่วยงานภายนอก';
    body = `${kpis(s)}<h2>สรุปยอดเงินทุนแยกตามหน่วยงานผู้สนับสนุน</h2>${rankTable(s.bySponsorExt, 'หน่วยงานผู้สนับสนุน')}<h2>รายชื่อผู้ได้รับทุนจากหน่วยงานภายนอก</h2>${recipientTable(view, s.rec.filter((r) => r.type === 'external'))}${signOff}`;
  } else if (kind === 'department') {
    const d = view.departments.find((x) => x.id === departmentId);
    title = `รายงานสรุปการจัดสรรทุนการศึกษา ${d?.name || ''}`;
    const ds = stats(view, year, { categoryId, departmentId });
    body = `${kpis(ds)}<h2>สรุปตามประเภททุน</h2>${rankTable(ds.byCategory, 'ประเภททุน')}<h2>สรุปตามแหล่งทุน</h2>${rankTable(ds.bySponsor, 'แหล่งทุน')}<h2>รายชื่อผู้ได้รับทุน</h2>${recipientTable(view, ds.rec)}
      <div class="p-signs">${sg(off.deptHeads?.[departmentId], `หัวหน้า${d?.name || 'แผนกวิชา'}`)}${sg(off.guidance, 'หัวหน้างานครูที่ปรึกษาและการแนะแนว')}</div>`;
  } else if (kind === 'category') {
    title = 'รายงานสรุปทุนการศึกษาจำแนกตามประเภททุน';
    body = `${kpis(s)}<h2>สรุปตามประเภททุน</h2>${rankTable(s.byCategory, 'ประเภททุน')}<h2>สรุปตามแผนกวิชา</h2>${rankTable(s.byDept, 'แผนกวิชา')}${signOff}`;
  } else if (kind === 'recipients') {
    title = 'รายชื่อผู้ได้รับทุนการศึกษา';
    body = recipientTable(view, customRec || s.rec);
  } else {
    title = 'รายงานสรุปผลการจัดสรรทุนการศึกษา';
    body = `${kpis(s)}<h2>จัดอันดับตามแผนกวิชา</h2>${rankTable(s.byDept, 'แผนกวิชา')}<h2>สรุปตามประเภททุน</h2>${rankTable(s.byCategory, 'ประเภททุน')}<h2>จัดอันดับตามแหล่งทุน</h2>${rankTable(s.bySponsor, 'แหล่งทุน')}
      <h2>สรุปตามระดับชั้น</h2><table class="p-table"><thead><tr><th>ระดับชั้น</th><th class="n">จำนวนทุน</th><th class="n">จำนวนเงิน (บาท)</th></tr></thead><tbody>${s.byLevel.map((l) => `<tr><td>${l.level}</td><td class="n">${num(l.count)}</td><td class="n">${num(l.amount)}</td></tr>`).join('')}</tbody></table>${signOff}`;
  }
  run(`${title}_${year || 'ทั้งหมด'}`, `<section class="page">${header(view, title, yl)}${body}${footer(view)}</section>`);
}
