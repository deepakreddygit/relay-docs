/* Relay Docs: minimal browser client with an explicit, safe rich-text JSON model. */
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const app = $('#app');
const toastRegion = $('#toast');
const EMPTY = () => ({ type: 'doc', children: [{ type: 'p', children: [] }] });
const escapeHTML = (input) => String(input ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const state = { user: null, documents: [], filter: 'all', search: '', current: null, dirty: 0, saved: 0, saving: false, inflight: null, blocked: false, saveTimer: null };
const logo = `<span class="brand-symbol"><svg width="23" height="23" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5.5 5.2h8.4l4.6 4.7v8.6a1.6 1.6 0 0 1-1.6 1.6H7.1a1.6 1.6 0 0 1-1.6-1.6V5.2Z" fill="white"/><path d="M13.8 5.2v4.6h4.7" stroke="#C6CAFF" stroke-width="1.7"/><path d="M9 14h6m-6 3h4" stroke="#5157DA" stroke-width="1.6" stroke-linecap="round"/></svg></span>`;
const icons = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  arrow: '<path d="m15 18-6-6 6-6"/>',
  doc: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h6"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3.15a4 4 0 0 1 0 7.7M22 21v-2a4 4 0 0 0-3-3.87"/><circle cx="9" cy="7" r="4"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
  upload: '<path d="M12 16V3m0 0L7 8m5-5 5 5M4 17v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  check: '<path d="m4 12 5 5L20 6"/>',
  cloud: '<path d="M20 17.6A5 5 0 0 0 17.5 8 7 7 0 0 0 4.1 10 4.1 4.1 0 0 0 5 18h14"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2m3 0-1 15H6L5 6M10 10v7M14 10v7"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  edit: '<path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L9 17l-4 1 1-4 10.5-10.5Z"/>',
  alert: '<path d="M12 3 2 21h20L12 3ZM12 9v4m0 4h.01"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  undo: '<path d="M3 7v6h6M3 13a9 9 0 1 1 2.1 5.3"/>',
  redo: '<path d="M21 7v6h-6m6 0a9 9 0 1 0-2.1 5.3"/>',
  bullet: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3" cy="6" r=".8"/><circle cx="3" cy="12" r=".8"/><circle cx="3" cy="18" r=".8"/>',
  numbered: '<path d="M10 6h11M10 12h11M10 18h11M3 7h2V3L3 4M3 13h3l-3 3h3M3 18h3v3H3"/>',
  sparkle: '<path d="m12 3 1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6L12 3ZM20 17l.7 1.7L22 19.4l-1.3.7L20 22l-.7-1.9-1.3-.7 1.3-.7L20 17Z"/>',
  logout: '<path d="M10 17l5-5-5-5M15 12H3M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7"/>'
};
function icon(name, size = 18) { return `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`; }
function notify(message, isError = false) {
  const el = document.createElement('div'); el.className = `toast ${isError ? 'toast-error' : ''}`; el.textContent = message;
  toastRegion.appendChild(el); setTimeout(() => el.remove(), 3800);
}
async function api(path, options = {}) {
  const response = await fetch('/api' + path, { credentials: 'same-origin', ...options,
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers } });
  let json = {};
  try { json = await response.json(); } catch { /* handled below */ }
  if (!response.ok) { const err = new Error(json.error || `Request failed (${response.status}).`); err.status = response.status; err.code = json.code; throw err; }
  return json;
}
const jsonBody = (data) => JSON.stringify(data);
function initials(name) { return String(name).split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase(); }
function timeAgo(raw) {
  const date = new Date(raw.endsWith('Z') || raw.includes('+') ? raw : raw.replace(' ', 'T') + 'Z');
  if (isNaN(date)) return 'Recently';
  const mins = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (mins < 1) return 'Just now'; if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60); if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24); if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
function go(path) { history.pushState(null, '', path); route(); window.scrollTo({ top: 0 }); }
function renderLoading() { app.innerHTML = `<div class="boot"><div class="spin"></div>Getting things ready...</div>`; }

