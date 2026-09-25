import { Router } from 'express';
import { z } from 'zod';
import { many, one } from '../db/pool.js';
import { parse, parsePatch, setClause, id, money, date, optText, optId } from '../lib/validate.js';
import { notFound } from '../lib/errors.js';
import { assertOwned } from '../lib/ownership.js';
import { toCsv } from '../lib/csv.js';

const router = Router();

const schema = z.object({
  kind: z.enum(['expense', 'income']),
  amount: money,
  categoryId: optId,
  accountId: optId,
  occurredOn: date.optional(),
  note: optText(300),
});

const SELECT = `SELECT t.id, t.kind, t.amount, t.occurred_on AS "occurredOn", t.note, t.created_at AS "createdAt",
  t.recurring_id AS "recurringId",
  t.category_id AS "categoryId", cat.name AS "categoryName", cat.icon AS "categoryIcon", cat.color AS "categoryColor",
  t.account_id AS "accountId", a.name AS "accountName"
  FROM transactions t
  LEFT JOIN categories cat ON cat.id = t.category_id
  LEFT JOIN accounts a ON a.id = t.account_id`;

const filterSchema = z.object({
  kind: z.enum(['expense', 'income']).optional(),
  from: date.optional(),
  to: date.optional(),
  categoryId: id.optional(),
  accountId: id.optional(),
  q: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

function buildWhere(userId, f) {
  const where = ['t.user_id = $1'];
  const params = [userId];
  const add = (sql, v) => { params.push(v); where.push(sql.replaceAll('?', `$${params.length}`)); };
  if (f.kind) add('t.kind = ?', f.kind);
  if (f.from) add('t.occurred_on >= ?', f.from);
  if (f.to) add('t.occurred_on <= ?', f.to);
  if (f.categoryId) add('t.category_id = ?', f.categoryId);
  if (f.accountId) add('t.account_id = ?', f.accountId);
  if (f.q) add(`(t.note ILIKE '%' || ? || '%' OR cat.name ILIKE '%' || ? || '%')`, f.q);
  return { where: where.join(' AND '), params };
}

router.get('/', async (req, res) => {
  const f = parse(filterSchema, req.query);
  const { where, params } = buildWhere(req.userId, f);
  const [items, totals] = await Promise.all([
    many(`${SELECT} WHERE ${where} ORDER BY t.occurred_on DESC, t.created_at DESC LIMIT ${f.limit} OFFSET ${f.offset}`, params),
    one(`SELECT COUNT(*)::int AS count,
           COALESCE(SUM(t.amount) FILTER (WHERE t.kind = 'income'), 0) AS income,
           COALESCE(SUM(t.amount) FILTER (WHERE t.kind = 'expense'), 0) AS expense
         FROM transactions t LEFT JOIN categories cat ON cat.id = t.category_id WHERE ${where}`, params),
  ]);
  res.json({ items, ...totals, hasMore: f.offset + items.length < totals.count });
});

router.get('/export.csv', async (req, res) => {
  const f = parse(filterSchema.omit({ limit: true, offset: true }), req.query);
  const { where, params } = buildWhere(req.userId, f);
  const rows = await many(`${SELECT} WHERE ${where} ORDER BY t.occurred_on DESC, t.created_at DESC`, params);
  const csv = toCsv(rows, [['occurredOn', 'Date'], ['kind', 'Type'], ['categoryName', 'Category'],
    ['amount', 'Amount'], ['accountName', 'Account'], ['note', 'Note']]);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="transactions-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(`﻿${csv}`);
});

// Quick-entry suggestions: the notes you type most often per category.
router.get('/suggestions', async (req, res) => {
  res.json(await many(
    `SELECT t.note, t.kind, t.category_id AS "categoryId", ROUND(AVG(t.amount), 2)::float AS "typicalAmount", COUNT(*)::int AS uses
     FROM transactions t WHERE t.user_id = $1 AND t.note IS NOT NULL AND t.occurred_on > CURRENT_DATE - 120
     GROUP BY t.note, t.kind, t.category_id ORDER BY uses DESC, MAX(t.created_at) DESC LIMIT 12`,
    [req.userId],
  ));
});

router.post('/', async (req, res) => {
  const b = parse(schema, req.body);
  await assertOwned(req.userId, { categories: b.categoryId, accounts: b.accountId });
  const { id: newId } = await one(
    `INSERT INTO transactions (user_id, kind, amount, category_id, account_id, occurred_on, note)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [req.userId, b.kind, b.amount, b.categoryId, b.accountId, b.occurredOn || req.today, b.note],
  );
  res.status(201).json(await one(`${SELECT} WHERE t.id = $1`, [newId]));
});

router.patch('/:id', async (req, res) => {
  const txId = parse(id, req.params.id);
  const patch = parsePatch(schema, req.body);
  await assertOwned(req.userId, { categories: patch.categoryId, accounts: patch.accountId });
  const { sets, values } = setClause(patch, {
    kind: 'kind', amount: 'amount', categoryId: 'category_id', accountId: 'account_id', occurredOn: 'occurred_on', note: 'note',
  }, 3);
  const row = await one(`UPDATE transactions SET ${['id = id', ...sets].join(', ')} WHERE id = $1 AND user_id = $2 RETURNING id`,
    [txId, req.userId, ...values]);
  if (!row) throw notFound('Transaction');
  res.json(await one(`${SELECT} WHERE t.id = $1`, [txId]));
});

router.delete('/:id', async (req, res) => {
  const row = await one('DELETE FROM transactions WHERE id = $1 AND user_id = $2 RETURNING id', [parse(id, req.params.id), req.userId]);
  if (!row) throw notFound('Transaction');
  res.status(204).end();
});

export default router;
