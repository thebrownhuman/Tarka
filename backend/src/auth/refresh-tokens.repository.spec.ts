import { Pool } from 'pg';
import { RefreshTokensRepository } from './refresh-tokens.repository';
import { UsersRepository } from '../users/users.repository';
import { UserRole } from '../users/entities/user.entity';

/**
 * Integration test against a real Postgres instance (DATABASE_URL env var).
 * See users.repository.spec.ts for setup notes.
 */
describe('RefreshTokensRepository', () => {
  let pool: Pool;
  let repository: RefreshTokensRepository;
  let usersRepository: UsersRepository;
  let testUserId: string;
  const testLoginId = `test_rt_user_${Date.now()}`;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL must be set to run RefreshTokensRepository integration tests.');
    }
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    repository = new RefreshTokensRepository(pool);
    usersRepository = new UsersRepository(pool);

    const user = await usersRepository.insert({
      loginId: testLoginId,
      passwordHash: 'hash',
      role: UserRole.CANDIDATE,
      displayName: 'RT Test User',
      mustChangePassword: false,
    });
    testUserId = user.id;
  });

  afterAll(async () => {
    await pool.query('DELETE FROM refresh_tokens WHERE user_id = $1', [testUserId]);
    await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
    await pool.end();
  });

  it('inserts a token and finds it active by hash', async () => {
    const expiresAt = new Date(Date.now() + 60_000);
    const created = await repository.insert(testUserId, 'hash-active', expiresAt);

    expect(created.id).toBeDefined();

    const found = await repository.byTokenHashActive('hash-active');
    expect(found?.id).toBe(created.id);
  });

  it('does not return an expired token as active', async () => {
    const expiresAt = new Date(Date.now() - 60_000);
    await repository.insert(testUserId, 'hash-expired', expiresAt);

    const found = await repository.byTokenHashActive('hash-expired');
    expect(found).toBeNull();
  });

  it('does not return a revoked token as active', async () => {
    const expiresAt = new Date(Date.now() + 60_000);
    const created = await repository.insert(testUserId, 'hash-revoked', expiresAt);
    await repository.revokeById(created.id);

    const found = await repository.byTokenHashActive('hash-revoked');
    expect(found).toBeNull();
  });

  it('revokeByTokenHash revokes the matching row', async () => {
    const expiresAt = new Date(Date.now() + 60_000);
    await repository.insert(testUserId, 'hash-to-revoke-by-value', expiresAt);

    await repository.revokeByTokenHash('hash-to-revoke-by-value');

    const found = await repository.byTokenHashActive('hash-to-revoke-by-value');
    expect(found).toBeNull();
  });
});
