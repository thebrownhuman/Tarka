# Plan: Foundations & Auth

**Spec**: .planning/specs/foundations-and-auth.md
**Epic**: assignment-test-platform (Feature 1 of 7)
**Created**: 2026-08-18
**Status**: draft

---

## Stack

Full-stack, brand-new repo (currently empty besides `.planning/`). Backend: NestJS + Postgres (raw `pg`, no ORM, per spec). Frontend: Angular. **Everything containerized via Docker Compose from the start** — this supersedes the spec's "Docker Compose for dev only" note. The same compose structure is designed to be portable to the homelab server later (Feature 7), driven entirely by `.env`, no hardcoded local paths.

---

## Architecture

### Components Table

| Component | Type | Purpose |
|-----------|------|---------|
| `AuthController` | Controller | `/auth/*` endpoints — login, refresh, logout, change-password, me |
| `AdminCandidatesController` | Controller | `/admin/candidates/*` — create & reset-password, admin-only |
| `AuthService` | Service (Manager) | Business logic: verify credentials, issue/rotate/revoke tokens, enforce must-change-password |
| `UsersRepository` | Repository | Raw SQL against `users` table |
| `RefreshTokensRepository` | Repository | Raw SQL against `refresh_tokens` table |
| `JwtStrategy` | Passport strategy | Validates access token, attaches user to request |
| `JwtAuthGuard` | Guard | Requires valid access token |
| `RolesGuard` | Guard | Requires a specific role (`admin`/`candidate`) |
| `MustChangePasswordGuard` | Guard | Blocks access if `must_change_password` is true, except on the allowed endpoints |
| `DatabaseModule` | Module | Provides a shared `pg.Pool` via DI token `PG_POOL` |
| `AuthService` (Angular) | Service | Login/refresh/logout/change-password calls + current-user state |
| `AuthInterceptor` (Angular) | HTTP Interceptor | Attaches access token; on 401, tries refresh once then redirects to `/login` |
| `CaseConversionInterceptor` (Angular) | HTTP Interceptor | camelCase ↔ snake_case at the HTTP boundary |
| `AuthGuard` (Angular) | Route Guard | Redirects to `/login` if no session; redirects to `/change-password` if forced |
| `LoginComponent` | Component | Login form |
| `ChangePasswordComponent` | Component | Forced password-change form |

### File Locations Table

| File | Location | Purpose |
|------|----------|---------|
| `docker-compose.yml` | `/` | Base service definitions (postgres, backend, frontend) |
| `docker-compose.override.yml` | `/` | Dev-only overrides: bind mounts, hot reload commands |
| `.env.example` | `/` | Documented env vars, copied to `.env` locally |
| `backend/Dockerfile` | `backend/` | Prod-style multi-stage build |
| `backend/Dockerfile.dev` | `backend/` | Dev image: installs deps, runs `start:dev` (ts-node-dev/nodemon) |
| `backend/src/main.ts` | `backend/src/` | Nest bootstrap, global pipes/filters |
| `backend/src/app.module.ts` | `backend/src/` | Root module |
| `backend/src/database/database.module.ts` | `backend/src/database/` | `pg.Pool` provider |
| `backend/src/database/migrations/*.sql` | `backend/src/database/migrations/` | node-pg-migrate SQL migrations |
| `backend/src/users/entities/user.entity.ts` | `backend/src/users/entities/` | TS interface matching `users` columns |
| `backend/src/users/users.repository.ts` | `backend/src/users/` | CRUD for `users` |
| `backend/src/auth/entities/refresh-token.entity.ts` | `backend/src/auth/entities/` | TS interface matching `refresh_tokens` |
| `backend/src/auth/refresh-tokens.repository.ts` | `backend/src/auth/` | CRUD for `refresh_tokens` |
| `backend/src/auth/auth.service.ts` | `backend/src/auth/` | Login/refresh/logout/change-password logic |
| `backend/src/auth/auth.controller.ts` | `backend/src/auth/` | `/auth/*` endpoints |
| `backend/src/auth/dto/*.dto.ts` | `backend/src/auth/dto/` | `LoginDto`, `ChangePasswordDto`, `RefreshDto` (class-validator) |
| `backend/src/auth/strategies/jwt.strategy.ts` | `backend/src/auth/strategies/` | Passport JWT strategy |
| `backend/src/auth/guards/*.guard.ts` | `backend/src/auth/guards/` | `JwtAuthGuard`, `RolesGuard`, `MustChangePasswordGuard` |
| `backend/src/auth/decorators/*.decorator.ts` | `backend/src/auth/decorators/` | `@Roles()`, `@CurrentUser()` |
| `backend/src/admin/admin-candidates.controller.ts` | `backend/src/admin/` | `/admin/candidates/*` endpoints |
| `backend/src/admin/admin-candidates.service.ts` | `backend/src/admin/` | Candidate create/reset logic (generates one-time password) |
| `backend/src/common/filters/http-exception.filter.ts` | `backend/src/common/filters/` | Uniform `{ error: { code, message, status } }` shape |
| `frontend/Dockerfile` | `frontend/` | Multi-stage build → nginx static serve |
| `frontend/Dockerfile.dev` | `frontend/` | `ng serve --host 0.0.0.0` for hot reload |
| `frontend/src/app/core/services/auth.service.ts` | `frontend/src/app/core/services/` | Session state + API calls |
| `frontend/src/app/core/interceptors/*.interceptor.ts` | `frontend/src/app/core/interceptors/` | Auth + case-conversion |
| `frontend/src/app/core/guards/auth.guard.ts` | `frontend/src/app/core/guards/` | Route protection |
| `frontend/src/app/features/login/login.component.*` | `frontend/src/app/features/login/` | Login screen |
| `frontend/src/app/features/change-password/change-password.component.*` | `frontend/src/app/features/change-password/` | Forced change-password screen |
| `frontend/src/app/app.routes.ts` | `frontend/src/app/` | Route table with guards wired in |

