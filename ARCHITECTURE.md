# Architecture and Product Decisions

## Product slice

The user story driving the implementation was: **"I can create a document, format it, and invite a teammate who can either edit it or just read it—and neither of us loses our work when we refresh."**

I made the dashboard, editor, and share dialog the primary surfaces rather than starting with collaboration indicators or an elaborate account system. The workspace starts with three realistic documents and two demo users, so the sharing behavior is testable in minutes without signup or configuration.

## Core components

```text
Browser (dashboard / editor / share modal)
              |
           JSON API
              |
 Node HTTP server (session + validation + permissions)
              |
          SQLite file
     | users | documents |
     | sessions | shares |
```

- The browser holds transient editor state; SQLite is the source of truth.
- Each document stores an **allowlisted rich-text JSON tree**, title, owner ID, preview, timestamps, and integer version. Server-side JSON validation rejects unknown nodes and oversized payloads. Rendering rebuilds DOM elements and text nodes instead of interpolating stored HTML.
- `shares(document_id, user_id, permission)` models explicit per-user access. `owner` is derived from `documents.owner_id`, rather than represented as a removable share.
- Passwords use salted PBKDF2-HMAC-SHA256; sessions use random bearer tokens stored **hashed** in SQLite and delivered in an `HttpOnly; SameSite=Lax` cookie (Secure on HTTPS). Access checks are server-enforced, not just hidden UI buttons.

## Save and concurrency model

Editing marks the local draft dirty and schedules an API save after ~900 ms. Save requests include `expectedVersion`. The database atomically increments the version only when it matches the stored one. A stale save returns HTTP **409** rather than overwriting someone else's edits. The editor leaves the draft visible with options to copy its text or reload.

This is intentionally **not live collaboration**. Two editors can make changes independently, but the second stale save is rejected rather than merged. That is a safer, teachable constraint for the scope.

## File handling

Chosen scope: `.txt`, max 200 KB. On import, the browser reads a local text file and turns each line into an editable paragraph in a new document; the server applies the same JSON schema validation and 350 KB payload limit as for normal saves. The backend does not need object storage, malware scanning, or format-conversion services for this slice.

## What I prioritized

| Priority | Decision | Why |
|---|---|---|
| P0 | Create/edit/reopen + autosave | The core experience must feel real and reliable |
| P0 | Seeded accounts and owner/editor/viewer access | Sharing must work end to end, not just be a dialog |
| P0 | SQLite persistence + meaningful automated tests | Verify actual backend behavior, not only local browser state |
| P1 | Text import, search, graceful empty/error states | Covers the document workflow and usability |
| P1 | Responsive visual polish | Helps reviewers test quickly and understand the hierarchy |
| Cut | Live cursors, comments, presence, public links | High complexity relative to the value of proving the core workflow |

## Timebox-driven engineering tradeoffs

- **Minimal dependencies:** Node's built-in HTTP, crypto, tests, and SQLite and the browser's native editor allow `npm start` with no library installation. This reduces setup time and fragility; it is not the stack I would automatically choose for a mature multi-team production app.
- **Native rich-text:** `contenteditable` and `execCommand` are adequate for this small set of formatting tools, but deprecated and less predictable across browsers. I would introduce TipTap/ProseMirror as the next engineering iteration.
- **Simple sessions:** seeded users are sufficient for demonstration, but public demo credentials, no signup/reset/MFA, and a single-node login-rate-limit map make this inappropriate for confidential production documents.
- **SQLite:** excellent for a one-instance local app, but hosting needs persistent storage and cannot run with multiple independent replicas against the same file. Free ephemeral deployments cannot truthfully guarantee persistence across restarts.
- **No CRDT:** optimistic conflict detection prevents silent overwrites but does not automatically merge concurrent changes.

## Correctness, reliability and UX

The tests exercise real HTTP endpoints against temporary SQLite databases: login and logout, owner-only sharing, invited-user permissions, revocation, view-only enforcement, rich-text persistence, version conflicts, and application restart persistence. The app also handles invalid JSON, oversized bodies, invalid titles, missing users, 401/403/404/409 responses, and access loss. CSS/DOM previews were checked in a browser using fixture API responses; a full deployed end-to-end browser run still needs to be performed after hosting.

## With 2–4 more hours

1. Add Playwright end-to-end flows against a running backend, including paste, formatting, reload, import, and two-user permission switching.
2. Move editing to a schema-first library such as ProseMirror or TipTap and improve focus/selection and clipboard edge cases.
3. Deploy on a durable disk or hosted database and add per-document revision snapshots (simpler and more immediately useful than attempting real-time coediting).
