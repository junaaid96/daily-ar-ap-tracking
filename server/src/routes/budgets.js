import { Router } from 'express';
import { z } from 'zod';
import { many } from '../db/pool.js';
import { parse } from '../lib/validate.js';
import { monthRange, daysBetween } from '../lib/dates.js';

const router = Router();

router.get('/', async (req, res) => {
  const { month } = parse(z.object({
    month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  }), req.query);
  const ym = month || req.today.slice(0, 7);
  const { start, end, days } = monthRange(ym);
  const elapsed = req.today < start ? 0 : req.today > end ? days : daysBetween(start, req.today) + 1;

  const rows = await many(
    `SELECT c.id, c.name, c.icon, c.color, c.monthly_budget AS budget,
       COALESCE(SUM(t.amount), 0)::float AS spent, COUNT(t.id)::int AS count
     FROM categories c
     LEFT JOIN transactions t ON t.category_id = c.id AND t.occurred_on BETWEEN $2 AND $3
     WHERE c.user_id = $1 AND c.kind = 'expense'
     GROUP BY c.id ORDER BY (c.monthly_budget IS NULL), COALESCE(SUM(t.amount), 0) DESC, c.name`,
    [req.userId, start, end],
  );
  const items = rows.map((r) => {
    const projected = elapsed > 0 ? Math.round((r.spent / elapsed) * days * 100) / 100 : 0;
    return {
      ...r,
      remaining: r.budget === null ? null : Math.round((r.budget - r.spent) * 100) / 100,
      pct: r.budget ? r.spent / r.budget : null,
      projected,
      state: r.budget === null ? 'none' : r.spent > r.budget ? 'over' : projected > r.budget ? 'at-risk' : 'ok',
    };
  });
  const budgeted = items.filter((i) => i.budget !== null);
  const totalBudget = budgeted.reduce((s, i) => s + i.budget, 0);
  const budgetedSpent = budgeted.reduce((s, i) => s + i.spent, 0);
  const totalSpent = items.reduce((s, i) => s + i.spent, 0);
  const daysLeft = Math.max(days - elapsed + (elapsed > 0 && req.today <= end ? 1 : 0), 0);
  res.json({
    month: ym, start, end, days, elapsed, daysLeft,
    totalBudget, totalSpent, budgetedSpent,
    dailyAllowance: totalBudget > 0 && daysLeft > 0 ? Math.max((totalBudget - budgetedSpent) / daysLeft, 0) : null,
    items,
  });
});

export default router;
