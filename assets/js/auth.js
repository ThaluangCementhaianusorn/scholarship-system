// กุญแจเข้าสู่ระบบด้วยรหัสผ่าน สำหรับผู้ดูแลระบบ / หัวหน้างานครูที่ปรึกษาและการแนะแนว
// GitHub Token ถูกเข้ารหัสด้วยรหัสผ่านของแต่ละคน (PBKDF2-SHA256 600,000 รอบ + AES-256-GCM)
// ไฟล์ที่เข้ารหัสแล้วเผยแพร่ใน public.json ได้ — ถอดรหัสได้เฉพาะผู้ที่รู้รหัสผ่าน
export const KEY_ROLES = ['admin', 'guidance'];
export const KDF_ITER = 600000;

const enc = new TextEncoder();
const dec = new TextDecoder();
const b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function deriveKey(password, salt, iter) {
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function sealKey(payload, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, KDF_ITER);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(payload))));
  return { salt: b64(salt), iv: b64(iv), data: b64(ct), iter: KDF_ITER };
}

export async function openKey(k, password) {
  const key = await deriveKey(password, unb64(k.salt), k.iter || KDF_ITER);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(k.iv) }, key, unb64(k.data));
  return JSON.parse(dec.decode(pt));
}

// รหัสผ่านของบัญชีที่ถือกุญแจต้องแข็งแรงพอ (ข้อมูลที่เข้ารหัสอยู่ในที่สาธารณะ)
export function passwordProblem(pw) {
  if (!pw || pw.length < 10) return 'รหัสผ่านต้องมีอย่างน้อย 10 ตัวอักษร';
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return 'รหัสผ่านต้องมีทั้งตัวอักษรภาษาอังกฤษและตัวเลข';
  return '';
}
