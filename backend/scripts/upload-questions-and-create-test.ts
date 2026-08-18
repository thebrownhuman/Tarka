/**
 * One-time bootstrap script: logs in as an existing admin, uploads
 * .planning/reference/questions/converted-questions.json to the question
 * bank, then bundles a subset of the freshly-uploaded questions into a real
 * Test so there's something a candidate can actually start an attempt on.
 *
 * Run against a running backend (default http://localhost:3000):
 *
 *   npm run bootstrap:test -- --login-id=admin --password=... [--base-url=http://localhost:3000] [--test-size=30] [--duration-seconds=1800] [--title="Reasoning Sample Test"]
 */
import * as fs from 'fs';
import * as path from 'path';

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
  const baseUrl = args['base-url'] ?? 'http://localhost:3000';
  const testSize = Number(args['test-size'] ?? 30);
  const durationSeconds = Number(args['duration-seconds'] ?? 1800);
  const title = args['title'] ?? 'Reasoning Sample Test';

  if (!loginId || !password) {
    console.error('Usage: bootstrap:test --login-id=<id> --password=<password> [--base-url=...] [--test-size=30] [--duration-seconds=1800] [--title="..."]');
    process.exit(1);
  }

  const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login_id: loginId, password }),
  });
  if (!loginRes.ok) {
    throw new Error(`Login failed: ${loginRes.status} ${await loginRes.text()}`);
  }
  const { access_token: accessToken } = (await loginRes.json()) as { access_token: string };
  console.log('Logged in as admin.');

  const questionsPath = path.resolve(__dirname, '../../.planning/reference/questions/converted-questions.json');
  const { questions } = JSON.parse(fs.readFileSync(questionsPath, 'utf-8')) as { questions: unknown[] };
  console.log(`Uploading ${questions.length} questions from ${questionsPath}...`);

  const uploadRes = await fetch(`${baseUrl}/api/v1/admin/questions/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ questions }),
  });
  if (!uploadRes.ok) {
    throw new Error(`Upload failed: ${uploadRes.status} ${await uploadRes.text()}`);
  }
  const uploadResult = (await uploadRes.json()) as { inserted: number };
  console.log(`Uploaded successfully: ${uploadResult.inserted} questions inserted.`);

  const listRes = await fetch(`${baseUrl}/api/v1/admin/questions/list`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ offset: 0, limit: testSize }),
  });
  if (!listRes.ok) {
    throw new Error(`Listing questions failed: ${listRes.status} ${await listRes.text()}`);
  }
  const { items } = (await listRes.json()) as { items: Array<{ id: string }> };
  const questionIds = items.map((item) => item.id);
  console.log(`Picked ${questionIds.length} question ids for the test.`);

  const createTestRes = await fetch(`${baseUrl}/api/v1/admin/tests/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ title, duration_seconds: durationSeconds, question_ids: questionIds }),
  });
  if (!createTestRes.ok) {
    throw new Error(`Test creation failed: ${createTestRes.status} ${await createTestRes.text()}`);
  }
  const test = await createTestRes.json();
  console.log('Test created:', JSON.stringify(test, null, 2));
  console.log(`\nDone. Candidates can now start an attempt on test_id = ${(test as { id: string }).id}`);
}

main().catch((err) => {
  console.error('Bootstrap failed:', err);
  process.exit(1);
});
