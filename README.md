# Relay Docs

**A calm, lightweight document workspace for shared work.**

Relay Docs is a focused full-stack product-engineering exercise: create and edit rich-text documents, import a text file, and collaborate using invite-only edit or view permissions. It is intentionally *not* a Google Docs clone.

> **Deployment status:** This source package runs locally. The public deployment link must be added after the project is deployed to a host you control. See **Deployment** below. The placeholder URL is not a working deployment.

## Quick start

**Requirements:** Node.js **22.13+** (tested with Node 22.16.0). No third-party runtime packages, paid services, environment variables, or external databases are needed locally. The built-in `node:sqlite` API is currently marked experimental in Node 22; Node may print a warning on startup.

```bash
# Inside the relay-docs directory
npm start
```

Open **http://localhost:3000**.

Alternatively:

```bash
npm run dev          # automatic server restart on code changes
npm test             # integration + unit tests
npm run check        # syntax checks and the test suite
```

The SQLite database is created automatically at `./data/relay.sqlite`, including two seeded users, three documents, and two existing shares. To reset the demonstration, stop the server and remove the `data/` directory, then start it again. **Do not do this with valuable data.**

## Reviewer accounts

| Demo account | Email | Password | Example access |
| --- | --- | --- | --- |
| Alex Morgan | `alex@relaydemo.app` | `Paperplane!26` | Owns Product launch notes and Ideas worth exploring; can view Jordan's handoff |
| Jordan Lee | `jordan@relaydemo.app` | `Paperplane!26` | Can edit Alex's Product launch notes; owns Design handoff checklist |

The login screen offers one-click selection of either account. To review access controls, sign in as Alex, open a document and use **Share**, then sign out from the profile button on the dashboard and sign in as Jordan.

**These are intentionally public demo credentials. Do not use real information or sensitive documents.** User signup, password resets, and organization management are out of scope.

## What works

- Create, rename, edit, delete (owner only), and reopen documents.
- Format text using **bold, italic, underline, H1/H2 headings, bullets, and numbered lists**. Native keyboard shortcuts such as Ctrl/Cmd+B and undo/redo work via the browser's editing engine.
- Autosave with visible save status (~900 ms after editing) and refresh persistence.
- File import: **`.txt` only, up to 200 KB**. Each line becomes an editable paragraph; all content is saved as a new document. This is deliberately **not** a `.docx` or full Markdown importer. A sample file is included under `examples/`.
- Two password-authenticated seeded accounts, backed by HttpOnly session cookies.
- Owner-controlled sharing with **Can edit** and **Can view** permissions for existing demo accounts. Owners can update or remove a share.
- Owned versus shared document categories and search.
- Access enforcement on the server, input limits, and a `409` version-conflict response instead of silently overwriting another save.
- Six automated tests covering auth, content restrictions, sharing, persistence, and optimistic concurrency.

## Fast evaluation path (2–3 minutes)

1. Sign in as **Alex**, create a new document and type text. Use **Bold**, **H1**, and **Bullets**, then wait until the header says **All changes saved**. Refresh and confirm it reopens with formatting.
2. Return to the dashboard, click **Import .txt** and choose `examples/team-meeting-notes.txt`.
3. Open the new document, click **Share**, invite `jordan@relaydemo.app` as **Can edit**.
4. Return to the dashboard, sign out, and sign in as **Jordan**. Open **Shared with me**, find Alex's document and edit it.
5. While signed in as Jordan, open **Design handoff checklist** (owned) or sign back in as Alex and open the shared handoff: Alex sees the editor in **view-only** mode and cannot save edits.

## Tech and data model

- **Frontend:** responsive HTML/CSS and browser JavaScript; `contenteditable` rich-text editing.
- **Backend:** native Node.js HTTP server and built-in crypto.
- **Database:** native SQLite via Node `node:sqlite`, using WAL and foreign-key enforcement.
- **Storage:** one documents table with structured content JSON, a users table, a sessions table, and an explicit sharing join table.
- **Access model:** `owner`, `edit`, `view`, or no access. Permission checked for every document request.
- **Rich-text format:** a small allowed JSON tree (paragraphs, H1/H2, lists, bold/italic/underline, and plain text). The server rejects unknown node types and oversized content. Browser rendering uses DOM APIs and text nodes rather than injecting saved HTML.

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for decisions and tradeoffs, and [`AI_WORKFLOW.md`](./AI_WORKFLOW.md) for the AI workflow note.

