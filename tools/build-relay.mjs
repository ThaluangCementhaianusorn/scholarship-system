// สร้างไฟล์ relay/Code.gs จาก model.js + ops.js + relay-core.js
// ใช้งาน: node tools/build-relay.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const strip = (src) => src
  .replace(/^import .*$/gm, '')
  .replace(/^export \{[^}]*\};?$/gm, '')
  .replace(/^export (const|function|let|class) /gm, '$1 ');

const header = `/**
 * ============================================================================
 * TL Scholarship — Relay (Google Apps Script) v2
 * ระบบบัญชีผู้ใช้ (ผู้ดูแลระบบ / ผู้อำนวยการ / รองผู้อำนวยการ / หัวหน้าแผนก / งานครูที่ปรึกษาฯ / นักศึกษา)
 * รับใบสมัคร + ไฟล์แนบ, การพิจารณาทุน, ลงนามออนไลน์ — บันทึกลงฐานข้อมูล GitHub
 * GitHub Token ถูกเก็บไว้ฝั่งเซิร์ฟเวอร์ (Script Properties) ไม่เปิดเผยบนหน้าเว็บ
 * ----------------------------------------------------------------------------
 * ไฟล์นี้สร้างอัตโนมัติด้วย: node tools/build-relay.mjs (ห้ามแก้ไขโดยตรง)
 * ============================================================================
 * วิธีติดตั้ง (ทำครั้งเดียว):
 * 1. https://script.google.com → New project → ลบโค้ดเดิม → วางโค้ดไฟล์นี้ทั้งหมด → Save
 * 2. Project Settings (รูปเฟือง) → Script Properties → Add property 4 รายการ:
 *      GITHUB_TOKEN = github_pat_...  (Fine-grained token: Repository access เลือก
 *                                      scholarship-db และ scholarship-system,
 *                                      Permissions → Contents: Read and write)
 *      GITHUB_OWNER = ThaluangCementhaianusorn
 *      GITHUB_REPO  = scholarship-db
 *      SITE_REPO    = scholarship-system
 * 3. Deploy → New deployment → Select type: Web app
 *      Execute as: Me   |   Who has access: Anyone   → Deploy → อนุญาตสิทธิ์
 * 4. คัดลอก Web app URL (ลงท้าย /exec) → เว็บระบบ → ผู้ดูแล → ตั้งค่า → ระบบ → Relay URL → บันทึก
 * (เมื่ออัปเดตโค้ด: Deploy → Manage deployments → Edit → Version: New version)
 * ============================================================================
 */
`;
const out = [
  header,
  '// ===================== model.js =====================',
  strip(fs.readFileSync(path.join(root, 'assets/js/model.js'), 'utf8')),
  '// ===================== ops.js =====================',
  strip(fs.readFileSync(path.join(root, 'assets/js/ops.js'), 'utf8')),
  fs.readFileSync(path.join(root, 'tools/relay-core.js'), 'utf8'),
].join('\n');
fs.writeFileSync(path.join(root, 'relay/Code.gs'), out);
console.log('relay/Code.gs', out.length, 'bytes');
