import { Router } from 'express';
import { z } from 'zod';
import { many, one, tx } from '../db/pool.js';
import { parse, parsePatch, setClause, id, money, date, optDate, optText, optId } from '../lib/validate.js';
import { notFound, badRequest } from '../lib/errors.js';
import { assertOwned } from '../lib/ownership.js';
import { dueSelect, statusExpr, agingSelect, shapeAging } from '../lib/dueSql.js';

const router = Router();

const schema = z.object({
  direction: z.enum(['receivable', 'payable']),
  contactId: id.optional(),
  // Let the UI create a contact inline ("Owed by: new person…").
  contactName: z.string().trim().min(1).max(120).optional(),
  title: z.string().trim().min(1).max(160),
  notes: optText(2000),
  reference: optText(80),
  amount: money,
  issueDate: date.optional(),
  dueDate: optDate,
  accountId: optId,
}).refine((d) => d.contactId || d.contactName, { message: 'choose or create a contact', path: ['contactId'] });

const patchSchema = z.object({
  contactId: id,
  title: z.string().trim().min(1).max(160),
  notes: optText(2000),
  reference: optText(80),
  amount: money,
  issueDate: date,
  dueDate: optDate,
  accountId: optId,
  writtenOff: z.boolean(),
});

const paymentSchema = z.object({
  amount: money,
  paidOn: date.optional(),
  accountId: optId,
  note: optText(300),
});

const SORTS = {
  due: 'ds.due_date ASC NULLS LAST, ds.created_at DESC',
  newest: 'ds.issue_date DESC, ds.created_at DESC',
  amount: 'ds.outstanding DESC',
  overdue: '"daysOverdue" DESC, ds.due_date ASC NULLS LAST',
};

async function loadDue(userId, dueId, today) {
  const due = await one(`${dueSelect('$3')} WHERE ds.user_id = $1 AND ds.id = $2`, [userId, dueId, today]);
  if (!due) throw notFound('Record');
  due.payments = await many(
    `SELECT p.id, p.amount, p.paid_on AS "paidOn", p.note, p.account_id AS "accountId", a.name AS "accountName"
     FROM due_payments p LEFT JOIN accounts a ON a.id = p.account_id
     WHERE p.due_id = $1 ORDER BY p.paid_on DESC, p.created_at DESC`,
    [dueId],
  );
  return due;
}

router.get('/', async (req, res) => {
  const f = parse(z.object({
    direction: z.enum(['receivable', 'payable']).optional(),
    status: z.enum(['active', 'open', 'partial', 'overdue', 'paid', 'written_off', 'all']).default('active'),
    contactId: id.optional(),
    q: z.string().trim().max(100).optional(),
    sort: z.enum(Object.keys(SORTS)).default('due'),
    dueWithin: z.coerce.number().int().min(0).max(365).optional(),
  }), req.query);

  const where = ['ds.user_id = $1'];
  const params = [req.userId, req.today];
  const add = (sql, v) => { params.push(v); where.push(sql.replace('?', `$${params.length}`)); };
  if (f.direction) add('ds.direction = ?', f.direction);
  if (f.contactId) add('ds.contact_id = ?', f.contactId);
  if (f.q) add(`(ds.title ILIKE '%' || ? || '%' OR c.name ILIKE '%' || $${params.length + 1} || '%' OR ds.reference ILIKE '%' || $${params.length + 1} || '%')`, f.q);
  if (f.status === 'active') where.push('ds.outstanding > 0');
  else if (f.status !== 'all') add(`${statusExpr('$2')} = ?`, f.status);
  if (f.dueWithin !== undefined) add('ds.due_date <= $2::date + ?::int', f.dueWithin);

  const rows = await many(`${dueSelect('$2')} WHERE ${where.join(' AND ')} ORDER BY ${SORTS[f.sort]} LIMIT 500`, params);
  res.json(rows);
});

router.get('/aging', async (req, res) => {
  const rows = await many(`${agingSelect('$2')} WHERE ds.user_id = $1 AND ds.outstanding > 0 GROUP BY ds.direction`, [req.userId, req.today]);
  res.json(shapeAging(rows));
});

router.get('/:id', async (req, res) => {
  res.json(await loadDue(req.userId, parse(id, req.params.id), req.today));
});

