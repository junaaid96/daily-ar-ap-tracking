// Creates (or resets) a persistent demo login: demo@ledgerly.app / demo1234
import bcrypt from 'bcryptjs';
import { pool, tx } from './pool.js';
import { seedDefaults } from '../lib/defaults.js';
import { seedDemoData } from './demo.js';
import { todayIn } from '../lib/dates.js';

const email = process.env.SEED_EMAIL || 'demo@ledgerly.app';
const password = process.env.SEED_PASSWORD || 'demo1234';

await tx(async (c) => {
  await c.query('DELETE FROM users WHERE lower(email) = lower($1)', [email]);
  const { rows: [u] } = await c.query(
    `INSERT INTO users (name, email, password_hash, currency) VALUES ('Demo User', $1, $2, $3) RETURNING id`,
    [email, await bcrypt.hash(password, 11), process.env.SEED_CURRENCY || 'USD']);
  await seedDefaults(c, u.id);
  await seedDemoData(c, u.id, todayIn(process.env.SEED_TZ || 'UTC'));
});
console.log(`Seeded ${email} / ${password}`);
await pool.end();
