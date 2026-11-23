// ส่งออกเอกสาร PDF ขนาด A4 (ใช้ระบบพิมพ์ของเบราว์เซอร์ → "บันทึกเป็น PDF" รองรับภาษาไทยสมบูรณ์)
import { esc, num, baht, thDate } from './ui.js';
import { STATUS, TYPES, stats } from './model.js';

function run(title, html) {
  let root = document.getElementById('print-root');
  if (!root) { root = document.createElement('div'); root.id = 'print-root'; document.body.append(root); }
  root.innerHTML = html;
  const prev = document.title;
  document.title = title;
  document.body.classList.add('printing');
  const done = () => { document.body.classList.remove('printing'); document.title = prev; root.innerHTML = ''; window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  // รอฟอนต์โหลดก่อนพิมพ์
  (document.fonts?.ready || Promise.resolve()).then(() => setTimeout(() => window.print(), 120));
}

function header(view, title, sub = '') {
  const i = view.institution || {};
  return `<div class="p-head">
    <div class="p-logo">TL</div>
    <div><div class="p-school">${esc(i.schoolName)}</div><div class="p-aff">${esc(i.affiliation)}</div></div>
  </div>
  <h1 class="p-title">${esc(title)}</h1>${sub ? `<p class="p-sub">${sub}</p>` : ''}`;
}
const footer = (view) => `<div class="p-foot">พิมพ์จาก ${esc(view.institution?.systemTitle || 'TL Scholarship')} · ${thDate(new Date().toISOString(), { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>`;
const sign = (role, name = '') => `<div class="p-sign"><div class="p-line"></div><div>(${name ? esc(name) : '.....................................................'})</div><div class="p-role">${esc(role)}</div><div class="p-date">วันที่ ........./........./.........</div></div>`;
const row = (k, v) => `<tr><th>${esc(k)}</th><td>${v === '' || v == null ? '-' : esc(v)}</td></tr>`;

export function printApplication(app, view) {
  const s = view.scholarships.find((x) => x.id === app.scholarshipId) || {};
  const sp = view.sponsors.find((x) => x.id === s.sponsorId) || {};
  const st = app.student || {};
  const dept = view.departments.find((d) => d.id === st.departmentId) || {};
  const docs = (s.documents?.length ? s.documents : []).map((d) => ({ d, has: (app.files || []).some((f) => f.label === d) }));
  const extra = (app.files || []).filter((f) => !docs.some((x) => x.d === f.label));
  const i = view.institution || {};
  const html = `<section class="page">
    ${header(view, 'ใบสมัครขอรับทุนการศึกษา', `ปีการศึกษา ${esc(s.year || app.year || '')}`)}
    <div class="p-photo">ติดรูปถ่าย<br>1 นิ้ว</div>
    <div class="p-meta"><div>เลขที่ใบสมัคร <b>${esc(app.code || '-')}</b></div><div>วันที่ยื่น ${thDate(app.submittedAt, { day: 'numeric', month: 'long', year: 'numeric' })}</div><div>สถานะ ${esc(STATUS[app.status]?.label || '-')}</div></div>
    <h2>1. ทุนการศึกษาที่สมัคร</h2>
    <table class="p-kv">${row('ชื่อทุน', s.title)}${row('หน่วยงานผู้ให้ทุน', sp.name)}${row('ประเภททุน', TYPES[s.type])}${row('จำนวนเงิน', s.amount ? baht(s.amount) : '')}</table>
    <h2>2. ข้อมูลผู้สมัคร</h2>
    <table class="p-kv two">
      <tr><th>ชื่อ-สกุล</th><td>${esc(`${st.prefix || ''}${st.firstName || ''} ${st.lastName || ''}`)}</td><th>รหัสนักศึกษา</th><td>${esc(st.studentId)}</td></tr>
      <tr><th>ระดับชั้น</th><td>${esc(st.level)} ปีที่ ${esc(st.classYear)}</td><th>แผนกวิชา</th><td>${esc(dept.name)}</td></tr>
      <tr><th>เกรดเฉลี่ยสะสม</th><td>${esc(st.gpa)}</td><th>วันเกิด</th><td>${st.birthDate ? thDate(st.birthDate, { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}</td></tr>
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
    <h2>${app.achievements ? 6 : 5}. เอกสารประกอบการสมัคร</h2>
    <ul class="p-docs">${docs.map((x) => `<li><span class="p-cb">${x.has ? '✓' : ''}</span>${esc(x.d)}</li>`).join('')}${extra.map((f) => `<li><span class="p-cb">✓</span>${esc(f.label || f.name)}</li>`).join('')}</ul>
    <p class="p-cert">ข้าพเจ้าขอรับรองว่าข้อความข้างต้นเป็นความจริงทุกประการ หากตรวจสอบพบว่าเป็นเท็จ ข้าพเจ้ายินยอมให้ตัดสิทธิ์การรับทุนการศึกษา</p>
    <div class="p-signs">${sign('ผู้สมัคร', `${st.prefix || ''}${st.firstName || ''} ${st.lastName || ''}`)}${sign('ผู้ปกครอง', st.parentName)}</div>
    <div class="p-officer"><b>สำหรับเจ้าหน้าที่</b>
      <div class="p-signs three">${sign('ครูที่ปรึกษา')}${sign('หัวหน้าแผนกวิชา', dept.head)}${sign('หัวหน้างานแนะแนวอาชีพและจัดหางาน', i.guidanceHead)}</div>
      <div class="p-decision">ผลการพิจารณา &nbsp; ☐ อนุมัติ &nbsp; ☐ สำรอง &nbsp; ☐ ไม่อนุมัติ &nbsp;&nbsp; ความเห็น ...............................................................................................</div>
    </div>
    ${footer(view)}
  </section>`;
  run(`ใบสมัคร_${app.code || ''}`, html);
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
const signOff = (view) => `<div class="p-signs">${sign('หัวหน้างานแนะแนวอาชีพและจัดหางาน', view.institution?.guidanceHead)}${sign('ผู้อำนวยการ', view.institution?.director)}</div>`;

// kind: summary | external | department | recipients
export function printReport(kind, view, { year = '', departmentId = '', rec: customRec } = {}) {
  const s = stats(view, year);
  const yl = year ? `ปีการศึกษา ${esc(year)}` : 'ทุกปีการศึกษา';
  let title, body;
  if (kind === 'external') {
    title = 'รายงานสรุปทุนการศึกษาจากหน่วยงานภายนอก';
    const ext = s.rec.filter((r) => r.type === 'external');
    body = `${kpis(s)}<h2>สรุปยอดเงินทุนแยกตามหน่วยงานผู้สนับสนุน</h2>${rankTable(s.bySponsorExt, 'หน่วยงานผู้สนับสนุน')}<h2>รายชื่อผู้ได้รับทุนจากหน่วยงานภายนอก</h2>${recipientTable(view, ext)}`;
  } else if (kind === 'department') {
    const d = view.departments.find((x) => x.id === departmentId);
    title = `รายงานสรุปการจัดสรรทุนการศึกษา ${d?.name || ''}`;
    const rec = s.rec.filter((r) => r.departmentId === departmentId);
    const ds = stats({ ...view, recipients: rec }, year);
    body = `${kpis(ds)}<h2>สรุปตามแหล่งทุน</h2>${rankTable(ds.bySponsor, 'แหล่งทุน')}<h2>รายชื่อผู้ได้รับทุน</h2>${recipientTable(view, rec)}<div class="p-signs">${sign('หัวหน้าแผนกวิชา', d?.head)}${sign('หัวหน้างานแนะแนวอาชีพและจัดหางาน', view.institution?.guidanceHead)}</div>`;
  } else if (kind === 'recipients') {
    title = 'รายชื่อผู้ได้รับทุนการศึกษา';
    body = recipientTable(view, customRec || s.rec);
  } else {
    title = 'รายงานสรุปผลการจัดสรรทุนการศึกษา';
    body = `${kpis(s)}<h2>จัดอันดับตามแผนกวิชา</h2>${rankTable(s.byDept, 'แผนกวิชา')}<h2>จัดอันดับตามแหล่งทุน</h2>${rankTable(s.bySponsor, 'แหล่งทุน')}
      <h2>สรุปตามระดับชั้น</h2><table class="p-table"><thead><tr><th>ระดับชั้น</th><th class="n">จำนวนทุน</th><th class="n">จำนวนเงิน (บาท)</th></tr></thead><tbody>${s.byLevel.map((l) => `<tr><td>${l.level}</td><td class="n">${num(l.count)}</td><td class="n">${num(l.amount)}</td></tr>`).join('')}</tbody></table>`;
  }
  const html = `<section class="page">${header(view, title, yl)}${body}${kind !== 'department' && kind !== 'recipients' ? signOff(view) : ''}${footer(view)}</section>`;
  run(`${title}_${year || 'ทั้งหมด'}`, html);
}
