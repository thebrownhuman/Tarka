import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { AppErrorCode } from '../src/common/errors/app-error-code';

/**
 * Full HTTP-stack e2e suite (spec's Testing Criteria). Requires a real,
 * migrated Postgres reachable via DATABASE_URL - bring it up with
 * `docker compose up -d postgres` (or the full stack) before running.
 */
describe('Auth + Admin Candidates (e2e)', () => {
  let app: INestApplication;
  let pool: Pool;
  const runId = Date.now();
  const adminLoginId = `e2e_admin_${runId}`;
  const adminPassword = 'AdminPass123!';

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL must be set to run e2e tests.');
    }
    pool = new Pool({ connectionString: process.env.DATABASE_URL });

    // Bootstrap an admin directly via SQL, mirroring scripts/seed-admin.ts,
    // since creating the very first admin has no API endpoint by design.
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    await pool.query(
      `INSERT INTO users (login_id, password_hash, role, display_name, must_change_password)
       VALUES ($1, $2, 'admin', 'E2E Admin', FALSE)`,
      [adminLoginId, passwordHash],
    );

    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await pool.query('DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE login_id LIKE $1)', [
      `e2e_%_${runId}%`,
    ]);
    await pool.query('DELETE FROM users WHERE login_id LIKE $1', [`e2e_%_${runId}%`]);
    await pool.end();
    await app.close();
  });

  it('rejects invalid credentials with a generic message (edge case 1)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ login_id: 'does-not-exist', password: 'whatever' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe(AppErrorCode.INVALID_CREDENTIALS);
  });

  it('throttles the 6th rapid login attempt for the same ip+login_id (edge case 2)', async () => {
    const throttleLoginId = `e2e_throttle_${runId}`;
    let lastStatus = 0;
    for (let i = 0; i < 6; i++) {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ login_id: throttleLoginId, password: 'wrong' });
      lastStatus = res.status;
      if (i === 5) {
        expect(res.body.error.code).toBe(AppErrorCode.RATE_LIMITED);
      }
    }
    expect(lastStatus).toBe(429);
  });

  it('runs the full happy path: create candidate -> forced change -> normal session -> refresh -> logout -> token reuse fails', async () => {
    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ login_id: adminLoginId, password: adminPassword });
    expect(adminLogin.status).toBe(200);
    expect(adminLogin.body.role).toBe('admin');
    const adminAccessToken = adminLogin.body.access_token;

    const candidateLoginId = `e2e_candidate_${runId}`;
    const createRes = await request(app.getHttpServer())
      .post('/api/v1/admin/candidates/create')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ login_id: candidateLoginId, display_name: 'E2E Candidate' });
    expect(createRes.status).toBe(201);
    const oneTimePassword = createRes.body.password;
    expect(createRes.body.login_id).toBe(candidateLoginId);

    const firstLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ login_id: candidateLoginId, password: oneTimePassword });
    expect(firstLogin.status).toBe(200);
    expect(firstLogin.body.must_change_password).toBe(true);
    const candidateAccessToken = firstLogin.body.access_token;

    const changeRes = await request(app.getHttpServer())
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${candidateAccessToken}`)
      .send({ current_password: oneTimePassword, new_password: 'NewCandidatePass456!' });
    expect(changeRes.status).toBe(200);

    const secondLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ login_id: candidateLoginId, password: 'NewCandidatePass456!' });
    expect(secondLogin.status).toBe(200);
    expect(secondLogin.body.must_change_password).toBe(false);
    const accessToken = secondLogin.body.access_token;
    const refreshToken = secondLogin.body.refresh_token;

    const meRes = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(meRes.status).toBe(200);
    expect(meRes.body.role).toBe('candidate');
    expect(meRes.body.must_change_password).toBe(false);

    const refreshRes = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refresh_token: refreshToken });
    expect(refreshRes.status).toBe(200);
    const rotatedRefreshToken = refreshRes.body.refresh_token;
    expect(rotatedRefreshToken).not.toBe(refreshToken);

    const logoutRes = await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${refreshRes.body.access_token}`)
      .send({ refresh_token: rotatedRefreshToken });
    expect(logoutRes.status).toBe(200);

    const reuseRes = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refresh_token: rotatedRefreshToken });
    expect(reuseRes.status).toBe(401);
    expect(reuseRes.body.error.code).toBe(AppErrorCode.INVALID_REFRESH_TOKEN);
  });

  it('rejects an expired/garbage refresh token with 401 (edge case 3)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refresh_token: 'not-a-real-token' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe(AppErrorCode.INVALID_REFRESH_TOKEN);
  });

  it('rejects a candidate hitting an admin-only endpoint with 403 (edge case 4)', async () => {
    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ login_id: adminLoginId, password: adminPassword });
    const adminAccessToken = adminLogin.body.access_token;

    const candidateLoginId = `e2e_rolecheck_${runId}`;
    const createRes = await request(app.getHttpServer())
      .post('/api/v1/admin/candidates/create')
      .set('Authorization', `Bearer ${adminAccessToken}`)
      .send({ login_id: candidateLoginId, display_name: 'Role Check Candidate' });

    const candidateLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ login_id: candidateLoginId, password: createRes.body.password });

    // First flip must_change_password off so this test isolates the role check,
    // not the must-change-password guard (covered separately below).
    await request(app.getHttpServer())
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${candidateLogin.body.access_token}`)
      .send({ current_password: createRes.body.password, new_password: 'RoleCheckPass789!' });

    const relogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ login_id: candidateLoginId, password: 'RoleCheckPass789!' });

    const forbiddenRes = await request(app.getHttpServer())
      .post('/api/v1/admin/candidates/create')
      .set('Authorization', `Bearer ${relogin.body.access_token}`)
      .send({ login_id: `e2e_should_not_be_created_${runId}`, display_name: 'Nope' });

    expect(forbiddenRes.status).toBe(403);
    expect(forbiddenRes.body.error.code).toBe(AppErrorCode.FORBIDDEN_ROLE);
  });

  it('blocks a must-change-password candidate from any route other than /auth/me and /auth/change-password (edge case 6)', async () => {
    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ login_id: adminLoginId, password: adminPassword });

    const candidateLoginId = `e2e_mustchange_${runId}`;
    const createRes = await request(app.getHttpServer())
      .post('/api/v1/admin/candidates/create')
      .set('Authorization', `Bearer ${adminLogin.body.access_token}`)
      .send({ login_id: candidateLoginId, display_name: 'Must Change Candidate' });

    const candidateLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ login_id: candidateLoginId, password: createRes.body.password });
    expect(candidateLogin.body.must_change_password).toBe(true);

    // /auth/me stays reachable.
    const meRes = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${candidateLogin.body.access_token}`);
    expect(meRes.status).toBe(200);

    // Any other protected route (here: /auth/logout) is blocked with the specific code.
    const logoutRes = await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${candidateLogin.body.access_token}`)
      .send({ refresh_token: candidateLogin.body.refresh_token });
    expect(logoutRes.status).toBe(403);
    expect(logoutRes.body.error.code).toBe(AppErrorCode.MUST_CHANGE_PASSWORD);
  });

  it('rejects creating a candidate with an already-active login_id with 409 (edge case 5)', async () => {
    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ login_id: adminLoginId, password: adminPassword });

    const dupLoginId = `e2e_dup_${runId}`;
    const first = await request(app.getHttpServer())
      .post('/api/v1/admin/candidates/create')
      .set('Authorization', `Bearer ${adminLogin.body.access_token}`)
      .send({ login_id: dupLoginId, display_name: 'First' });
    expect(first.status).toBe(201);

    const second = await request(app.getHttpServer())
      .post('/api/v1/admin/candidates/create')
      .set('Authorization', `Bearer ${adminLogin.body.access_token}`)
      .send({ login_id: dupLoginId, display_name: 'Second' });
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe(AppErrorCode.LOGIN_ID_TAKEN);
  });
});
