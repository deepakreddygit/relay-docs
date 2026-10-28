import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { createApp } from '../server/index.mjs';
import { validateContent, plainText, canRead, canEdit, canManage } from '../server/content.mjs';

async function setup(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'relay-test-'));
  const databasePath = path.join(dir, 'data.sqlite');
  const app = createApp({ databasePath });
  app.server.listen(0, '127.0.0.1');
  await once(app.server, 'listening');
  let closed = false;
  const base = `http://127.0.0.1:${app.server.address().port}`;
  async function request(uri, { method = 'GET', payload, cookie } = {}) {
    const response = await fetch(`${base}/api${uri}`, {
      method,
      headers: { ...(payload ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) },
      body: payload ? JSON.stringify(payload) : undefined
    });
    const json = await response.json();
    return { status: response.status, data: json, cookie: response.headers.get('set-cookie')?.split(';')[0] };
  }
  async function signin(email) {
    const response = await request('/login', { method: 'POST', payload: { email, password: 'Paperplane!26' } });
    assert.equal(response.status, 200);
    return response.cookie;
  }
  t.after(async () => {
    if (!closed) { await new Promise(resolve => app.server.close(resolve)); app.db.close(); }
    fs.rmSync(dir, { recursive: true, force: true });
  });
  async function close() { await new Promise(resolve => app.server.close(resolve)); app.db.close(); closed = true; }
  return { request, signin, databasePath, close };
}

test('access policy makes view-only and owner permissions explicit', () => {
  assert.equal(canRead(null), false);
  assert.equal(canRead('view'), true);
  assert.equal(canEdit('view'), false);
  assert.equal(canEdit('edit'), true);
  assert.equal(canManage('edit'), false);
  assert.equal(canManage('owner'), true);
});

test('rich-text content validation rejects script nodes and huge payloads', () => {
  const safe = { type: 'doc', children: [{ type: 'h1', children: [{ type: 'text', value: 'Hello' }] }, { type: 'p', children: [{ type: 'strong', children: [{ type: 'text', value: 'world' }] }] }] };
  assert.equal(validateContent(safe), true);
  assert.equal(plainText(safe), 'Hello world');
  assert.equal(validateContent({ type: 'doc', children: [{ type: 'script', value: 'alert(1)' }] }), false);
  assert.equal(validateContent({ type: 'doc', children: [{ type: 'text', value: 'a', onclick: 'danger()' }] }), false);
  assert.equal(validateContent({ type: 'doc', children: [{ type: 'text', value: 'a'.repeat(240001) }] }), false);
  assert.equal(validateContent({ type: 'p', children: [] }), false);
});

test('login requires valid demo credentials and issues HttpOnly session', async t => {
  const { request } = await setup(t);
  assert.equal((await request('/me')).status, 401);
  assert.equal((await request('/login', { method: 'POST', payload: { email: 'alex@relaydemo.app', password: 'wrong' } })).status, 401);
  const login = await request('/login', { method: 'POST', payload: { email: 'alex@relaydemo.app', password: 'Paperplane!26' } });
  assert.equal(login.status, 200);
  assert.ok(login.cookie.startsWith('relay_session='));
  const me = await request('/me', { cookie: login.cookie });
  assert.equal(me.data.user.id, 'alex');
  assert.equal((await request('/logout', { method: 'POST', cookie: login.cookie })).status, 200);
  assert.equal((await request('/me', { cookie: login.cookie })).status, 401);
});

