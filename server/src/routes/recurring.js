import { Router } from 'express';
import { z } from 'zod';
import { many, one, tx } from '../db/pool.js';
import { parse, parsePatch, setClause, id, money, date, optDate, optId } from '../lib/validate.js';
import { notFound, badRequest } from '../lib/errors.js';
import { assertOwned } from '../lib/ownership.js';
import { advance } from '../lib/dates.js';
import { processRecurring, monthlyEquivalent } from '../lib/recurring.js';

const router = Router();

const schema = z.object({
  kind: z.enum(['expense', 'income']).default('expense'),
  name: z.string().trim().min(1).max(120),
  amount: money,
  categoryId: optId,
  accountId: optId,
  frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']).default('monthly'),
  every: z.coerce.number().int().min(1).max(365).default(1),
  nextDate: date,
  endDate: optDate,
  autoPost: z.boolean().default(true),
  active: z.boolean().default(true),
});

const SELECT = `SELECT r.id, r.kind, r.name, r.amount, r.frequency, r.every, r.next_date AS "nextDate", r.end_date AS "endDate",
  r.anchor_day AS "anchorDay", r.auto_post AS "autoPost", r.active,
  r.category_id AS "categoryId", c.name AS "categoryName", c.icon AS "categoryIcon", c.color AS "categoryColor",
  r.account_id AS "accountId", a.name AS "accountName",
  (SELECT MAX(occurred_on) FROM transactions t WHERE t.recurring_id = r.id) AS "lastPosted"
  FROM recurring_rules r
  LEFT JOIN categories c ON c.id = r.category_id
  LEFT JOIN accounts a ON a.id = r.account_id`;

const withMonthly = (r) => ({ ...r, monthlyAmount: Math.round(monthlyEquivalent(r) * 100) / 100 });
const dayOf = (iso) => Number(iso.slice(8, 10));

router.get('/', async (req, res) => {
  await processRecurring(req.userId, req.today);
  const rows = await many(`${SELECT} WHERE r.user_id = $1 ORDER BY r.active DESC, r.next_date`, [req.userId]);
  res.json(rows.map(withMonthly));
});

router.post('/process', async (req, res) => {
  res.json({ created: await processRecurring(req.userId, req.today) });
});

router.post('/', async (req, res) => {
  const b = parse(schema, req.body);
  if (b.endDate && b.endDate < b.nextDate) throw badRequest('endDate: must be after the start date');
  await assertOwned(req.userId, { categories: b.categoryId, accounts: b.accountId });
  const { id: newId } = await one(
    `INSERT INTO recurring_rules (user_id, kind, name, amount, category_id, account_id, frequency, every, next_date, end_date, anchor_day, auto_post, active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
    [req.userId, b.kind, b.name, b.amount, b.categoryId, b.accountId, b.frequency, b.every, b.nextDate, b.endDate,
      dayOf(b.nextDate), b.autoPost, b.active],
  );
  await processRecurring(req.userId, req.today);
  res.status(201).json(withMonthly(await one(`${SELECT} WHERE r.id = $1`, [newId])));
});

router.patch('/:id', async (req, res) => {
  const ruleId = parse(id, req.params.id);
  const patch = parsePatch(schema, req.body);
  await assertOwned(req.userId, { categories: patch.categoryId, accounts: patch.accountId });
  if (patch.nextDate) patch.anchorDay = dayOf(patch.nextDate);
  const { sets, values } = setClause(patch, {
    kind: 'kind', name: 'name', amount: 'amount', categoryId: 'category_id', accountId: 'account_id', frequency: 'frequency',
    every: 'every', nextDate: 'next_date', endDate: 'end_date', anchorDay: 'anchor_day', autoPost: 'auto_post', active: 'active',
  }, 3);
  const row = await one(`UPDATE recurring_rules SET ${['id = id', ...sets].join(', ')} WHERE id = $1 AND user_id = $2 RETURNING id`,
    [ruleId, req.userId, ...values]);
  if (!row) throw notFound('Recurring item');
  await processRecurring(req.userId, req.today);
  res.json(withMonthly(await one(`${SELECT} WHERE r.id = $1`, [ruleId])));
});

// Manually post (or skip) the next occurrence — for bills you confirm by hand.
const step = (action) => async (req, res) => {
  const ruleId = parse(id, req.params.id);
  await tx(async (c) => {
    const { rows: [r] } = await c.query('SELECT * FROM recurring_rules WHERE id = $1 AND user_id = $2 FOR UPDATE', [ruleId, req.userId]);
    if (!r) throw notFound('Recurring item');
    if (action === 'post') {
      await c.query(
        `INSERT INTO transactions (user_id, kind, amount, category_id, account_id, occurred_on, note, recurring_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [req.userId, r.kind, r.amount, r.category_id, r.account_id, r.next_date > req.today ? req.today : r.next_date, r.name, r.id],
      );
    }
    const next = advance(r.next_date, r.frequency, r.every, r.anchor_day);
    await c.query('UPDATE recurring_rules SET next_date = $2, active = $3 WHERE id = $1',
      [r.id, next, !(r.end_date && next > r.end_date)]);
  });
  res.json(withMonthly(await one(`${SELECT} WHERE r.id = $1`, [ruleId])));
};
router.post('/:id/post', step('post'));
router.post('/:id/skip', step('skip'));

router.delete('/:id', async (req, res) => {
  const row = await one('DELETE FROM recurring_rules WHERE id = $1 AND user_id = $2 RETURNING id', [parse(id, req.params.id), req.userId]);
  if (!row) throw notFound('Recurring item');
  res.status(204).end();
});

export default router;
