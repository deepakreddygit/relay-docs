import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { openDatabase, permission } from './database.mjs';
import { EMPTY_CONTENT, validateContent, plainText, validTitle, canEdit, canManage, canRead } from './content.mjs';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(dirname, '../public');
const files = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/favicon.svg', ['favicon.svg', 'image/svg+xml']]
]);
const sessionsAge = 7 * 24 * 3600 * 1000;
const DEMO_RATE_WINDOW = 15 * 60 * 1000;
const loginAttempts = new Map();

function send(res, status, value, headers = {}) {
  const body = JSON.stringify(value);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(body);
}
function problem(res, status, message, code) { send(res, status, { error: message, ...(code ? { code } : {}) }); }
async function bodyJSON(req) {
  let size = 0;
  const pieces = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 375000) { const error = new Error('Payload too large.'); error.status = 413; throw error; }
    pieces.push(chunk);
  }
  try {
    const data = JSON.parse(Buffer.concat(pieces).toString('utf8'));
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error();
    return data;
  } catch { const error = new Error('Invalid JSON request.'); error.status = 400; throw error; }
}
function tokenHash(token) { return crypto.createHash('sha256').update(token).digest('hex'); }
function getSession(req, db) {
  const match = (req.headers.cookie ?? '').match(/(?:^|;\s*)relay_session=([a-f0-9]{64})(?:;|$)/);
  if (!match) return null;
  return db.prepare(`SELECT users.id, users.email, users.name FROM sessions JOIN users ON sessions.user_id=users.id
    WHERE sessions.token_hash = ? AND sessions.expires_at > ?`).get(tokenHash(match[1]), Date.now()) ?? null;
}
function cookieHeader(req, token, maxAge) {
  const https = req.socket.encrypted || req.headers['x-forwarded-proto'] === 'https';
  return `relay_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${https ? '; Secure' : ''}`;
}
function checkOrigin(req) {
  if (['GET', 'HEAD'].includes(req.method)) return true;
  if (!req.headers.origin) return true;
  try { return new URL(req.headers.origin).host === req.headers.host; } catch { return false; }
}
function toDoc(row, role) {
  return { ...row, content: JSON.parse(row.content_json), content_json: undefined, permission: role };
}