## Deployment

**Recommended for a real review:** any Node 22+ host with a **persistent filesystem/volume**. SQLite is a single-instance file database; the app must run as **one process** against one filesystem. Configure `DATA_DIR` to the mounted persistent directory (e.g. `/var/data/relay-docs`). Start with `npm start`, expose `PORT` (defaults to 3000), and set a health check at `/api/health`.

### Render steps (simple public URL)

1. Push this folder to a GitHub repository.
2. In [Render](https://render.com/), create a new **Web Service** pointing at the repo (or import the provided `render.yaml` Blueprint).
3. Choose Node runtime and **Node 22.16.0 or later**, build command `npm install`, start command `npm start`, health check `/api/health`.
4. **For persistent data across deployments/restarts**, choose a service tier supporting persistent disks, mount one at `/var/data/relay-docs`, and set the environment variable `DATA_DIR=/var/data/relay-docs`. A persistent disk may cost money for the developer. **Reviewers do not need any paid account.**
5. Deploy and open the assigned `https://<service-name>.onrender.com` URL. Test the two seeded users and a refresh before publishing the link.

**Important free-tier limitation:** Render's free web service can run the demo, but its filesystem is *ephemeral*. SQLite data can be lost on a restart, spin-down, or redeploy. Thus, free-tier hosting **does not fulfill durable cloud persistence**, despite working browser refreshes during the same service lifetime. Do not describe free Render hosting as durable. For a robust submission use a persistent disk host or switch to a managed database. See [Render's documentation](https://render.com/docs/free).

This package intentionally does **not** claim to already be live. Add the real public URL to `live-url.txt` and `SUBMISSION.md` after deployment.

## Testing

```bash
npm test
```

The test suite uses Node's built-in test runner and disposable SQLite files, so no test database or dependencies need installation. Tests cover authentication, permission boundaries, share updates and revocation, formatted JSON persistence, stale-version rejection, and persistence after an application restart.

The UI previews in `screenshots/` render the actual browser components against seeded fixture responses. They are **illustrative UI previews**, not evidence of a live hosted deployment. Replace or supplement them with real screenshots when you deploy.

## Known limitations and next steps

**Deliberate cuts:** no live cursors or operational-transform/CRDT collaboration; no comments; no public share-by-link; no `.docx` import; no image attachment upload; no password reset or arbitrary user signup; no version history; no mobile-native editing features. The rich-text toolbar relies on browser `contenteditable`/`execCommand` behavior, which is convenient for this timebox but deprecated; editing consistency across all browsers is not guaranteed.

**If given another 2–4 hours:** migrate editing to TipTap/ProseMirror for better selection, normalization, clipboard handling, and automated browser coverage; add a persistent managed DB integration and end-to-end smoke tests; then implement a simple revision history rather than attempting full real-time co-authoring.

## Project structure

```text
relay-docs/
├── server/
│   ├── index.mjs        # HTTP routes, sessions, access checks, validation
│   ├── database.mjs     # schema, SQLite access, seed data
│   └── content.mjs      # allowed rich-text schema and permission functions
├── public/
│   ├── index.html       # app entry
│   ├── app.js           # dashboard, editor, import, sharing, autosave
│   ├── styles.css       # responsive product UI
│   └── favicon.svg
├── tests/api.test.mjs  # permission, auth, persistence, concurrency tests
├── screenshots/        # fixture-rendered UI previews
├── examples/           # sample import file
├── ARCHITECTURE.md
├── AI_WORKFLOW.md
├── SUBMISSION.md
├── video-url.txt
├── live-url.txt
└── render.yaml
```

## License / purpose

Built exclusively as a demonstration assignment. No reviewer-paid dependencies.