function renderLogin() {
  app.innerHTML = `<div class="login-shell">
    <div class="login-visual">
      <div class="login-brand">${logo}<span>relay<span class="brand-dot">.</span></span><span class="brand-tag">DOCS</span></div>
      <div class="visual-copy"><span class="eyebrow light">YOUR SPACE TO CREATE</span><h1>Good ideas grow<br/>better <em>together.</em></h1><p>A calmer way to write, share, and keep the whole team on the same page.</p></div>
      <div class="visual-art"><div class="art-doc"><div class="art-top"><span class="art-dots"><i></i><i></i><i></i></span><span class="art-label">Team brainstorm</span></div><div class="art-inner"><span class="art-h"></span><span class="art-line w90"></span><span class="art-line w72"></span><span class="art-line w85"></span><span class="art-space"></span><span class="art-line w60"></span><span class="art-line w80"></span><span class="art-line w50"></span></div><div class="art-avatar a1">AM</div><div class="art-avatar a2">JL</div></div></div>
      <div class="visual-footer">Made for the work that matters. <span>✦</span></div>
    </div>
    <main class="login-form-side"><div class="login-form-wrap"><div class="login-mobile-brand">${logo} relay<span class="brand-dot">.</span></div>
      <span class="eyebrow">WELCOME TO RELAY</span><h2>Sign in to your space</h2><p class="login-sub">A little less busywork. A lot more progress.</p>
      <form id="login-form"><label class="field-label" for="login-email">Email address</label><input class="input-field" type="email" id="login-email" autocomplete="username" required value="alex@relaydemo.app" />
        <label class="field-label" for="login-password">Password</label><input class="input-field" type="password" id="login-password" autocomplete="current-password" required value="Paperplane!26" />
        <div class="inline-error" id="login-error" role="alert"></div><button class="btn btn-primary btn-full" type="submit" id="login-button">Sign in ${icon('chevron', 18)}</button>
      </form>
      <div class="login-divider"><span>OR EXPLORE AS</span></div>
      <div class="demo-users"><button class="demo-user" id="choose-alex"><span class="avatar purple">AM</span><span><strong>Alex Morgan</strong><small>Workspace owner</small></span>${icon('chevron', 16)}</button><button class="demo-user" id="choose-jordan"><span class="avatar coral">JL</span><span><strong>Jordan Lee</strong><small>Collaborator</small></span>${icon('chevron', 16)}</button></div>
      <p class="demo-caption">This is a demo workspace with seeded accounts. Both use <code>Paperplane!26</code>.</p>
    </div><div class="login-foot">Built as a focused product-engineering exercise · Relay Docs</div></main>
  </div>`;
  $('#choose-alex').onclick = () => { $('#login-email').value = 'alex@relaydemo.app'; $('#login-password').value = 'Paperplane!26'; $('#login-form').requestSubmit(); };
  $('#choose-jordan').onclick = () => { $('#login-email').value = 'jordan@relaydemo.app'; $('#login-password').value = 'Paperplane!26'; $('#login-form').requestSubmit(); };
  $('#login-form').onsubmit = async (e) => {
    e.preventDefault(); const button = $('#login-button'); button.disabled = true; button.textContent = 'Signing in...';
    $('#login-error').textContent = '';
    try { const result = await api('/login', { method: 'POST', body: jsonBody({ email: $('#login-email').value, password: $('#login-password').value }) }); state.user = result.user; go('/'); }
    catch (err) { $('#login-error').textContent = err.message; button.disabled = false; button.innerHTML = `Sign in ${icon('chevron', 18)}`; }
  };
}