No existing files to change — this is a from-scratch repo.

---

## Docker Compose Service Definitions

**`docker-compose.yml`** (base — portable to homelab later, `.env`-driven, no hardcoded paths):

```yaml
services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-assignment_app}
      POSTGRES_USER: ${POSTGRES_USER:-assignment_app}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?set in .env}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "${POSTGRES_PORT:-5432}:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-assignment_app}"]
      interval: 5s
      timeout: 5s
      retries: 10

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      DATABASE_URL: postgres://${POSTGRES_USER:-assignment_app}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB:-assignment_app}
      JWT_ACCESS_SECRET: ${JWT_ACCESS_SECRET:?set in .env}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET:?set in .env}
      JWT_ACCESS_TTL: ${JWT_ACCESS_TTL:-15m}
      JWT_REFRESH_TTL: ${JWT_REFRESH_TTL:-7d}
      PORT: 3000
    ports:
      - "${BACKEND_PORT:-3000}:3000"

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    restart: unless-stopped
    depends_on:
      - backend
    ports:
      - "${FRONTEND_PORT:-8080}:80"

volumes:
  postgres_data:
```

**`docker-compose.override.yml`** (auto-merged by `docker compose up` — dev only, hot reload; ignored in prod-style runs via `docker compose -f docker-compose.yml up -d`):

```yaml
services:
  backend:
    build:
      dockerfile: Dockerfile.dev
    volumes:
      - ./backend/src:/app/src
      - ./backend/package.json:/app/package.json
    command: npm run start:dev
    environment:
      NODE_ENV: development

  frontend:
    build:
      dockerfile: Dockerfile.dev
    volumes:
      - ./frontend/src:/app/src
    ports:
      - "${FRONTEND_PORT:-4200}:4200"
    command: npm run start -- --host 0.0.0.0
```

**`.env.example`**:

```
POSTGRES_DB=assignment_app
POSTGRES_USER=assignment_app
POSTGRES_PASSWORD=change_me
POSTGRES_PORT=5432
BACKEND_PORT=3000
FRONTEND_PORT=8080
JWT_ACCESS_SECRET=change_me_long_random_string
JWT_REFRESH_SECRET=change_me_different_long_random_string
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d
```

Migrations run automatically on backend container start (entrypoint runs `node-pg-migrate up` before `nest start`) — no separate migration-runner service, keeps the compose file lean and identical in dev and prod.

Local dev workflow: `docker compose up` → Postgres + backend (hot reload) + frontend (hot reload) all running, migrations applied automatically.

---

## Task Breakdown

