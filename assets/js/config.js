// ตั้งค่าการเชื่อมต่อฐานข้อมูลบน GitHub
// siteRepo = repo สาธารณะที่โฮสต์เว็บ (GitHub Pages) + ไฟล์ข้อมูลสาธารณะ data/public.json
// dbRepo   = repo ส่วนตัว (Private) เก็บฐานข้อมูลเต็ม db.json และไฟล์เอกสารแนบ uploads/
export const CONFIG = {
  owner: 'ThaluangCementhaianusorn',
  siteRepo: 'scholarship-system',
  dbRepo: 'scholarship-db',
  branch: 'main',
  publicPath: 'data/public.json',
  dbPath: 'db.json',
  uploadDir: 'uploads',
  pollMs: 30000,
  maxFileMB: 5,
  maxFiles: 8,
};