function sidebar(active = 'all') {
  return `<aside class="sidebar" id="sidebar"><div class="sidebar-head"><div class="brand">${logo}<span>relay<span class="brand-dot">.</span></span><span class="brand-tag">DOCS</span></div>
    <div class="workspace-selector"><span class="workspace-icon">R</span><span><strong>Demo workspace</strong><small>Team space</small></span>${icon('down', 15)}</div></div>
    <div class="sidebar-section"><span class="nav-label">WORKSPACE</span>
      <button class="nav-item ${active === 'all' ? 'active' : ''}" data-filter="all">${icon('folder', 19)} All documents</button>
      <button class="nav-item ${active === 'owner' ? 'active' : ''}" data-filter="owner">${icon('doc', 19)} My documents</button>
      <button class="nav-item ${active === 'shared' ? 'active' : ''}" data-filter="shared">${icon('users', 19)} Shared with me</button>
    </div><div class="sidebar-bottom"><div class="tip-card"><span class="tip-icon">${icon('sparkle', 17)}</span><strong>Ideas work better shared.</strong><p>Invite a teammate to any document you own.</p></div>
      <button class="user-chip" id="user-menu"><span class="avatar ${state.user.id === 'alex' ? 'purple' : 'coral'}">${escapeHTML(initials(state.user.name))}</span><span class="user-info"><strong>${escapeHTML(state.user.name)}</strong><small>Switch account / Sign out</small></span>${icon('more', 18)}</button>
    </div></aside>`;
}
function wireSidebar() {
  $$('.nav-item').forEach((el) => el.onclick = () => { state.filter = el.dataset.filter; state.search = ''; go('/'); });
  $('#user-menu').onclick = async () => { if (!confirm('Sign out of this demo account? You can sign in as the other user to review sharing.')) return; await signOut(); };
}
async function signOut() {
  await flushSave();
  try { await api('/logout', { method: 'POST' }); } catch { /* session may have expired */ }
  state.user = null; state.current = null; state.documents = []; state.filter = 'all'; state.search = '';
  go('/');
}
async function loadDocuments() { const result = await api('/documents'); state.documents = result.documents; }
function permissionLabel(doc) { return doc.permission === 'owner' ? 'Owned by you' : doc.permission === 'edit' ? 'Can edit' : 'View only'; }
function cardHTML(doc, index) {
  const role = doc.permission === 'owner' ? 'owned' : 'shared';
  return `<button class="document-card" data-open="${escapeHTML(doc.id)}" aria-label="Open ${escapeHTML(doc.title)}">
      <div class="card-art art-${index % 4}"><div class="paper-icon">${icon('doc', 25)}</div><div class="paper-mini"><span class="mini-head"></span><span></span><span></span><span class="mini-short"></span></div></div>
      <div class="card-content"><div class="card-title-row"><strong>${escapeHTML(doc.title)}</strong>${icon('chevron', 17)}</div>
        <p>${escapeHTML(doc.preview || 'Your next big idea starts here.')}</p><div class="card-bottom"><span class="tag ${role}">${doc.permission === 'owner' ? icon('lock', 12) : icon('users', 12)} ${permissionLabel(doc)}</span><span class="card-time">${timeAgo(doc.updated_at)}</span></div></div>
    </button>`;
}
function updateGallery() {
  const visible = state.documents.filter(d => (state.filter === 'all' || (state.filter === 'owner' ? d.permission === 'owner' : d.permission !== 'owner')) &&
    `${d.title} ${d.preview} ${d.owner_name}`.toLowerCase().includes(state.search.toLowerCase()));
  const gallery = $('#doc-gallery');
  if (!gallery) return;
  gallery.innerHTML = visible.length ? visible.map(cardHTML).join('') : `<div class="empty-state">${icon('folder', 37)}<h3>${state.search ? 'No matching documents' : 'Nothing here yet'}</h3><p>${state.search ? 'Try a different search term.' : 'Create a document or ask someone to share one with you.'}</p>${state.filter !== 'shared' && !state.search ? '<button class="btn btn-primary" id="empty-create">Create document</button>' : ''}</div>`;
  $$('[data-open]', gallery).forEach(el => el.onclick = () => go(`/documents/${encodeURIComponent(el.dataset.open)}`));
  if ($('#empty-create')) $('#empty-create').onclick = createDocument;
  $('#results-count').textContent = `${visible.length} document${visible.length === 1 ? '' : 's'}`;
}
async function renderDashboard() {
  renderLoading();
  try { await loadDocuments(); } catch (err) { notify(err.message, true); if (err.status === 401) { state.user = null; renderLogin(); } return; }
  const owned = state.documents.filter(d => d.permission === 'owner').length;
  const shared = state.documents.length - owned;
  const firstName = state.user.name.split(' ')[0];
  const title = state.filter === 'owner' ? 'My documents' : state.filter === 'shared' ? 'Shared with me' : 'Your documents';
  app.innerHTML = `<div class="app-shell">${sidebar(state.filter)}<main class="main-area"><header class="main-top"><div class="crumb">Workspace <span>/</span> ${title}</div><div class="top-actions"><span class="demo-pill"><span class="green-dot"></span> Demo workspace</span><span class="avatar mini ${state.user.id === 'alex' ? 'purple' : 'coral'}">${escapeHTML(initials(state.user.name))}</span></div></header>
    <div class="dashboard-body"><div class="hello"><div><span class="eyebrow">YOUR CREATIVE SPACE</span><h1>Welcome back, ${escapeHTML(firstName)} <span class="wave">✳</span></h1><p>Every great idea starts with a blank page. What will you make today?</p></div></div>
    <div class="stats-row"><div class="stat"><span class="stat-icon violet">${icon('doc', 20)}</span><div><strong>${state.documents.length}</strong><span>Total documents</span></div></div><div class="stat"><span class="stat-icon blue">${icon('folder', 20)}</span><div><strong>${owned}</strong><span>Owned by you</span></div></div><div class="stat"><span class="stat-icon pink">${icon('users', 20)}</span><div><strong>${shared}</strong><span>Shared with you</span></div></div></div>
    <div class="section-header"><div><h2>${escapeHTML(title)}</h2><p>Your thoughts, plans, and everything in between.</p></div><div class="section-actions"><button class="btn btn-soft" id="import-button">${icon('upload', 17)} Import .txt</button><button class="btn btn-primary" id="create-button">${icon('plus', 18)} New document</button></div></div>
    <div class="gallery-toolbar"><div class="searchbox">${icon('search', 18)}<input id="doc-search" placeholder="Search your documents..." aria-label="Search documents" value="${escapeHTML(state.search)}" /></div><span id="results-count"></span></div>
    <div class="document-gallery" id="doc-gallery"></div><div class="dash-foot">Thoughtfully simple. Built to keep ideas moving. <span>✳</span></div>
    </div></main></div><input type="file" id="file-input" accept=".txt,text/plain" hidden />`;
  wireSidebar();
  $('#create-button').onclick = createDocument;
  $('#import-button').onclick = () => $('#file-input').click();
  $('#file-input').onchange = handleImport;
  $('#doc-search').oninput = (e) => { state.search = e.target.value; updateGallery(); };
  updateGallery();
}
async function createDocument(content, title = 'Untitled document') {
  try { const { id } = await api('/documents', { method: 'POST', body: jsonBody({ title: typeof title === 'string' ? title : 'Untitled document', content: content && content.type === 'doc' ? content : EMPTY() }) }); go(`/documents/${encodeURIComponent(id)}`); }
  catch (err) { notify(err.message, true); }
}
async function handleImport(e) {
  const file = e.target.files[0]; e.target.value = '';
  if (!file) return;
  if (!file.name.toLowerCase().endsWith('.txt')) return notify('Only .txt files are supported.', true);
  if (file.size > 200 * 1024) return notify('Please choose a text file under 200 KB.', true);
  try {
    const text = (await file.text()).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    const paragraphs = text.split(/\n/).slice(0, 2500).map(line => ({ type: 'p', children: line ? [{ type: 'text', value: line.slice(0, 30000) }] : [] }));
    const content = { type: 'doc', children: paragraphs };
    const title = file.name.replace(/\.txt$/i, '').trim().slice(0,100) || 'Imported document';
    await createDocument(content, title);
    notify('Text file imported as an editable document.');
  } catch (err) { notify(err.message, true); }
}

