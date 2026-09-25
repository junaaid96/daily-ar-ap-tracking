import { Router } from 'express';
import { z } from 'zod';
import { many, one, tx } from '../db/pool.js';
import { parse, parsePatch, setClause, id, money, date, optDate, optText, optId, color } from '../lib/validate.js';
import { notFound, badRequest } from '../lib/errors.js';
import { assertOwned } from '../lib/ownership.js';
import { daysBetween } from '../lib/dates.js';

const router = Router();

const schema = z.object({
  name: z.string().trim().min(1).max(120),
  targetAmount: money,
  targetDate: optDate,
  icon: z.string().trim().min(1).max(40).default('piggy-bank'),
  color: color.default('#8b5cf6'),
  archived: z.boolean().default(false),
  // Optional first deposit when creating the goal.
  initialAmount: z.coerce.number().finite().min(0).optional(),
  accountId: optId,
});

const contributionSchema = z.object({
  type: z.enum(['deposit', 'withdraw']).default('deposit'),
  amount: money,
  accountId: optId,
  date: date.optional(),
  note: optText(300),
});

const SELECT = `SELECT g.id, g.name, g.target_amount AS "targetAmount", g.target_date AS "targetDate", g.icon, g.color,
  g.archived, g.created_at AS "createdAt",
  COALESCE(s.saved, 0)::float AS saved, s.last_on AS "lastContribution",
  COALESCE(s.last30, 0)::float AS "last30"
  FROM savings_goals g
  LEFT JOIN LATERAL (
    SELECT SUM(amount) AS saved, MAX(contributed_on) AS last_on,
      SUM(amount) FILTER (WHERE contributed_on > $2::date - 30) AS last30
    FROM savings_contributions sc WHERE sc.goal_id = g.id
  ) s ON true`;

export function enrichGoal(g, today) {
  const remaining = Math.max(g.targetAmount - g.saved, 0);
  const progress = Math.min(g.saved / g.targetAmount, 1);
  let monthlyNeeded = null;
  let daysLeft = null;
  if (g.targetDate) {
    daysLeft = daysBetween(today, g.targetDate);
    const months = Math.max(daysLeft / 30.4375, 1 / 30.4375);
    monthlyNeeded = remaining > 0 ? Math.round((remaining / months) * 100) / 100 : 0;
  }
  // Projected completion based on the last 30 days' pace.
  let projectedDate = null;
  if (remaining > 0 && g.last30 > 0) {
    const days = Math.ceil(remaining / (g.last30 / 30));
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    projectedDate = d.toISOString().slice(0, 10);
  }
  const onTrack = !g.targetDate || remaining === 0 || (projectedDate !== null && projectedDate <= g.targetDate);
  return { ...g, remaining, progress, monthlyNeeded, daysLeft, projectedDate, onTrack, completed: remaining === 0 };
}

router.get('/', async (req, res) => {
  const rows = await many(`${SELECT} WHERE g.user_id = $1 ORDER BY g.archived, g.created_at`, [req.userId, req.today]);
  res.json(rows.map((g) => enrichGoal(g, req.today)));
});

router.get('/:id', async (req, res) => {
  const goalId = parse(id, req.params.id);
  const g = await one(`${SELECT} WHERE g.user_id = $1 AND g.id = $3`, [req.userId, req.today, goalId]);
  if (!g) throw notFound('Goal');
  const contributions = await many(
    `SELECT sc.id, sc.amount, sc.contributed_on AS date, sc.note, a.name AS "accountName"
     FROM savings_contributions sc LEFT JOIN accounts a ON a.id = sc.account_id
     WHERE sc.goal_id = $1 ORDER BY sc.contributed_on DESC, sc.created_at DESC`, [goalId]);
  res.json({ ...enrichGoal(g, req.today), contributions });
});

router.post('/', async (req, res) => {
  const b = parse(schema, req.body);
  await assertOwned(req.userId, { accounts: b.accountId });
  const goalId = await tx(async (c) => {
    const { rows: [g] } = await c.query(
      `INSERT INTO savings_goals (user_id, name, target_amount, target_date, icon, color) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [req.userId, b.name, b.targetAmount, b.targetDate, b.icon, b.color]);
    if (b.initialAmount > 0) {
      await c.query(
        `INSERT INTO savings_contributions (user_id, goal_id, account_id, amount, contributed_on, note) VALUES ($1,$2,$3,$4,$5,'Initial deposit')`,
        [req.userId, g.id, b.accountId, b.initialAmount, req.today]);
    }
    return g.id;
  });
  const g = await one(`${SELECT} WHERE g.id = $1`, [goalId, req.today]);
  res.status(201).json(enrichGoal(g, req.today));
});

router.patch('/:id', async (req, res) => {
  const goalId = parse(id, req.params.id);
  const patch = parsePatch(schema.omit({ initialAmount: true, accountId: true }), req.body);
  const { sets, values } = setClause(patch, {
    name: 'name', targetAmount: 'target_amount', targetDate: 'target_date', icon: 'icon', color: 'color', archived: 'archived',
  }, 3);
  const row = await one(`UPDATE savings_goals SET ${['id = id', ...sets].join(', ')} WHERE id = $1 AND user_id = $2 RETURNING id`,
    [goalId, req.userId, ...values]);
  if (!row) throw notFound('Goal');
  res.json(enrichGoal(await one(`${SELECT} WHERE g.id = $1`, [goalId, req.today]), req.today));
});

router.delete('/:id', async (req, res) => {
  const row = await one('DELETE FROM savings_goals WHERE id = $1 AND user_id = $2 RETURNING id', [parse(id, req.params.id), req.userId]);
  if (!row) throw notFound('Goal');
  res.status(204).end();
});

router.post('/:id/contributions', async (req, res) => {
  const goalId = parse(id, req.params.id);
  const b = parse(contributionSchema, req.body);
  await assertOwned(req.userId, { savings_goals: goalId, accounts: b.accountId });
  await tx(async (c) => {
    const { rows: [g] } = await c.query(
      `SELECT COALESCE((SELECT SUM(amount) FROM savings_contributions WHERE goal_id = $1), 0) AS saved
       FROM savings_goals WHERE id = $1 FOR UPDATE`, [goalId]);
    const signed = b.type === 'withdraw' ? -b.amount : b.amount;
    if (b.type === 'withdraw' && b.amount > g.saved + 0.001) throw badRequest(`amount: only ${g.saved} is saved in this goal`);
    await c.query(
      `INSERT INTO savings_contributions (user_id, goal_id, account_id, amount, contributed_on, note) VALUES ($1,$2,$3,$4,$5,$6)`,
      [req.userId, goalId, b.accountId, signed, b.date || req.today, b.note]);
  });
  res.status(201).json(enrichGoal(await one(`${SELECT} WHERE g.id = $1`, [goalId, req.today]), req.today));
});

router.delete('/:id/contributions/:cid', async (req, res) => {
  const goalId = parse(id, req.params.id);
  const row = await one('DELETE FROM savings_contributions WHERE id = $1 AND goal_id = $2 AND user_id = $3 RETURNING id',
    [parse(id, req.params.cid), goalId, req.userId]);
  if (!row) throw notFound('Contribution');
  res.json(enrichGoal(await one(`${SELECT} WHERE g.id = $1`, [goalId, req.today]), req.today));
});

export default router;