export function createApp({ databasePath = path.resolve(process.env.DATA_DIR || 'data', 'relay.sqlite'), database } = {}) {
  const db = database ?? openDatabase(databasePath);
  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    const url = new URL(req.url || '/', 'http://localhost');
    const p = url.pathname;
    if (!p.startsWith('/api/')) {
      const entry = files.get(p) || (!path.extname(p) ? files.get('/') : null);
      if (!entry || req.method !== 'GET') return problem(res, 404, 'Not found.');
      const [filename, mime] = entry;
      res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': filename === 'index.html' ? 'no-cache' : 'public, max-age=300' });
      fs.createReadStream(path.join(publicDir, filename)).pipe(res);
      return;
    }
    try {
      if (!checkOrigin(req)) return problem(res, 403, 'Cross-origin request blocked.');
      if (req.method === 'GET' && p === '/api/health') return send(res, 200, { ok: true });
      if (req.method === 'POST' && p === '/api/login') {
        const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'local').split(',')[0].trim();
        const attempts = loginAttempts.get(ip) ?? { count: 0, reset: Date.now() + DEMO_RATE_WINDOW };
        if (Date.now() > attempts.reset) { attempts.count = 0; attempts.reset = Date.now() + DEMO_RATE_WINDOW; }
        if (attempts.count >= 20) return problem(res, 429, 'Too many sign-in attempts. Please try again later.');
        const data = await bodyJSON(req);
        if (typeof data.email !== 'string' || typeof data.password !== 'string' || data.email.length > 180 || data.password.length > 200) return problem(res, 400, 'Enter a valid email and password.');
        const user = db.prepare('SELECT * FROM users WHERE email = ?').get(data.email.trim().toLowerCase());
        const actual = crypto.pbkdf2Sync(data.password, Buffer.from(user?.salt ?? '00'.repeat(16), 'hex'), 120000, 32, 'sha256');
        const expected = Buffer.from(user?.password_hash ?? '00'.repeat(32), 'hex');
        if (!user || !crypto.timingSafeEqual(actual, expected)) {
          loginAttempts.set(ip, { count: attempts.count + 1, reset: attempts.reset });
          return problem(res, 401, 'Incorrect email or password.');
        }
        loginAttempts.delete(ip);
        const token = crypto.randomBytes(32).toString('hex');
        db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
        db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?,?,?)').run(tokenHash(token), user.id, Date.now() + sessionsAge);
        return send(res, 200, { user: { id: user.id, email: user.email, name: user.name } }, { 'Set-Cookie': cookieHeader(req, token, sessionsAge / 1000) });
      }
      const user = getSession(req, db);
      if (!user) return problem(res, 401, 'Please sign in to continue.');
      if (p === '/api/me' && req.method === 'GET') return send(res, 200, { user });
      if (p === '/api/logout' && req.method === 'POST') {
        const token = (req.headers.cookie || '').match(/relay_session=([a-f0-9]{64})/)?.[1];
        if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash(token));
        return send(res, 200, { ok: true }, { 'Set-Cookie': cookieHeader(req, '', 0) });
      }
      if (p === '/api/users' && req.method === 'GET') {
        return send(res, 200, { users: db.prepare('SELECT id,email,name FROM users WHERE id != ? ORDER BY name').all(user.id) });
      }
      if (p === '/api/documents' && req.method === 'GET') {
        const rows = db.prepare(`SELECT d.id,d.title,d.preview,d.owner_id, u.name AS owner_name,d.version,d.created_at,d.updated_at,
            CASE WHEN d.owner_id = ? THEN 'owner' ELSE s.permission END AS permission
            FROM documents d JOIN users u ON u.id=d.owner_id
            LEFT JOIN shares s ON s.document_id=d.id AND s.user_id=?
            WHERE d.owner_id=? OR s.user_id=? ORDER BY d.updated_at DESC`).all(user.id, user.id, user.id, user.id);
        return send(res, 200, { documents: rows });
      }
      if (p === '/api/documents' && req.method === 'POST') {
        const data = await bodyJSON(req);
        const title = data.title === undefined ? 'Untitled document' : data.title;
        const content = data.content ?? EMPTY_CONTENT;
        if (!validTitle(title) || !validateContent(content)) return problem(res, 400, 'Invalid document title or content.');
        const id = crypto.randomUUID();
        db.prepare('INSERT INTO documents (id,owner_id,title,content_json,preview) VALUES (?,?,?,?,?)')
          .run(id, user.id, title.trim(), JSON.stringify(content), plainText(content).slice(0, 180));
        return send(res, 201, { id });
      }
      const shareMatch = p.match(/^\/api\/documents\/([^/]+)\/shares(?:\/([^/]+))?$/);
      const docMatch = p.match(/^\/api\/documents\/([^/]+)$/);
      if (shareMatch) {
        const [, id, shareUser] = shareMatch;
        const role = permission(db, id, user.id);
        if (!canRead(role)) return problem(res, 404, 'Document not found or access denied.');
        if (req.method === 'GET' && !shareUser) {
          return send(res, 200, { shares: db.prepare(`SELECT u.id,u.name,u.email,s.permission FROM shares s JOIN users u ON u.id=s.user_id
            WHERE s.document_id=? ORDER BY s.created_at`).all(id) });
        }
        if (!canManage(role)) return problem(res, 403, 'Only the owner can change sharing.');
        if (req.method === 'POST' && !shareUser) {
          const data = await bodyJSON(req);
          if (typeof data.email !== 'string' || data.email.length > 180 || !['view','edit'].includes(data.permission)) return problem(res, 400, 'Enter a valid email and permission.');
          const target = db.prepare('SELECT id,name,email FROM users WHERE email = ?').get(data.email.trim().toLowerCase());
          if (!target) return problem(res, 404, 'No demo user found with that email.');
          if (target.id === user.id) return problem(res, 400, 'You already own this document.');
          db.prepare(`INSERT INTO shares (document_id,user_id,permission) VALUES (?,?,?)
            ON CONFLICT(document_id,user_id) DO UPDATE SET permission=excluded.permission`).run(id, target.id, data.permission);
          return send(res, 200, { share: { ...target, permission: data.permission } });
        }
        if (req.method === 'DELETE' && shareUser) {
          db.prepare('DELETE FROM shares WHERE document_id=? AND user_id=?').run(id, shareUser);
          return send(res, 200, { ok: true });
        }
        return problem(res, 405, 'Method not allowed.');
      }
      if (docMatch) {
        const id = docMatch[1];
        const role = permission(db, id, user.id);
        if (!canRead(role)) return problem(res, 404, 'Document not found or access denied.');
        if (req.method === 'GET') {
          const row = db.prepare(`SELECT d.*,u.name AS owner_name FROM documents d JOIN users u ON u.id=d.owner_id WHERE d.id=?`).get(id);
          return send(res, 200, { document: toDoc(row, role) });
        }
        if (req.method === 'PATCH') {
          if (!canEdit(role)) return problem(res, 403, 'You have view-only access to this document.');
          const data = await bodyJSON(req);
          if (!validTitle(data.title) || !validateContent(data.content) || !Number.isInteger(data.expectedVersion) || data.expectedVersion < 1) {
            return problem(res, 400, 'Invalid title, content, or revision.');
          }
          const row = db.prepare(`UPDATE documents SET title=?, content_json=?, preview=?, version=version+1,
            updated_at=CURRENT_TIMESTAMP WHERE id=? AND version=? RETURNING version,updated_at`).get(
            data.title.trim(), JSON.stringify(data.content), plainText(data.content).slice(0,180), id, data.expectedVersion);
          if (!row) return problem(res, 409, 'This document was changed elsewhere. Copy your changes or reload to see the latest.', 'VERSION_CONFLICT');
          return send(res, 200, row);
        }
        if (req.method === 'DELETE') {
          if (!canManage(role)) return problem(res, 403, 'Only the owner can delete this document.');
          db.prepare('DELETE FROM documents WHERE id=?').run(id);
          return send(res, 200, { ok: true });
        }
        return problem(res, 405, 'Method not allowed.');
      }
      return problem(res, 404, 'Not found.');
    } catch (err) {
      console.error('[relay]', err);
      return problem(res, err.status || 500, err.status ? err.message : 'Something went wrong. Please try again.');
    }
  });
  return { server, db, close() { server.close(); db.close(); } };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { server } = createApp();
  const port = Number(process.env.PORT || 3000);
  server.listen(port, '0.0.0.0', () => console.log(`Relay Docs running at http://localhost:${port}`));
}