const NODES = { p: 'p', h1: 'h1', h2: 'h2', ul: 'ul', ol: 'ol', li: 'li', strong: 'strong', em: 'em', u: 'u', br: 'br' };
function domFromContent(node) {
  if (node.type === 'text') return document.createTextNode(node.value ?? '');
  const el = document.createElement(node.type === 'doc' ? 'div' : (NODES[node.type] ?? 'span'));
  for (const child of node.children ?? []) el.appendChild(domFromContent(child));
  return el;
}
function nodesFromDOM(domNode) {
  if (domNode.nodeType === Node.TEXT_NODE) return [{ type: 'text', value: domNode.textContent || '' }];
  if (domNode.nodeType !== Node.ELEMENT_NODE) return [];
  const tag = domNode.tagName.toLowerCase();
  const type = ({ div: 'p', p: 'p', h1: 'h1', h2: 'h2', h3: 'h2', ul: 'ul', ol: 'ol', li: 'li', b: 'strong', strong: 'strong', i: 'em', em: 'em', u: 'u', br: 'br' })[tag];
  const children = [...domNode.childNodes].flatMap(nodesFromDOM);
  if (!type) return children;
  if (type === 'br') return [{ type: 'br' }];
  return [{ type, children }];
}
function serializeEditor(el) {
  const children = [...el.childNodes].flatMap(nodesFromDOM);
  return { type: 'doc', children: children.length ? children : [{ type: 'p', children: [] }] };
}
function updateWordCount() {
  const content = $('#editor-content');
  if (!content) return;
  const str = (content.innerText || '').trim();
  $('#word-count').textContent = `${str ? str.split(/\s+/).length : 0} words`;
}
function saveStatus(text, extraClass = '') {
  const el = $('#save-indicator');
  if (el) { el.className = `save-status ${extraClass}`; el.innerHTML = (extraClass === 'status-error' ? icon('alert', 15) : icon('cloud', 16)) + escapeHTML(text); }
}
function scheduleSave() {
  if (!state.current || state.current.permission === 'view' || state.blocked) return;
  state.dirty++;
  saveStatus('Unsaved changes', 'status-dirty');
  clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(flushSave, 900);
}
async function flushSave() {
  clearTimeout(state.saveTimer);
  if (!state.current || state.current.permission === 'view' || state.blocked || state.dirty === state.saved) return;
  if (state.saving) { await state.inflight; if (!state.blocked && state.dirty > state.saved) return flushSave(); return; }
  const current = state.current;
  const capturedSeq = state.dirty;
  const title = ($('#doc-title')?.value || '').trim() || 'Untitled document';
  const content = serializeEditor($('#editor-content'));
  state.saving = true;
  saveStatus('Saving...');
  try {
    state.inflight = api(`/documents/${encodeURIComponent(current.id)}`, { method: 'PATCH', body: jsonBody({ title, content, expectedVersion: current.version }) });
    const data = await state.inflight;
    if (state.current?.id !== current.id) return;
    current.version = data.version; current.title = title; current.content = content; current.updated_at = data.updated_at;
    state.saved = capturedSeq;
    if (state.saved === state.dirty) saveStatus('All changes saved', 'status-saved');
    else saveStatus('Finishing up...', 'status-dirty');
  } catch (err) {
    if (state.current?.id !== current.id) return;
    state.blocked = true;
    saveStatus(err.code === 'VERSION_CONFLICT' ? 'Edit conflict' : 'Save failed', 'status-error');
    showConflict(err);
  } finally {
    state.saving = false; state.inflight = null;
    if (!state.blocked && state.current?.id === current.id && state.saved < state.dirty) state.saveTimer = setTimeout(flushSave, 200);
  }
}
function showConflict(err) {
  let banner = $('#error-banner');
  if (!banner) { banner = document.createElement('div'); banner.id = 'error-banner'; banner.className = 'error-banner'; $('.editor-main').prepend(banner); }
  banner.innerHTML = `${icon('alert', 20)} <span><strong>${err.code === 'VERSION_CONFLICT' ? 'Someone changed this document.' : 'We couldn’t save your changes.'}</strong><small>Your current text is still here. Copy it before reloading if you want to keep it.</small></span><button class="btn btn-soft" id="copy-unsaved">Copy text</button><button class="btn btn-soft" id="reload-doc">Reload latest</button>`;
  $('#copy-unsaved').onclick = async () => { try { await navigator.clipboard.writeText($('#editor-content').innerText); notify('Document text copied.'); } catch { notify('Copy failed. Select the document text manually.', true); } };
  $('#reload-doc').onclick = () => loadEditor(state.current.id);
}
function editorToolbar(readOnly) {
  const disabled = readOnly ? 'disabled title="View-only document"' : '';
  const tool = (cmd, symbol, label, extra = '') => `<button type="button" class="toolbar-btn ${extra}" data-command="${cmd}" aria-label="${label}" title="${label}" ${disabled}>${symbol}</button>`;
  return `<div class="toolbar"><div class="toolbar-left"><span class="tool-label">FORMAT</span>
    ${tool('bold','<strong>B</strong>','Bold (Ctrl+B)')}${tool('italic','<em>I</em>','Italic (Ctrl+I)')}${tool('underline','<u>U</u>','Underline (Ctrl+U)')}
    <span class="toolbar-separator"></span>${tool('formatBlock:p','<span class="tool-text">Normal</span>','Normal text','normal-tool')}${tool('formatBlock:h1','<span class="tool-text">H1</span>','Heading 1')}${tool('formatBlock:h2','<span class="tool-text">H2</span>','Heading 2')}
    <span class="toolbar-separator"></span>${tool('insertUnorderedList',icon('bullet',19),'Bulleted list')}${tool('insertOrderedList',icon('numbered',19),'Numbered list')}
    <span class="toolbar-separator"></span>${tool('undo',icon('undo',18),'Undo')}${tool('redo',icon('redo',18),'Redo')}
    </div><span class="toolbar-hint">${readOnly ? 'Viewing only' : 'Changes saved automatically'}</span></div>`;
}
async function loadEditor(id) {
  renderLoading();
  state.blocked = false; state.dirty = 0; state.saved = 0; state.saving = false; state.inflight = null; clearTimeout(state.saveTimer);
  try {
    const { document: doc } = await api(`/documents/${encodeURIComponent(id)}`);
    state.current = doc;
    const readOnly = doc.permission === 'view';
    app.innerHTML = `<div class="editor-shell"><header class="editor-header"><div class="editor-head-left"><button class="back-button" id="editor-back" aria-label="Back to documents">${icon('arrow', 20)}</button><span class="editor-app-logo">${logo}</span><span class="editor-breadcrumb">Workspace <span>/</span> ${doc.permission === 'owner' ? 'My documents' : 'Shared with me'}</span></div>
      <div class="editor-actions"><span class="save-status status-saved" id="save-indicator">${icon('cloud', 16)} ${readOnly ? 'View-only access' : 'All changes saved'}</span>
      ${doc.permission === 'owner' ? `<button class="btn btn-light icon-button" id="delete-doc" title="Delete document" aria-label="Delete document">${icon('trash', 17)}</button>` : ''}
      <button class="btn btn-light" id="share-button">${icon('users', 17)} Share</button><span class="avatar mini ${state.user.id === 'alex' ? 'purple' : 'coral'}" title="${escapeHTML(state.user.name)}">${escapeHTML(initials(state.user.name))}</span></div></header>
      ${editorToolbar(readOnly)}<main class="editor-main"><div class="document-meta"><span class="doc-type-label">${icon('doc', 15)} DOCUMENT</span><span class="doc-last-edit">${icon('clock', 14)} Last edited ${timeAgo(doc.updated_at)}</span></div>
      <div class="document-paper"><input type="text" class="doc-title" id="doc-title" maxlength="100" aria-label="Document title" value="${escapeHTML(doc.title)}" ${readOnly ? 'readonly' : ''} spellcheck="false" />
        <div class="paper-divider"></div><div id="editor-content" class="editor-content" contenteditable="${!readOnly}" role="textbox" aria-label="Document content" aria-multiline="true" data-placeholder="Start writing something wonderful..."></div></div>
      <div class="editor-foot"><span>${icon('lock', 14)} ${readOnly ? `Shared by ${escapeHTML(doc.owner_name)} · View only` : doc.permission === 'owner' ? 'Only people you invite have access' : `Shared by ${escapeHTML(doc.owner_name)} · Can edit`}</span><span id="word-count">0 words</span></div></main></div>`;
    const content = $('#editor-content');
    const rendered = domFromContent(doc.content);
    content.replaceChildren(...rendered.childNodes);
    updateWordCount();
    if (!readOnly) {
      content.addEventListener('input', () => { updateWordCount(); scheduleSave(); });
      content.addEventListener('paste', (e) => {
        e.preventDefault();
        const text = e.clipboardData?.getData('text/plain') || '';
        document.execCommand('insertText', false, text);
      });
      $('#doc-title').addEventListener('input', scheduleSave);
      $('#doc-title').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); } });
      $('#doc-title').addEventListener('blur', () => { if (!$('#doc-title').value.trim()) $('#doc-title').value = 'Untitled document'; flushSave(); });
      $$('.toolbar-btn').forEach(b => {
        b.addEventListener('mousedown', e => e.preventDefault());
        b.addEventListener('click', () => {
          content.focus();
          const [cmd, arg] = b.dataset.command.split(':');
          document.execCommand('styleWithCSS', false, false);
          document.execCommand(cmd, false, arg ? `<${arg}>` : undefined);
          updateWordCount(); scheduleSave();
        });
      });
    }
    $('#editor-back').onclick = async () => { await flushSave(); if (state.blocked) return notify('Resolve the unsaved changes before leaving.', true); state.current = null; go('/'); };
    $('#share-button').onclick = () => showShare(doc);
    if ($('#delete-doc')) $('#delete-doc').onclick = async () => {
      if (!confirm(`Move "${doc.title}" to permanent deletion? This cannot be undone.`)) return;
      try { await api(`/documents/${encodeURIComponent(doc.id)}`, { method: 'DELETE' }); state.current = null; go('/'); notify('Document deleted.'); }
      catch (err) { notify(err.message, true); }
    };
  } catch (err) {
    notify(err.message, true);
    state.current = null;
    if (err.status === 401) { state.user = null; renderLogin(); }
    else go('/');
  }
}
async function showShare(doc) {
  try {
    const [{ shares }, { users }] = await Promise.all([api(`/documents/${encodeURIComponent(doc.id)}/shares`), api('/users')]);
    let old = $('#modal-overlay'); if (old) old.remove();
    const isOwner = doc.permission === 'owner';
    const available = users.filter(u => u.id !== state.user.id);
    const overlay = document.createElement('div'); overlay.id = 'modal-overlay'; overlay.className = 'modal-overlay';
    overlay.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="share-title"><div class="modal-head"><div class="modal-icon">${icon('users', 21)}</div><button class="close-button" id="close-share" aria-label="Close">${icon('x', 20)}</button></div>
      <h2 id="share-title">Share this document</h2><p class="modal-sub">${escapeHTML(doc.title)}</p>
      ${isOwner ? `<form id="share-form"><label class="field-label" for="invite-email">Invite a collaborator</label><div class="invite-row"><input class="input-field" id="invite-email" list="collaborator-list" type="email" placeholder="Email address" required /><datalist id="collaborator-list">${available.map(u => `<option value="${escapeHTML(u.email)}">${escapeHTML(u.name)}</option>`).join('')}</datalist><select id="invite-role" aria-label="Permission"><option value="edit">Can edit</option><option value="view">Can view</option></select></div><button class="btn btn-primary btn-full" type="submit" id="invite-button">${icon('plus', 17)} Grant access</button></form>` : `<div class="shared-note">${icon('lock', 17)} Only the document owner can change access.</div>`}
      <div class="modal-subhead">PEOPLE WITH ACCESS</div><div class="people-list" id="people-list"></div><div class="modal-footer">${icon('lock', 15)} Only invited demo users can open this document.</div></div>`;
    document.body.appendChild(overlay);
    const close = () => { overlay.remove(); document.removeEventListener('keydown', esc); };
    $('#close-share').onclick = close;
    overlay.onclick = e => { if (e.target === overlay) close(); };
    const esc = e => { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); } };
    document.addEventListener('keydown', esc);
    function drawPeople() {
      const people = [{ id: doc.owner_id, name: doc.owner_name, email: doc.owner_id === state.user.id ? state.user.email : (doc.owner_id === 'alex' ? 'alex@relaydemo.app' : 'jordan@relaydemo.app'), permission: 'owner' }, ...shares];
      $('#people-list').innerHTML = people.map(person => `<div class="person"><span class="avatar ${person.id === 'alex' ? 'purple' : 'coral'}">${escapeHTML(initials(person.name))}</span><div><strong>${escapeHTML(person.name)} ${person.id === state.user.id ? '(you)' : ''}</strong><small>${escapeHTML(person.email)}</small></div><div class="person-role">${person.permission === 'owner' ? 'Owner' : person.permission === 'edit' ? 'Can edit' : 'Can view'}</div>${isOwner && person.permission !== 'owner' ? `<button class="remove-access" data-remove="${escapeHTML(person.id)}" aria-label="Remove ${escapeHTML(person.name)}">${icon('x', 15)}</button>` : ''}</div>`).join('');
      $$('[data-remove]', $('#people-list')).forEach(btn => btn.onclick = async () => {
        try { await api(`/documents/${encodeURIComponent(doc.id)}/shares/${encodeURIComponent(btn.dataset.remove)}`, { method: 'DELETE' });
          shares.splice(shares.findIndex(s => s.id === btn.dataset.remove), 1); drawPeople(); notify('Access removed.'); }
        catch (err) { notify(err.message, true); }
      });
    }
    drawPeople();
    if (isOwner) $('#share-form').onsubmit = async e => {
      e.preventDefault(); const button = $('#invite-button'); button.disabled = true;
      try { const { share } = await api(`/documents/${encodeURIComponent(doc.id)}/shares`, { method: 'POST', body: jsonBody({ email: $('#invite-email').value, permission: $('#invite-role').value }) });
        const idx = shares.findIndex(s => s.id === share.id); if (idx >= 0) shares[idx] = share; else shares.push(share);
        drawPeople(); $('#invite-email').value = ''; notify('Document access updated.'); }
      catch (err) { notify(err.message, true); }
      finally { button.disabled = false; }
    };
    $('#close-share').focus();
  } catch (err) { notify(err.message, true); }
}

async function route() {
  const match = location.pathname.match(/^\/documents\/([a-zA-Z0-9-]+)$/);
  if (!state.user) {
    try { const { user } = await api('/me'); state.user = user; }
    catch { state.user = null; renderLogin(); return; }
  }
  if (match) await loadEditor(match[1]); else await renderDashboard();
}
window.addEventListener('popstate', route);
window.addEventListener('beforeunload', (e) => { if (state.dirty !== state.saved && state.current) { e.preventDefault(); } });
route();
