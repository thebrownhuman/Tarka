/**
 * One-time bootstrap script to create the very first admin account.
 *
 * There is no "create first admin" API endpoint in scope for this feature
 * (only an already-authenticated admin can create candidates), so this raw
 * script is how the first admin gets into the system. Run once, then forget:
 *
 *   docker compose exec backend npm run seed:admin -- --login-id=admin --password=... --display-name="Admin"
 *
 * or locally with DATABASE_URL set in the environment:
 *
 *   npm run seed:admin -- --login-id=admin --password=... --display-name="Admin"
 */
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';

function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  for (const raw of argv) {
    const match = /^--([^=]+)=(.*)$/.exec(raw);
    if (match) {
      args[match[1]] = match[2];
    }
  }
  return args;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const loginId = args['login-id'];
  const password = args['password'];
  const displayName = args['display-name'] ?? 'Administrator';

  if (!loginId || !password) {
    console.error('Usage: seed-admin --login-id=<id> --password=<password> [--display-name="Name"]');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const existing = await pool.query('SELECT id FROM users WHERE login_id = $1 AND deleted_at IS NULL LIMIT 1', [
      loginId,
    ]);
    if (existing.rows.length > 0) {
      console.error(`login_id "${loginId}" already exists. Aborting.`);
      process.exit(1);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await pool.query(
      `INSERT INTO users (login_id, password_hash, role, display_name, must_change_password)
       VALUES ($1, $2, 'admin', $3, FALSE)`,
      [loginId, passwordHash, displayName],
    );
    console.log(`Admin user "${loginId}" created successfully.`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Failed to seed admin user:', err);
  process.exit(1);
});
