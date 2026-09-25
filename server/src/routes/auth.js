import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { one, tx } from '../db/pool.js';
import { parse } from '../lib/validate.js';
import { HttpError } from '../lib/errors.js';
import { signToken, requireAuth } from '../middleware/auth.js';
import { seedDefaults } from '../lib/defaults.js';
import { seedDemoData } from '../db/demo.js';
import { todayIn } from '../lib/dates.js';

const router = Router();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.AUTH_RATE_LIMIT || 30),
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many attempts, please try again in a few minutes' },
});

const currency = z.string().trim().length(3).transform((s) => s.toUpperCase());
const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, currency: u.currency, isDemo: u.is_demo, createdAt: u.created_at });

router.post('/register', limiter, async (req, res) => {
  const body = parse(z.object({
    name: z.string().trim().min(1).max(120),
    email: z.email().trim().toLowerCase(),
    password: z.string().min(8, 'must be at least 8 characters').max(200),
    currency: currency.default('USD'),
  }), req.body);

  const exists = await one('SELECT 1 FROM users WHERE lower(email) = $1', [body.email]);
  if (exists) throw new HttpError(409, 'An account with this email already exists');

  const hash = await bcrypt.hash(body.password, 11);
  const user = await tx(async (c) => {
    const { rows: [u] } = await c.query(
      'INSERT INTO users (name, email, password_hash, currency) VALUES ($1,$2,$3,$4) RETURNING *',
      [body.name, body.email, hash, body.currency],
    );
    await seedDefaults(c, u.id);
    return u;
  });
  res.status(201).json({ token: signToken(user), user: publicUser(user) });
});

router.post('/login', limiter, async (req, res) => {
  const body = parse(z.object({ email: z.string().trim().toLowerCase(), password: z.string() }), req.body);
  const user = await one('SELECT * FROM users WHERE lower(email) = $1', [body.email]);
  const ok = user && (await bcrypt.compare(body.password, user.password_hash));
  if (!ok) throw new HttpError(401, 'Incorrect email or password');
  res.json({ token: signToken(user), user: publicUser(user) });
});

// One-click sandbox: a throwaway account pre-filled with realistic data.
router.post('/demo', limiter, async (req, res) => {
  const today = todayIn(req.get('x-timezone') || 'UTC');
  // Sandboxes are disposable: clear out ones older than two days.
  await one(`DELETE FROM users WHERE is_demo AND created_at < now() - interval '2 days'`);
  const user = await tx(async (c) => {
    const email = `demo-${crypto.randomBytes(5).toString('hex')}@demo.ledgerly.app`;
    const hash = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 8);
    const { rows: [u] } = await c.query(
      `INSERT INTO users (name, email, password_hash, currency, is_demo) VALUES ('Demo User',$1,$2,$3,true) RETURNING *`,
      [email, hash, (req.body?.currency || 'USD').toString().slice(0, 3).toUpperCase()],
    );
    await seedDefaults(c, u.id);
    await seedDemoData(c, u.id, today);
    return u;
  });
  res.status(201).json({ token: signToken(user), user: publicUser(user) });
});

router.get('/me', requireAuth, async (req, res) => {
  const user = await one('SELECT * FROM users WHERE id = $1', [req.userId]);
  if (!user) throw new HttpError(401, 'Account no longer exists');
  res.json({ user: publicUser(user) });
});

router.patch('/me', requireAuth, async (req, res) => {
  const body = parse(z.object({
    name: z.string().trim().min(1).max(120).optional(),
    currency: currency.optional(),
  }), req.body);
  const user = await one(
    `UPDATE users SET name = COALESCE($2, name), currency = COALESCE($3, currency) WHERE id = $1 RETURNING *`,
    [req.userId, body.name ?? null, body.currency ?? null],
  );
  res.json({ user: publicUser(user) });
});

router.post('/password', requireAuth, limiter, async (req, res) => {
  const body = parse(z.object({
    currentPassword: z.string(),
    newPassword: z.string().min(8, 'must be at least 8 characters').max(200),
  }), req.body);
  const user = await one('SELECT * FROM users WHERE id = $1', [req.userId]);
  if (user.is_demo) throw new HttpError(400, 'Demo accounts cannot change password');
  if (!(await bcrypt.compare(body.currentPassword, user.password_hash))) {
    throw new HttpError(400, 'Current password is incorrect');
  }
  await one('UPDATE users SET password_hash = $2 WHERE id = $1', [req.userId, await bcrypt.hash(body.newPassword, 11)]);
  res.json({ ok: true });
});

router.delete('/me', requireAuth, async (req, res) => {
  await one('DELETE FROM users WHERE id = $1', [req.userId]);
  res.status(204).end();
});

export default router;
