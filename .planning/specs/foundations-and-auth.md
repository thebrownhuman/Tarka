# Spec: Foundations & Auth

**Created**: 2026-08-18
**Status**: draft
**Author**: Shivansh
**Epic**: assignment-test-platform (Feature 1 of 7)

---

## Problem

There's currently no app at all — no project scaffold, no database, no way for anyone to log in. Every other feature (question bank, test-taking engine, extension flow, admin dashboard, history) needs a real user identity and a database to persist against. Without a secure, working auth layer first, nothing else can be built or tested safely.

---

## Goal

A running NestJS + Postgres + Angular skeleton where: the admin can log in, the admin can create a candidate account (issuing a login ID + password), and that candidate can log in, is forced to change their password on first login, and gets a role-scoped session that later features can build protected endpoints on top of.

---

## User Stories

- As the **admin**, I create a candidate account and get back a login ID + one-time password to hand to them (verbally/chat), so they can access the app without any self-registration flow.
- As a **candidate**, I log in with the ID/password I was given, am forced to set my own password on first login (since the issued one was likely shared out loud), and then get a normal session.
- As the **admin**, if a candidate loses their password, I can reset it and get a new one-time password to re-issue.

---

## Requirements

### Must-have
- NestJS project scaffold (modules, config, validation pipe, global exception filter) + Angular project scaffold, both TypeScript.
- Postgres connection, migration tooling, and a base schema (`users`, `refresh_tokens`).
- Password hashing (bcrypt or argon2 — never plaintext, never reversible).
- Login endpoint for both roles (single endpoint, role comes back in the response — there's no separate "admin login" vs "candidate login" screen distinction at the API level).
- Short-lived JWT access token + longer-lived refresh token, with refresh token rotation and revocation on logout.
- Role-based route guards (`admin` vs `candidate`) reusable by every later feature.
- Rate limiting on the login endpoint (brute-force protection — critical since candidates can't change their own login ID, and initial passwords may be simple/shared verbally).
- "Must change password on first login" flow: candidate cannot reach any other protected endpoint until they've changed the admin-issued password.
- Admin-only endpoints: create candidate (returns login ID + one-time password), reset a candidate's password (same, forces `must_change_password` again).
- `GET /auth/me` — returns the current session's role, display name, and `must_change_password` flag, so the frontend can route correctly right after login.

### Nice-to-have
- Basic audit fields (`last_login_at`) on `users` — cheap now, useful later for the admin dashboard.
- Configurable token lifetimes via env vars rather than hardcoded.

### Out of scope (explicitly not this feature)
- The test-taking engine, question bank, extension flow, and admin dashboard UI (beyond a bare login screen) — Features #2–#6.
- Self-registration, email verification, OAuth/SSO, or any "forgot password" self-service flow — only the admin can create or reset a candidate's credentials.
- Sending credentials by email/SMS — admin hands them over manually (chat/verbally), per the product's design.
- Deployment/Docker/Cloudflare Tunnel wiring — Feature #7.

---

## Data Model

Following the project's DB conventions (no foreign keys — app-level integrity instead; `TEXT` not `VARCHAR`; UUID PKs via `uuid_generate_v4()`; soft delete via `deleted_at`; `snake_case` columns; `TIMESTAMPTZ` everywhere, never bare `TIMESTAMP`).

**Data layer decision:** plain SQL migrations + a thin repository layer over `pg` (node-postgres) — no heavy ORM that auto-generates foreign keys (e.g. Prisma's relation model fights the no-FK convention). This mirrors the same Table/Entity/Repository separation already used on the Kotlin side, just in TypeScript. Flagging this as an assumption — shout if you'd rather use TypeORM/Prisma anyway.

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  login_id TEXT NOT NULL,                        -- the ID the admin hands out, e.g. "candidate001"
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,                             -- 'admin' | 'candidate'
  display_name TEXT NOT NULL,
  must_change_password BOOLEAN NOT NULL DEFAULT TRUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX idx_users_login_id_active ON users(login_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_role_active ON users(role) WHERE deleted_at IS NULL;

CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,                          -- app-level reference to users.id, no FK constraint
  token_hash TEXT NOT NULL,                        -- store a hash of the refresh token, never the raw value
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);
CREATE INDEX idx_refresh_tokens_user_active ON refresh_tokens(user_id) WHERE deleted_at IS NULL AND revoked_at IS NULL;
```

Rate limiting uses in-memory `@nestjs/throttler` (per-IP + per-login_id), not a DB table — no need to persist attempt counts for this scale.

---

## API Changes

RPC-style, no path params, query params/body only (matching project convention).

| Endpoint | Auth | Body | Response |
|---|---|---|---|
| `POST /api/v1/auth/login` | none | `{ login_id, password }` | `{ access_token, refresh_token, role, display_name, must_change_password }` |
| `POST /api/v1/auth/refresh` | none (refresh token in body) | `{ refresh_token }` | `{ access_token, refresh_token }` (rotated) |
| `POST /api/v1/auth/logout` | access token | `{ refresh_token }` | `{ success: true }` |
| `POST /api/v1/auth/change-password` | access token | `{ current_password, new_password }` | `{ success: true }` |
| `GET /api/v1/auth/me` | access token | — | `{ role, display_name, must_change_password }` |
| `POST /api/v1/admin/candidates/create` | access token, admin role | `{ login_id, display_name }` | `{ login_id, password }` (one-time, never retrievable again) |
| `POST /api/v1/admin/candidates/reset-password` | access token, admin role | `{ user_id }` | `{ login_id, password }` (one-time) |

All JSON is `snake_case` on the wire (Angular's HTTP interceptor converts to/from `camelCase` in code, matching the project's naming convention).

---

## UI Changes

- **Login screen** (shared for both roles — one form, role determined server-side): login ID + password fields, error state for invalid credentials, rate-limit error state.
- **Force-change-password screen**: shown immediately after login if `must_change_password` is true; blocks navigation elsewhere until submitted.
- Bare authenticated shell/router guard that redirects to `/login` if no valid session — actual admin/candidate dashboards are built in later features, this just needs the routing skeleton and an Angular `AuthInterceptor` that attaches the access token and handles 401 → refresh-or-redirect.

---

## Edge Cases

1. **Wrong password or non-existent login_id** → generic "invalid credentials" response either way (never reveal which part was wrong).
2. **Brute-force login attempts** → throttled (e.g. 5 attempts / 15 min per IP+login_id combo); further attempts return 429 before even checking the password.
3. **Expired or revoked refresh token used** → 401, frontend forces full re-login.
4. **Candidate hits an admin-only endpoint** → 403 via role guard.
5. **Admin creates a candidate with a `login_id` that's already taken (active)** → 409 conflict; soft-deleted rows don't block reuse.
6. **Candidate has `must_change_password = true` and tries to hit any protected endpoint other than `/auth/change-password` or `/auth/me`** → 403 with a specific error code the frontend can catch to force the redirect.
7. **Concurrent logins from the same candidate on two devices** → allowed for now (no single-session enforcement) — each gets its own refresh token row; not exclusive because there's no requirement yet to prevent it, but every refresh token is independently revocable.

---

## Testing Criteria

**Happy path:**
- Admin creates a candidate → receives login_id + one-time password.
- Candidate logs in with those credentials → response shows `must_change_password: true`.
- Candidate calls `change-password` → succeeds, flag flips to false.
- Candidate logs in again → normal session, can call `/auth/me`.
- Access token expires → refresh flow returns a new valid access token.
- Logout revokes the refresh token → using it again fails.

**Edge cases:**
- Invalid credentials rejected with generic message.
- 6th rapid login attempt within the window returns 429.
- Candidate calling an admin-only endpoint gets 403.
- Candidate with `must_change_password: true` blocked from any other protected route.
- Duplicate `login_id` creation attempt returns 409.
- Expired/revoked refresh token rejected with 401.

---

## Dependencies

- Postgres running locally (Docker Compose for dev) with `uuid-ossp` (or `pgcrypto`) extension enabled for `uuid_generate_v4()`.
- NestJS packages: `@nestjs/jwt`, `@nestjs/throttler`, `@nestjs/config`, `bcrypt` (or `argon2`), `pg`.
- Angular HTTP interceptor infrastructure for token attachment + case conversion (per project convention).
- Nothing from other features — this is the dependency root (#1) for the whole epic.

---

## Gate 1 Checklist

- [x] Problem clearly stated
- [x] Goal specific and measurable
- [x] At least one user story
- [x] Requirements split must-have / nice-to-have / out of scope
- [x] Out of scope section exists
- [x] New tables have standard columns (id, created_at, updated_at, deleted_at)
- [x] Column types correct (TEXT, UUID, TIMESTAMPTZ, BOOLEAN)
- [x] Soft delete strategy defined
- [x] Endpoints follow RPC/no-path-param convention
- [x] Request/response examples included
- [x] snake_case JSON convention noted
- [x] At least 3 edge cases (7 listed)
- [x] Testing criteria: happy path + edge cases
- [x] Dependencies listed
