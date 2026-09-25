import { Router } from 'express';
import { z } from 'zod';
import { many, one } from '../db/pool.js';
import { parse, parsePatch, setClause, color, id, money, date, optText } from '../lib/validate.js';
import { assertOwned } from '../lib/ownership.js';
import { notFound, HttpError } from '../lib/errors.js';

const router = Router();

const schema = z.object({
  name: z.string().trim().min(1).max(80),
  kind: z.enum(['cash', 'bank', 'mobile', 'card', 'other']).default('cash'),
  color: color.default('#10b981'),
  openingBalance: z.coerce.number().finite().default(0),
  archived: z.boolean().optional(),
});

const SELECT = `SELECT a.id, a.name, a.kind, a.color, a.opening_balance AS "openingBalance",
  a.archived, b.balance, a.created_at AS "createdAt"
  FROM accounts a JOIN account_balances b ON b.id = a.id`;

router.get('/', async (req, res) => {
  res.json(await many(`${SELECT} WHERE a.user_id = $1 ORDER BY a.archived, a.created_at`, [req.userId]));
});

router.get('/transfers', async (req, res) => {
  res.json(await many(
    `SELECT t.id, t.amount, t.transferred_on AS date, t.note, t.from_account_id AS "fromAccountId", t.to_account_id AS "toAccountId",
       f.name AS "fromName", f.color AS "fromColor", tt.name AS "toName", tt.color AS "toColor"
     FROM transfers t JOIN accounts f ON f.id = t.from_account_id JOIN accounts tt ON tt.id = t.to_account_id
     WHERE t.user_id = $1 ORDER BY t.transferred_on DESC, t.created_at DESC LIMIT 100`, [req.userId]));
});

router.post('/transfers', async (req, res) => {
  const b = parse(z.object({
    fromAccountId: id, toAccountId: id, amount: money, date: date.optional(), note: optText(200),
  }).refine((v) => v.fromAccountId !== v.toAccountId, { message: 'choose two different accounts', path: ['toAccountId'] }), req.body);
  await assertOwned(req.userId, { accounts: b.fromAccountId });
  await assertOwned(req.userId, { accounts: b.toAccountId });
  const row = await one(
    `INSERT INTO transfers (user_id, from_account_id, to_account_id, amount, transferred_on, note) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [req.userId, b.fromAccountId, b.toAccountId, b.amount, b.date || req.today, b.note]);
  res.status(201).json(row);
});

router.delete('/transfers/:id', async (req, res) => {
  const row = await one('DELETE FROM transfers WHERE id = $1 AND user_id = $2 RETURNING id', [parse(id, req.params.id), req.userId]);
  if (!row) throw notFound('Transfer');
  res.status(204).end();
});

router.post('/', async (req, res) => {
  const b = parse(schema, req.body);
  const { id: newId } = await one(
    `INSERT INTO accounts (user_id, name, kind, color, opening_balance) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [req.userId, b.name, b.kind, b.color, b.openingBalance],
  );
  res.status(201).json(await one(`${SELECT} WHERE a.id = $1`, [newId]));
});

router.patch('/:id', async (req, res) => {
  const accountId = parse(id, req.params.id);
  const patch = parsePatch(schema, req.body);
  const { sets, values } = setClause(patch, {
    name: 'name', kind: 'kind', color: 'color', openingBalance: 'opening_balance', archived: 'archived',
  }, 3);
  const row = await one(
    `UPDATE accounts SET ${['id = id', ...sets].join(', ')} WHERE id = $1 AND user_id = $2 RETURNING id`,
    [accountId, req.userId, ...values],
  );
  if (!row) throw notFound('Account');
  res.json(await one(`${SELECT} WHERE a.id = $1`, [accountId]));
});

router.delete('/:id', async (req, res) => {
  const accountId = parse(id, req.params.id);
  const { count } = await one('SELECT COUNT(*)::int AS count FROM accounts WHERE user_id = $1', [req.userId]);
  if (count <= 1) throw new HttpError(400, 'You need at least one account');
  const row = await one('DELETE FROM accounts WHERE id = $1 AND user_id = $2 RETURNING id', [accountId, req.userId]);
  if (!row) throw notFound('Account');
  res.status(204).end();
});

export default router;
