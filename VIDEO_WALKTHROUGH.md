# Walkthrough recording plan (target: 4 minutes)

Record the actual working product in your browser, ideally with your own voice and camera optional. Keep the video natural: explain the why, not every pixel. Use an unlisted/public Loom, YouTube, or Google Drive link that reviewers can open without requesting access.

## 0:00–0:25 — The problem and scope

"Hi, I'm presenting Relay Docs, a small collaborative writing workspace built for the Ajaia product-engineering exercise. I focused on a complete create–edit–share workflow rather than trying to recreate the entire Google Docs surface."

Show the login screen and choose Alex.

## 0:25–1:35 — Core document experience

Show dashboard owned/shared states. Create a document, rename it, type a paragraph, apply a heading, bold text, and a bullet list. Pause until **All changes saved** appears. Refresh to show persistence, not just local draft state.

Suggested line: "The document saves automatically after a short idle period. I store a small structured rich-text tree rather than raw HTML, so formatting survives refresh and the server can validate what it accepts."

## 1:35–2:05 — Import

Return to the dashboard. Use **Import .txt** and select `examples/team-meeting-notes.txt`. Show the new editable document.

"I deliberately limited import to text files up to 200 KB. This creates a useful working path without taking on the complexity of arbitrary DOCX conversion or attachment storage."

## 2:05–3:05 — Share across accounts

From Alex, share the imported document with `jordan@relaydemo.app`, choose **Can edit**. Sign out, choose Jordan, navigate to **Shared with me** and open the document. Make a change and wait for saved status. Switch back to Alex and confirm the change exists. Then open Jordan's **Design handoff checklist** as Alex and show that its editor is view-only.

"The roles are enforced by the backend, not just by disabled buttons. Only the owner can manage shares."

## 3:05–3:40 — Engineering choices and tests

Show the source tree and a terminal with `npm test`. Mention SQLite, HttpOnly sessions, owner/editor/viewer access, and stale-version saves returning 409 instead of silently overwriting. Point to `ARCHITECTURE.md`.

## 3:40–4:10 — Cuts, AI, and what's next

"I didn't build live cursors, comments, or full DOCX support. Those would have diluted the reliability of the core flow. I used ChatGPT to accelerate the scaffold, UI, and test drafts, then changed direction to a dependency-free Node implementation when the initial framework route couldn't be verified locally. I ran six backend tests and reviewed the rendered UI. With more time, I'd replace the native rich-text engine with TipTap and add end-to-end browser tests and revision history."

End on the dashboard. Keep it conversational; do not read a checklist in a robotic voice.

## Before you upload

- Record in the **actual deployed product**, not browser fixture previews.
- Confirm the recorded URL opens in an incognito browser.
- Capture tests passing or briefly display the test result.
- Show the public URL on-screen and do not expose any private credentials beyond intentionally seeded demo accounts.
- Paste the public link into `video-url.txt`, `SUBMISSION.md`, and the application form's required **Video Submission Link** field.
