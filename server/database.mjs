import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const DEMO_PASSWORD = 'Paperplane!26';

const initialDocs = [
  {
    id: 'intro-alex', owner: 'alex', title: 'Product launch notes',
    content: { type: 'doc', children: [
      { type: 'h1', children: [{ type: 'text', value: 'Product launch notes' }] },
      { type: 'p', children: [{ type: 'text', value: 'A shared place to turn conversations into progress.' }] },
      { type: 'h2', children: [{ type: 'text', value: 'This week’s focus' }] },
      { type: 'ul', children: [
        { type: 'li', children: [{ type: 'text', value: 'Align on the first release scope' }] },
        { type: 'li', children: [{ type: 'text', value: 'Collect early feedback from the team' }] },
        { type: 'li', children: [{ type: 'text', value: 'Ship something worth learning from' }] }
      ] },
      { type: 'p', children: [{ type: 'text', value: 'Jordan has edit access to this doc. Switch accounts to see it show up under Shared with me.' }] }
    ] }
  },
  {
    id: 'ideas-alex', owner: 'alex', title: 'Ideas worth exploring',
    content: { type: 'doc', children: [
      { type: 'h2', children: [{ type: 'text', value: 'The idea parking lot' }] },
      { type: 'p', children: [{ type: 'text', value: 'A home for interesting questions we are not ready to answer yet.' }] },
      { type: 'ul', children: [
        { type: 'li', children: [{ type: 'text', value: 'What would make async work feel easier?' }] },
        { type: 'li', children: [{ type: 'text', value: 'Where do important decisions get lost?' }] }
      ] }
    ] }
  },
  {
    id: 'handoff-jordan', owner: 'jordan', title: 'Design handoff checklist',
    content: { type: 'doc', children: [
      { type: 'h1', children: [{ type: 'text', value: 'Design handoff' }] },
      { type: 'p', children: [{ type: 'text', value: 'A repeatable checklist for smoother releases.' }] },
      { type: 'ol', children: [
        { type: 'li', children: [{ type: 'text', value: 'Confirm empty, loading, and error states' }] },
        { type: 'li', children: [{ type: 'text', value: 'Review keyboard navigation' }] },
        { type: 'li', children: [{ type: 'text', value: 'Walk through the happy path together' }] }
      ] }
    ] }
  }
];

export function openDatabase(filePath) {
  if (filePath !== ':memory:') fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const db = new DatabaseSync(filePath);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE, name TEXT NOT NULL,
      salt TEXT NOT NULL, password_hash TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id), title TEXT NOT NULL,
      content_json TEXT NOT NULL, preview TEXT NOT NULL DEFAULT '', version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS documents_owner ON documents(owner_id);
    CREATE TABLE IF NOT EXISTS shares (
      document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      permission TEXT NOT NULL CHECK(permission IN ('view','edit')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (document_id,user_id)
    );
    CREATE INDEX IF NOT EXISTS shares_user ON shares(user_id);
  `);
  const existing = db.prepare('SELECT COUNT(*) AS count FROM users').get().count;
  if (!existing) {
    const createUser = db.prepare('INSERT INTO users (id, email, name, salt, password_hash) VALUES (?,?,?,?,?)');
    for (const user of [
      { id: 'alex', email: 'alex@relaydemo.app', name: 'Alex Morgan' },
      { id: 'jordan', email: 'jordan@relaydemo.app', name: 'Jordan Lee' }
    ]) {
      const salt = crypto.randomBytes(16).toString('hex');
      const passwordHash = crypto.pbkdf2Sync(DEMO_PASSWORD, Buffer.from(salt, 'hex'), 120000, 32, 'sha256').toString('hex');
      createUser.run(user.id, user.email, user.name, salt, passwordHash);
    }
    const addDoc = db.prepare('INSERT INTO documents (id, owner_id, title, content_json, preview, updated_at) VALUES (?,?,?,?,?,?)');
    for (let i = 0; i < initialDocs.length; i++) {
      const doc = initialDocs[i];
      const preview = doc.content.children.map(n => n.children?.map(x => x.value ?? '').join(' ') ?? '').join(' ').slice(0, 180);
      addDoc.run(doc.id, doc.owner, doc.title, JSON.stringify(doc.content), preview, new Date(Date.now() - i * 3600000).toISOString());
    }
    db.prepare('INSERT INTO shares (document_id, user_id, permission) VALUES (?,?,?)').run('intro-alex', 'jordan', 'edit');
    db.prepare('INSERT INTO shares (document_id, user_id, permission) VALUES (?,?,?)').run('handoff-jordan', 'alex', 'view');
  }
  return db;
}

export function permission(db, docId, userId) {
  const row = db.prepare(`SELECT d.owner_id, s.permission FROM documents d
    LEFT JOIN shares s ON s.document_id = d.id AND s.user_id = ? WHERE d.id = ?`).get(userId, docId);
  if (!row) return null;
  return row.owner_id === userId ? 'owner' : (row.permission ?? null);
}
