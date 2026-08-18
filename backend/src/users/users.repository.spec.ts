import { Pool } from 'pg';
import { UsersRepository } from './users.repository';
import { UserRole } from './entities/user.entity';

/**
 * Integration test against a real Postgres instance (DATABASE_URL env var).
 * Requires the users/refresh_tokens migrations to already be applied -
 * run via `docker compose up` (migrations run automatically on backend start)
 * before running this suite, e.g.:
 *   DATABASE_URL=postgres://assignment_app:<pw>@localhost:5432/assignment_app npm test
 */
describe('UsersRepository', () => {
  let pool: Pool;
  let repository: UsersRepository;
  const testLoginIdPrefix = `test_user_${Date.now()}`;

  beforeAll(() => {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL must be set to run UsersRepository integration tests.');
    }
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    repository = new UsersRepository(pool);
  });

  afterAll(async () => {
    await pool.query('DELETE FROM users WHERE login_id LIKE $1', [`${testLoginIdPrefix}%`]);
    await pool.end();
  });

  it('inserts a user and reads it back by login_id', async () => {
    const loginId = `${testLoginIdPrefix}_insert`;
    const created = await repository.insert({
      loginId,
      passwordHash: 'hash',
      role: UserRole.CANDIDATE,
      displayName: 'Test Candidate',
      mustChangePassword: true,
    });

    expect(created.id).toBeDefined();
    expect(created.mustChangePassword).toBe(true);

    const found = await repository.byLoginIdActive(loginId);
    expect(found).not.toBeNull();
    expect(found?.id).toBe(created.id);
  });

  it('returns null for a login_id that does not exist', async () => {
    const found = await repository.byLoginIdActive(`${testLoginIdPrefix}_does_not_exist`);
    expect(found).toBeNull();
  });

  it('excludes soft-deleted rows from byLoginIdActive, freeing the login_id for reuse', async () => {
    const loginId = `${testLoginIdPrefix}_soft_deleted`;
    const created = await repository.insert({
      loginId,
      passwordHash: 'hash',
      role: UserRole.CANDIDATE,
      displayName: 'Soft Deleted Candidate',
      mustChangePassword: true,
    });
    await pool.query('UPDATE users SET deleted_at = NOW() WHERE id = $1', [created.id]);

    const found = await repository.byLoginIdActive(loginId);
    expect(found).toBeNull();
  });

  it('updatePasswordAndFlag updates the hash and must_change_password flag', async () => {
    const loginId = `${testLoginIdPrefix}_update`;
    const created = await repository.insert({
      loginId,
      passwordHash: 'old-hash',
      role: UserRole.CANDIDATE,
      displayName: 'Update Candidate',
      mustChangePassword: true,
    });

    const updated = await repository.updatePasswordAndFlag(created.id, 'new-hash', false);

    expect(updated?.passwordHash).toBe('new-hash');
    expect(updated?.mustChangePassword).toBe(false);
  });

  it('byId returns null for a non-existent id', async () => {
    const found = await repository.byId('00000000-0000-0000-0000-000000000000');
    expect(found).toBeNull();
  });
});
