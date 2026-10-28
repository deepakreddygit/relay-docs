# Relay Docs — Ajaia Full Stack Product Engineer Assignment

## Submission status

**Source and documentation:** Complete and locally tested.  
**Live deployment:** ⬜ ADD VERIFIED PUBLIC URL.  
**3–5 minute walkthrough:** ⬜ RECORD VIDEO AND ADD PUBLIC URL.  
**Google Drive folder:** ⬜ UPLOAD THESE FILES AND SHARE VIEWER ACCESS.

> Do not submit placeholder URLs. Run the full browser checklist in `README.md` on the public deployment first.

## Included files (exact inventory)

- `README.md` — project overview, test accounts, setup, run, verification, deployment and limitations.
- `ARCHITECTURE.md` — data model, access policy, concurrency, prioritization and scope cuts.
- `AI_WORKFLOW.md` — AI tools, accelerations, changed/rejected output, verification and caveats.
- `SUBMISSION.md` — this file, exact contents and missing externally produced items.
- `VIDEO_WALKTHROUGH.md` — a time-coded, natural 3–5 minute recording outline.
- `video-url.txt` — placeholder until the actual public video exists.
- `live-url.txt` — placeholder until a public deployment is verified.
- `package.json`, `package-lock.json` — zero-dependency Node project scripts and version requirement.
- `.env.example`, `.gitignore`, `.node-version`, `render.yaml` — local and hosted environment configuration.
- `server/index.mjs`, `server/database.mjs`, `server/content.mjs` — HTTP API, auth, data persistence and document schema.
- `public/index.html`, `public/app.js`, `public/styles.css`, `public/favicon.svg` — frontend application.
- `tests/api.test.mjs` — six automated tests.
- `examples/team-meeting-notes.txt` — sample import.
- `screenshots/login-preview.png`, `screenshots/dashboard-preview.png`, `screenshots/editor-preview.png`, `screenshots/sharing-preview.png` — browser-rendered UI previews using fixture API responses, **not** production deployment screenshots.
- `.github/workflows/ci.yml` — automated checks on GitHub pushes.

`data/`, `node_modules/`, and any local credentials are **excluded**.

## Links to fill before final submission

**Google Drive folder:** `[ADD LINK AFTER UPLOADING]`  
**Live product:** `[ADD LINK AFTER DEPLOYING]`  
**Walkthrough video:** `[ADD LINK AFTER RECORDING]`

## Reviewer credentials

| Person | Email | Password |
|---|---|---|
| Alex Morgan | `alex@relaydemo.app` | `Paperplane!26` |
| Jordan Lee | `jordan@relaydemo.app` | `Paperplane!26` |

## Known limitations

No live multi-user cursor synchronization, comments, public links, arbitrary signup, document version history, or `.docx` uploads. File import handles `.txt` up to 200 KB. Concurrent edits are protected with version-check conflicts, not automatically merged. Rich-text editing uses browser-native `contenteditable` and its deprecated `execCommand` API. On free Render hosting, SQLite persistence is not durable across process restarts; use persistent storage for a dependable hosted demo.

## If given another 2–4 hours

Add browser end-to-end tests, upgrade the editor engine to TipTap/ProseMirror, and persist a document revision history. Defer real-time CRDT coediting until the core editing behavior is robust.