router.post('/', async (req, res) => {
  const b = parse(schema, req.body);
  const issueDate = b.issueDate || req.today;
  if (b.dueDate && b.dueDate < issueDate) throw badRequest('dueDate: must be on or after the issue date');
  await assertOwned(req.userId, { contacts: b.contactId, accounts: b.accountId });

  const dueId = await tx(async (c) => {
    let contactId = b.contactId;
    if (!contactId) {
      const { rows: [existing] } = await c.query(
        'SELECT id FROM contacts WHERE user_id = $1 AND lower(name) = lower($2) LIMIT 1', [req.userId, b.contactName]);
      contactId = existing?.id ?? (await c.query(
        'INSERT INTO contacts (user_id, name) VALUES ($1, $2) RETURNING id', [req.userId, b.contactName])).rows[0].id;
    }
    const { rows: [d] } = await c.query(
      `INSERT INTO dues (user_id, contact_id, direction, title, notes, reference, amount, issue_date, due_date, account_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [req.userId, contactId, b.direction, b.title, b.notes, b.reference, b.amount, issueDate, b.dueDate, b.accountId],
    );
    return d.id;
  });
  res.status(201).json(await loadDue(req.userId, dueId, req.today));
});

router.patch('/:id', async (req, res) => {
  const dueId = parse(id, req.params.id);
  const patch = parsePatch(patchSchema, req.body);
  await assertOwned(req.userId, { contacts: patch.contactId, accounts: patch.accountId });
  const current = await loadDue(req.userId, dueId, req.today);
  if (patch.amount !== undefined && patch.amount < current.paidAmount) {
    throw badRequest(`amount: can't be less than what has already been paid (${current.paidAmount})`);
  }
  const issue = patch.issueDate ?? current.issueDate;
  const dueDate = 'dueDate' in patch ? patch.dueDate : current.dueDate;
  if (dueDate && dueDate < issue) throw badRequest('dueDate: must be on or after the issue date');

  const { sets, values } = setClause(patch, {
    contactId: 'contact_id', title: 'title', notes: 'notes', reference: 'reference', amount: 'amount',
    issueDate: 'issue_date', dueDate: 'due_date', accountId: 'account_id', writtenOff: 'written_off',
  }, 3);
  await one(`UPDATE dues SET ${['id = id', ...sets].join(', ')} WHERE id = $1 AND user_id = $2`, [dueId, req.userId, ...values]);
  res.json(await loadDue(req.userId, dueId, req.today));
});

router.delete('/:id', async (req, res) => {
  const row = await one('DELETE FROM dues WHERE id = $1 AND user_id = $2 RETURNING id', [parse(id, req.params.id), req.userId]);
  if (!row) throw notFound('Record');
  res.status(204).end();
});

async function addPayment(req, dueId, { amount, paidOn, accountId, note }, { settle = false } = {}) {
  await assertOwned(req.userId, { accounts: accountId });
  await tx(async (c) => {
    // Lock the due so two quick "record payment" clicks can't overpay it.
    const { rows: [d] } = await c.query(
      `SELECT d.amount, d.written_off, d.issue_date,
         d.amount - COALESCE((SELECT SUM(amount) FROM due_payments WHERE due_id = d.id), 0) AS remaining
       FROM dues d WHERE d.id = $1 AND d.user_id = $2 FOR UPDATE`, [dueId, req.userId]);
    if (!d) throw notFound('Record');
    if (d.written_off) throw badRequest('This record was written off. Restore it before adding payments.');
    const remaining = Math.round(d.remaining * 100) / 100;
    if (remaining <= 0) throw badRequest('This record is already fully settled');
    const pay = settle ? remaining : amount;
    if (pay > remaining + 0.001) throw badRequest(`amount: only ${remaining} is outstanding`, { amount: `max ${remaining}` });
    await c.query(
      `INSERT INTO due_payments (user_id, due_id, account_id, amount, paid_on, note) VALUES ($1,$2,$3,$4,$5,$6)`,
      [req.userId, dueId, accountId, pay, paidOn || req.today, note],
    );
  });
  return loadDue(req.userId, dueId, req.today);
}

router.post('/:id/payments', async (req, res) => {
  const dueId = parse(id, req.params.id);
  res.status(201).json(await addPayment(req, dueId, parse(paymentSchema, req.body)));
});

router.post('/:id/settle', async (req, res) => {
  const dueId = parse(id, req.params.id);
  const b = parse(paymentSchema.omit({ amount: true }), req.body ?? {});
  res.status(201).json(await addPayment(req, dueId, b, { settle: true }));
});

router.delete('/:id/payments/:paymentId', async (req, res) => {
  const dueId = parse(id, req.params.id);
  const row = await one(
    'DELETE FROM due_payments WHERE id = $1 AND due_id = $2 AND user_id = $3 RETURNING id',
    [parse(id, req.params.paymentId), dueId, req.userId],
  );
  if (!row) throw notFound('Payment');
  res.json(await loadDue(req.userId, dueId, req.today));
});

export default router;