### Phase 1: Scaffold & Docker Compose

| # | Task | Files |
|---|------|-------|
| 1 | Root compose files + env template + `.gitignore` | `docker-compose.yml`, `docker-compose.override.yml`, `.env.example`, `.gitignore` |
| 2 | NestJS scaffold + Dockerfiles | `backend/package.json`, `backend/src/main.ts`, `backend/src/app.module.ts`, `backend/Dockerfile`, `backend/Dockerfile.dev` |
| 3 | Angular scaffold + Dockerfiles | `frontend/package.json`, `frontend/src/app/app.config.ts`, `frontend/Dockerfile`, `frontend/Dockerfile.dev` |

### Phase 2: Database Layer (depends on Phase 1)

| # | Task | Files |
|---|------|-------|
| 4 | Postgres pool provider + node-pg-migrate config | `backend/src/database/database.module.ts`, `backend/src/database/database.providers.ts` |
| 5 | Migration: enable uuid extension + `users` table | `backend/src/database/migrations/0001_create_users.sql` |
| 6 | Migration: `refresh_tokens` table | `backend/src/database/migrations/0002_create_refresh_tokens.sql` |
| 7 | `UsersRepository` (insert, byLoginId, byId, updatePasswordHash, updateMustChangePassword, updateLastLogin) | `backend/src/users/entities/user.entity.ts`, `backend/src/users/users.repository.ts` |
| 8 | `RefreshTokensRepository` (insert, byTokenHash, revokeById, revokeAllForUser) | `backend/src/auth/entities/refresh-token.entity.ts`, `backend/src/auth/refresh-tokens.repository.ts` |

### Phase 3: Auth Business Logic (depends on Phase 2)

| # | Task | Files |
|---|------|-------|
| 9 | Password hashing util (bcrypt wrapper) | `backend/src/auth/password.util.ts` |
| 10 | `AuthService`: login, refresh (rotate), logout (revoke), changePassword, validateUser | `backend/src/auth/auth.service.ts` |
| 11 | `JwtStrategy` + `JwtAuthGuard` | `backend/src/auth/strategies/jwt.strategy.ts`, `backend/src/auth/guards/jwt-auth.guard.ts` |
| 12 | `RolesGuard` + `@Roles()` decorator + `MustChangePasswordGuard` | `backend/src/auth/guards/roles.guard.ts`, `backend/src/auth/decorators/roles.decorator.ts`, `backend/src/auth/guards/must-change-password.guard.ts` |
| 13 | Throttler config on login route | `backend/src/app.module.ts` (ThrottlerModule config), `backend/src/auth/auth.controller.ts` (guard applied) |

### Phase 4: Auth API (depends on Phase 3)

| # | Task | Files |
|---|------|-------|
| 14 | DTOs with class-validator | `backend/src/auth/dto/login.dto.ts`, `backend/src/auth/dto/refresh.dto.ts`, `backend/src/auth/dto/change-password.dto.ts` |
| 15 | `AuthController`: login, refresh, logout, change-password, me | `backend/src/auth/auth.controller.ts` |
| 16 | `AdminCandidatesService` + `AdminCandidatesController` (create, reset-password, one-time password generation) | `backend/src/admin/admin-candidates.service.ts`, `backend/src/admin/admin-candidates.controller.ts` |
| 17 | Global exception filter → `{ error: { code, message, status } }` | `backend/src/common/filters/http-exception.filter.ts` |

### Phase 5: Frontend Auth Flow (depends on Phase 4)

| # | Task | Files |
|---|------|-------|
| 18 | `AuthService` (Angular): login/refresh/logout/changePassword + current-user signal | `frontend/src/app/core/services/auth.service.ts` |
| 19 | `AuthInterceptor` + `CaseConversionInterceptor` | `frontend/src/app/core/interceptors/auth.interceptor.ts`, `frontend/src/app/core/interceptors/case-conversion.interceptor.ts` |
| 20 | `AuthGuard` route guard | `frontend/src/app/core/guards/auth.guard.ts` |
| 21 | `LoginComponent` | `frontend/src/app/features/login/login.component.ts`, `.html`, `.scss` |
| 22 | `ChangePasswordComponent` | `frontend/src/app/features/change-password/change-password.component.ts`, `.html`, `.scss` |
| 23 | Wire routes + guards | `frontend/src/app/app.routes.ts` |

