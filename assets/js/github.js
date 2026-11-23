// GitHub Contents API client — ใช้ GitHub repo เป็นฐานข้อมูล (JSON + ไฟล์แนบ)
const API = 'https://api.github.com';
const enc = new TextEncoder();
const dec = new TextDecoder();

export function b64FromBytes(bytes) {
  let s = '';
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
  return btoa(s);
}
export const b64FromText = (t) => b64FromBytes(enc.encode(t));

// git blob sha = sha1("blob <len>\0" + content) — ใช้แทนการเรียก API ซ้ำเพื่อหา sha
async function blobSha(bytes) {
  const head = enc.encode(`blob ${bytes.length}\0`);
  const all = new Uint8Array(head.length + bytes.length);
  all.set(head); all.set(bytes, head.length);
  const h = await crypto.subtle.digest('SHA-1', all);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

async function toError(r) {
  let msg = `${r.status} ${r.statusText}`;
  try { const j = await r.json(); if (j.message) msg = j.message; } catch {}
  return new HttpError(r.status, msg);
}

export class GitHub {
  constructor({ owner, branch, token }) { Object.assign(this, { owner, branch, token }); }

  headers(extra = {}, accept = 'application/vnd.github.raw+json') {
    const h = { Accept: accept, 'X-GitHub-Api-Version': '2022-11-28', ...extra };
    if (this.token) h.Authorization = `Bearer ${this.token}`;
    return h;
  }
  url(repo, path) {
    const p = path.split('/').map(encodeURIComponent).join('/');
    return `${API}/repos/${this.owner}/${repo}/contents/${p}`;
  }

  async readJSON(repo, path, etag) {
    const r = await fetch(`${this.url(repo, path)}?ref=${this.branch}`, {
      headers: this.headers(etag ? { 'If-None-Match': etag } : {}), cache: 'no-store',
    });
    if (r.status === 304) return { notModified: true, etag };
    if (r.status === 404) return { missing: true };
    if (!r.ok) throw await toError(r);
    const bytes = new Uint8Array(await r.arrayBuffer());
    return { data: JSON.parse(dec.decode(bytes)), sha: await blobSha(bytes), etag: r.headers.get('ETag') };
  }

  async readBlob(repo, path) {
    const r = await fetch(`${this.url(repo, path)}?ref=${this.branch}`, { headers: this.headers(), cache: 'no-store' });
    if (!r.ok) throw await toError(r);
    return r.blob();
  }

  async put(repo, path, base64, sha, message) {
    const body = { message, content: base64, branch: this.branch };
    if (sha) body.sha = sha;
    const r = await fetch(this.url(repo, path), {
      method: 'PUT',
      headers: this.headers({ 'Content-Type': 'application/json' }, 'application/vnd.github+json'),
      body: JSON.stringify(body),
    });
    if (!r.ok) throw await toError(r);
    return r.json();
  }

  async repo(repo) {
    const r = await fetch(`${API}/repos/${this.owner}/${repo}`, { headers: this.headers({}, 'application/vnd.github+json') });
    if (!r.ok) throw await toError(r);
    return r.json();
  }
}
