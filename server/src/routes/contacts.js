import { Router } from 'express';
import { z } from 'zod';
import { many, one, tx } from '../db/pool.js';
import { parse, parsePatch, setClause, id, optText } from '../lib/validate.js';
import { notFound, HttpError } from '../lib/errors.js';
import { dueSelect } from '../lib/dueSql.js';

const router = Router();

const schema = z.object({
  name: z.string().trim().min(1).max(120),
  phone: optText(40),
  email: optText(160),
  company: optText(120),
  notes: optText(2000),
});

const LIST = `SELECT c.id, c.name, c.phone, c.email, c.company, c.notes, c.created_at AS "createdAt",
  COALESCE(SUM(ds.outstanding) FILTER (WHERE ds.direction = 'receivable'), 0) AS receivable,
  COALESCE(SUM(ds.outstanding) FILTER (WHERE ds.direction = 'payable'), 0) AS payable,
  COUNT(ds.id) FILTER (WHERE ds.outstanding > 0)::int AS "openCount",
  COUNT(ds.id) FILTER (WHERE ds.outstanding > 0 AND ds.due_date < $2::date)::int AS "overdueCount",
  MAX(GREATEST(ds.created_at::date, COALESCE(ds.last_paid_on, ds.created_at::date))) AS "lastActivity"
  FROM contacts c LEFT JOIN dues_summary ds ON ds.contact_id = c.id`;

router.get('/', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const rows = await many(
    `${LIST} WHERE c.user_id = $1 AND ($3 = '' OR c.name ILIKE '%' || $3 || '%' OR c.company ILIKE '%' || $3 || '%' OR c.phone ILIKE '%' || $3 || '%')
     GROUP BY c.id ORDER BY c.name`,
    [req.userId, req.today, q],
  );
  res.json(rows.map((r) => ({ ...r, net: r.receivable - r.payable })));
});

router.get('/:id', async (req, res) => {
  const contactId = parse(id, req.params.id);
  const c = await one(`${LIST} WHERE c.user_id = $1 AND c.id = $3 GROUP BY c.id`, [req.userId, req.today, contactId]);
  if (!c) throw notFound('Contact');
  const dues = await many(
    `${dueSelect('$2')} WHERE ds.user_id = $1 AND ds.contact_id = $3 ORDER BY ds.issue_date DESC, ds.created_at DESC`,
    [req.userId, req.today, contactId],
  );
  // Statement: every event that changed the balance with this person, oldest first.
  const statement = await many(
    `SELECT * FROM (
       SELECT 'due' AS type, d.id, d.id AS "dueId", d.direction, d.title AS label, d.amount, d.issue_date AS date, d.created_at
       FROM dues d WHERE d.user_id = $1 AND d.contact_id = $2
       UNION ALL
       SELECT 'payment', p.id, d.id, d.direction, COALESCE(p.note, 'Payment · ' || d.title), p.amount, p.paid_on, p.created_at
       FROM due_payments p JOIN dues d ON d.id = p.due_id WHERE d.user_id = $1 AND d.contact_id = $2
     ) s ORDER BY date, created_at`,
    [req.userId, contactId],
  );
  let running = 0; // positive => they owe you
  const ledger = statement.map((e) => {
    const sign = e.direction === 'receivable' ? 1 : -1;
    running += (e.type === 'due' ? 1 : -1) * sign * e.amount;
    return { ...e, balance: Math.round(running * 100) / 100 };
  });
  res.json({ ...c, net: c.receivable - c.payable, dues, ledger: ledger.reverse() });
});

router.post('/', async (req, res) => {
  const b = parse(schema, req.body);
  const row = await one(
    `INSERT INTO contacts (user_id, name, phone, email, company, notes) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, name, phone, email, company, notes`,
    [req.userId, b.name, b.phone, b.email, b.company, b.notes],
  );
  res.status(201).json({ ...row, receivable: 0, payable: 0, net: 0, openCount: 0, overdueCount: 0 });
});

router.patch('/:id', async (req, res) => {
  const contactId = parse(id, req.params.id);
  const patch = parsePatch(schema, req.body);
  const { sets, values } = setClause(patch, { name: 'name', phone: 'phone', email: 'email', company: 'company', notes: 'notes' }, 3);
  const row = await one(
    `UPDATE contacts SET ${['id = id', ...sets].join(', ')} WHERE id = $1 AND user_id = $2 RETURNING id, name, phone, email, company, notes`,
    [contactId, req.userId, ...values],
  );
  if (!row) throw notFound('Contact');
  res.json(row);
});

router.delete('/:id', async (req, res) => {
  const contactId = parse(id, req.params.id);
  const { n } = await one('SELECT COUNT(*)::int AS n FROM dues WHERE contact_id = $1 AND user_id = $2', [contactId, req.userId]);
  if (n > 0 && req.query.force !== 'true') {
    throw new HttpError(409, `This contact has ${n} receivable/payable record(s). Delete them first or confirm force delete.`);
  }
  const row = await tx(async (c) => {
    await c.query('DELETE FROM dues WHERE contact_id = $1 AND user_id = $2', [contactId, req.userId]);
    const { rows } = await c.query('DELETE FROM contacts WHERE id = $1 AND user_id = $2 RETURNING id', [contactId, req.userId]);
    return rows[0];
  });
  if (!row) throw notFound('Contact');
  res.status(204).end();
});

export default router;
