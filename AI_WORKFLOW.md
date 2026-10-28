# AI Workflow Note

## Tools used

I used **ChatGPT** as a coding assistant for implementation scaffolding, front-end styling, API route implementation, test generation, and draft documentation. The result is an AI-assisted implementation rather than a claim that all code was manually typed. The application uses **no AI API at runtime** and reviewers do not need an AI account.

## Where AI materially helped

AI made it faster to move from a broad prompt to a complete, testable product slice: a UI, SQLite schema, role-based access API, seeded demo users, error-state handling, and automated tests. It was especially useful for turning the sharing requirements into explicit test cases for owner, editor, viewer, revocation, and stale saves.

## Output changed or rejected

The initial approach used a framework-heavy React/Cloudflare-style scaffold. Package installation was unavailable in the build environment, so that approach was **discarded**, not silently treated as complete. The implementation was rebuilt with Node 22 built-ins and vanilla browser JavaScript so the code could actually be executed and tested locally without external dependencies. Real-time collaboration, full Markdown/Docx import, and an overly broad feature set were intentionally rejected in favor of validated core flows.

## How correctness was checked

- Ran syntax checks on the API and browser client.
- Ran **six automated tests** against real HTTP handlers and disposable SQLite databases; all passed in the provided local environment.
- Checked persistence after process restart, session handling, permission boundaries, grant/revoke flows, rich-text schema validation, and version conflicts.
- Rendered dashboard/editor/share UI screens in Chromium using representative seeded fixture responses, checked for browser JavaScript errors, and visually inspected the previews.

## What still needs my personal verification before submission

The person submitting this should **personally use the live deployment** to test create/edit/reload, formatting, `.txt` import, and the Alex/Jordan sharing path, then record the walkthrough in their own words. The hosted link and video should not be described as finished until they exist. Browser preview images are not a substitute for live-host verification.

## Ownership and judgment

The meaningful engineering decisions are the scope boundaries, strict per-user access checks, JSON rather than raw HTML persistence, optimistic concurrency, and a deliberate honesty about hosting tradeoffs. AI accelerated drafting; passing tests and clearly documented limitations are what make the result reviewable.