### Phase 6: Tests (parallel with Phase 5 once Phase 4 is done for backend tests; frontend tests after Phase 5)

| # | Task | Files |
|---|------|-------|
| 24 | Repository tests (against test Postgres via a `docker-compose.test.yml` or Testcontainers) | `backend/src/users/users.repository.spec.ts`, `backend/src/auth/refresh-tokens.repository.spec.ts` |
| 25 | `AuthService` unit tests (mocked repositories) | `backend/src/auth/auth.service.spec.ts` |
| 26 | Auth controller e2e tests (supertest, full HTTP stack) | `backend/test/auth.e2e-spec.ts` |
| 27 | Angular component tests | `frontend/src/app/features/login/login.component.spec.ts`, `frontend/src/app/features/change-password/change-password.component.spec.ts` |

---

## Parallel vs Sequential

| Parallel Group | Tasks | Why |
|---------------|-------|-----|
| Group A | 2, 3 | Backend and frontend scaffolds are independent |
| Group B | 5, 6 | Both are new migration files, no shared state within this phase |
| Group C | 7, 8 | Independent repositories (users vs refresh_tokens) |
| Group D | 9, 13 | Password util and throttler config don't depend on each other |
| Group E | 24, 27 | Backend repo tests and frontend component tests are independent once their respective phases are done |

| Sequential | Depends On | Why |
|-----------|-----------|-----|
| Task 4 | 2 | Needs backend scaffold to exist |
| Tasks 5, 6 | 4 | Needs pool/migration config in place |
| Tasks 7, 8 | 5, 6 | Repositories need their tables to exist |
| Task 10 | 7, 8, 9 | Service needs repositories and hashing util |
| Tasks 11, 12 | 10 | Guards/strategy need `AuthService.validateUser` |
| Tasks 14-17 | 10, 11, 12, 13 | Controllers wrap the service + guards |
| Tasks 18-23 | 15, 16 | Frontend needs real endpoints to call |
| Task 25 | 10 | Unit tests need the service written |
| Task 26 | 15, 16, 17 | e2e tests need the full controller stack |

---

## Testing Plan

| Test | Covers (spec ref) |
|------|--------------------|
| `UsersRepository`: insert, byLoginId (found/not found), unique constraint on active login_id | Data model, edge case 5 |
| `RefreshTokensRepository`: insert, byTokenHash, revoke, revoked tokens excluded from active lookups | Data model, edge case 3 |
| `AuthService.login`: success issues both tokens; wrong password/unknown login_id → generic invalid-credentials error | Happy path; edge case 1 |
| `AuthService.refresh`: valid token rotates and invalidates the old one; expired/revoked token rejected | Happy path; edge case 3 |
| `AuthService.changePassword`: flips `must_change_password` to false; wrong current password rejected | Happy path |
| `MustChangePasswordGuard`: blocks all routes except `/auth/me` and `/auth/change-password` when flag is true | Edge case 6 |
| `RolesGuard`: candidate hitting admin-only route → 403 | Edge case 4 |
| Login e2e: 6th attempt within window → 429 | Edge case 2 |
| Admin candidate creation e2e: duplicate active `login_id` → 409 | Edge case 5 |
| Full happy-path e2e: create candidate → login → forced change-password → change → login again → refresh → logout → revoked token rejected | Happy path (all steps) |
| Angular `LoginComponent`: renders, submits, shows error state on 401/429 | UI |
| Angular `ChangePasswordComponent`: renders, submits, redirects away once flag clears | UI |

---

## Gate 2 Checklist

- [x] Follows layered architecture (Controller → Service → Repository), same shape as the project's other conventions, adapted to NestJS/raw SQL
- [x] Each layer only calls the layer below it (controllers never touch the pool directly)
- [x] Components in sensible directories (feature-modules on both sides)
- [x] All new files listed with locations
- [x] Existing files to change: none (fresh repo)
- [x] Each task ≤ 3 files
- [x] Dependencies between tasks explicit
- [x] Parallel vs sequential marked
- [x] Data layer tests planned
- [x] Business logic tests planned
- [x] API/integration tests planned
- [x] UI tests planned
- [x] All 7 spec edge cases covered in test plan