test('only owner can share; recipient sees edit versus view access', async t => {
  const { request, signin } = await setup(t);
  const alex = await signin('alex@relaydemo.app');
  const jordan = await signin('jordan@relaydemo.app');
  assert.equal((await request('/documents/ideas-alex', { cookie: jordan })).status, 404);
  const ownerList = await request('/documents', { cookie: alex });
  assert.equal(ownerList.data.documents.filter(d => d.permission === 'owner').length, 2);
  assert.equal(ownerList.data.documents.find(d => d.id === 'handoff-jordan').permission, 'view');
  assert.equal((await request('/documents/handoff-jordan', { method: 'PATCH', cookie: alex, payload: { title: 'Nope', content: { type: 'doc' }, expectedVersion: 1 } })).status, 403);
  assert.equal((await request('/documents/intro-alex/shares', { method: 'POST', cookie: jordan, payload: { email: 'alex@relaydemo.app', permission: 'edit' } })).status, 403);
  const shared = await request('/documents/ideas-alex/shares', { method: 'POST', cookie: alex, payload: { email: 'jordan@relaydemo.app', permission: 'view' } });
  assert.equal(shared.status, 200);
  assert.equal((await request('/documents/ideas-alex', { cookie: jordan })).data.document.permission, 'view');
  const edited = await request('/documents/ideas-alex/shares', { method: 'POST', cookie: alex, payload: { email: 'jordan@relaydemo.app', permission: 'edit' } });
  assert.equal(edited.status, 200);
  assert.equal((await request('/documents/ideas-alex', { cookie: jordan })).data.document.permission, 'edit');
  assert.equal((await request('/documents/ideas-alex/shares/jordan', { method: 'DELETE', cookie: alex })).status, 200);
  assert.equal((await request('/documents/ideas-alex', { cookie: jordan })).status, 404);
});

test('autosave API stores formatted content and rejects stale document versions', async t => {
  const { request, signin } = await setup(t);
  const alex = await signin('alex@relaydemo.app');
  const created = await request('/documents', { method: 'POST', cookie: alex, payload: { title: 'Test draft', content: { type: 'doc', children: [{ type: 'p', children: [{ type: 'text', value: 'Draft' }] }] } } });
  assert.equal(created.status, 201);
  const id = created.data.id;
  const content = { type: 'doc', children: [{ type: 'h2', children: [{ type: 'text', value: 'Milestones' }] }, { type: 'ul', children: [{ type: 'li', children: [{ type: 'strong', children: [{ type: 'text', value: 'Ship v1' }] }] }] }] };
  const saved = await request(`/documents/${id}`, { method: 'PATCH', cookie: alex, payload: { title: 'Project plan', content, expectedVersion: 1 } });
  assert.equal(saved.status, 200);
  assert.equal(saved.data.version, 2);
  assert.equal((await request(`/documents/${id}`, { method: 'PATCH', cookie: alex, payload: { title: 'stale', content, expectedVersion: 1 } })).status, 409);
  const reopened = await request(`/documents/${id}`, { cookie: alex });
  assert.equal(reopened.data.document.title, 'Project plan');
  assert.deepEqual(reopened.data.document.content, content);
  assert.equal(reopened.data.document.version, 2);
  assert.equal((await request(`/documents/${id}`, { method: 'PATCH', cookie: alex, payload: { title: 'unsafe', content: { type: 'doc', children: [{ type: 'iframe', src: 'bad' }] }, expectedVersion: 2 } })).status, 400);
});

test('SQLite persists documents after application restart', async t => {
  const { request, signin, databasePath, close } = await setup(t);
  const alex = await signin('alex@relaydemo.app');
  const created = await request('/documents', { method: 'POST', cookie: alex, payload: { title: 'Persistent draft' } });
  assert.equal(created.status, 201);
  await close();
  const next = createApp({ databasePath });
  next.server.listen(0, '127.0.0.1');
  await once(next.server, 'listening');
  t.after(async () => { await new Promise(resolve => next.server.close(resolve)); next.db.close(); });
  const reopened = await fetch(`http://127.0.0.1:${next.server.address().port}/api/documents/${created.data.id}`, { headers: { Cookie: alex } });
  assert.equal(reopened.status, 200);
  assert.equal((await reopened.json()).document.title, 'Persistent draft');
});
