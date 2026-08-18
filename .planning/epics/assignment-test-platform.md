# Epic: Assignment Test Platform

**Created**: 2026-08-18
**Status**: planning
**Owner**: Shivansh

---

## Why

Build a secure, server-authoritative test-taking platform to administer timed reasoning tests to candidates. Replaces ad-hoc/manual testing with a proper server-controlled timer, anti-cheat question delivery, an admin-approved extension flow, and full result history — starting with one candidate group, designed to scale to more.

---

## Success Criteria

- [ ] Admin can upload a question bank (any of: plain MCQ, shared-passage sets, image/diagram questions, multi-correct) and issue login credentials to candidates
- [ ] Candidate can log in and take a test with a server-authoritative timer that survives disconnects/power cuts, can request a time extension, and can only navigate to previously-seen questions (never ahead)
- [ ] Admin sees extension requests and can approve/deny with a custom time amount, hard-capped at 2 hours total test time
- [ ] Results are auto-graded but stay hidden from the candidate until the admin manually releases them
- [ ] Both candidate and admin can view full history: every past attempt, time spent per question, and correct/incorrect breakdown
- [ ] App runs in Docker on the homelab server, reachable at a new `*.shivanshmishra.in` subdomain via the existing Cloudflare tunnel

---

## Features

| # | Feature | Status | Spec | Plan | Depends On |
|---|---------|--------|------|------|------------|
| 1 | Foundations & Auth | planned | [foundations-and-auth.md](../specs/foundations-and-auth.md) | [foundations-and-auth.md](../plans/foundations-and-auth.md) | — |
| 2 | Question Bank & Authoring | todo | — | — | #1 |
| 3 | Test-Taking Engine | todo | — | — | #1, #2 |
| 4 | Extension Request & Approval Flow | todo | — | — | #3 |
| 5 | Admin Dashboard & Results Release | todo | — | — | #1, #2, #3, #4 |
| 6 | Candidate & Admin History/Analytics | todo | — | — | #3, #5 |
| 7 | Deployment (Homelab + Cloudflare Tunnel) | todo | — | — | #1-#6 |

---

## Feature Briefs

### Feature 1: Foundations & Auth
NestJS + Postgres project scaffold, schema baseline, admin auth, and candidate credential issuance (admin generates ID/password, no self-registration). JWT/session handling that everything else builds on.

### Feature 2: Question Bank & Authoring
Data model supporting all 4 question types (single MCQ, shared-passage groups, image/diagram-based, multi-correct). Admin upload UI, a reusable JSON/CSV template for future batches, and a one-time converter script for the ~100 existing questions.

### Feature 3: Test-Taking Engine
The core anti-cheat engine: server delivers one question at a time (never pre-bundled client-side), server-authoritative timer that pauses on disconnect and resumes correctly, candidates can revisit answered questions but never jump ahead, answer submission, and auto-grading.

### Feature 4: Extension Request & Approval Flow
Candidate can request more time when the clock runs out. Admin gets notified (real-time, likely via WebSocket) and approves/denies with a custom amount, enforced server-side against a hard 2-hour cap.

### Feature 5: Admin Dashboard & Results Release
Admin views all candidates and their tests, manages pending extension requests, and manually releases graded results per attempt.

### Feature 6: Candidate & Admin History/Analytics
Full past-attempt history for both roles — every test taken, time spent per question, and which answers were right/wrong. Read-only reporting on top of data captured in Feature 3.

### Feature 7: Deployment (Homelab + Cloudflare Tunnel)
Dockerize backend + Angular frontend + Postgres (docker-compose), add a new ingress hostname to the existing `progress-tracker` cloudflared tunnel config, and register the DNS route — following the same single-container-per-app pattern already used on `nuc-homelab`.

---

## Risks

- **Server-authoritative timer + disconnect/resume correctness** is the trickiest piece — needs a server-side `test_attempt` record (started_at, paused_at, granted_extensions) with remaining time always computed from server clock, never trusted from the client.
- **Real-time extension notifications** — WebSocket (NestJS Gateway) vs polling; WebSocket is more responsive but adds complexity. Decide in Feature 4's spec.
- **Anti-cheat "no jumping ahead"** requires strict server-side gating on every question fetch, while still allowing free navigation backward through already-seen questions.
- **Image-based questions** need a storage decision (local disk volume vs object storage) — decide in Feature 2's spec.
- **2-hour hard cap** must be enforced server-side regardless of what the admin approves.

---

## Notes

- Question content authoring runs in parallel with the build: user researches/collects questions (via Gemini/ChatGPT) using a template provided in Feature 2; app development is not blocked on question content.
- Backend: Node.js + NestJS + Postgres. Frontend: Angular. Both chosen for solo-dev speed and TypeScript consistency.
- Hosting: Docker on user's Ubuntu 24.04 homelab server (`nuc-homelab`, 8 cores/30GB RAM/936GB disk free), exposed via the already-active Cloudflare Tunnel `progress-tracker` by adding a new ingress entry — no new tunnel needed.
