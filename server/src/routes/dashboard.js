import { Router } from 'express';
import { many, one } from '../db/pool.js';
import { monthRange, addDays, daysBetween } from '../lib/dates.js';
import { dueSelect, agingSelect, shapeAging } from '../lib/dueSql.js';
import { processRecurring, expandOccurrences } from '../lib/recurring.js';
import { enrichGoal } from './goals.js';

const router = Router();

const round = (n) => Math.round(n * 100) / 100;

router.get('/', async (req, res) => {
  const uid = req.userId;
  const today = req.today;
  await processRecurring(uid, today);

  const ym = today.slice(0, 7);
  const { start, end, days } = monthRange(ym);
  const prev = monthRange(addDays(start, -1).slice(0, 7));
  const elapsed = daysBetween(start, today) + 1;
  const daysLeft = days - elapsed + 1;
  const horizon = addDays(today, 30);

  const [accounts, aging, month, prevMonth, todaySpend, daily, byCategory, dues, goals, recent, rules, budget, streakRows] =
    await Promise.all([
      many(`SELECT a.id, a.name, a.kind, a.color, b.balance FROM accounts a JOIN account_balances b ON b.id = a.id
            WHERE a.user_id = $1 AND NOT a.archived ORDER BY a.created_at`, [uid]),
      many(`${agingSelect('$2')} WHERE ds.user_id = $1 AND ds.outstanding > 0 GROUP BY ds.direction`, [uid, today]),
      one(`SELECT COALESCE(SUM(amount) FILTER (WHERE kind='income'),0)::float AS income,
                  COALESCE(SUM(amount) FILTER (WHERE kind='expense'),0)::float AS expense
           FROM transactions WHERE user_id = $1 AND occurred_on BETWEEN $2 AND $3`, [uid, start, end]),
      one(`SELECT COALESCE(SUM(amount) FILTER (WHERE kind='income'),0)::float AS income,
                  COALESCE(SUM(amount) FILTER (WHERE kind='expense'),0)::float AS expense
           FROM transactions WHERE user_id = $1 AND occurred_on BETWEEN $2 AND $3`, [uid, prev.start, addDays(prev.start, Math.min(elapsed, prev.days) - 1)]),
      one(`SELECT COALESCE(SUM(amount),0)::float AS spent, COUNT(*)::int AS count FROM transactions
           WHERE user_id = $1 AND kind = 'expense' AND occurred_on = $2`, [uid, today]),
      many(`SELECT d::date::text AS date,
              COALESCE(SUM(t.amount) FILTER (WHERE t.kind='income'),0)::float AS income,
              COALESCE(SUM(t.amount) FILTER (WHERE t.kind='expense'),0)::float AS expense
            FROM generate_series($2::date, $3::date, '1 day') d
            LEFT JOIN transactions t ON t.user_id = $1 AND t.occurred_on = d::date
            GROUP BY d ORDER BY d`, [uid, start, end]),
      many(`SELECT c.id, COALESCE(c.name,'Uncategorized') AS name, COALESCE(c.color,'#94a3b8') AS color, COALESCE(c.icon,'circle') AS icon,
              SUM(t.amount)::float AS total
            FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
            WHERE t.user_id = $1 AND t.kind='expense' AND t.occurred_on BETWEEN $2 AND $3
            GROUP BY c.id ORDER BY total DESC`, [uid, start, end]),
      many(`${dueSelect('$2')} WHERE ds.user_id = $1 AND ds.outstanding > 0 AND ds.due_date IS NOT NULL
            AND ds.due_date <= $3 ORDER BY ds.due_date LIMIT 60`, [uid, today, horizon]),
      many(`SELECT g.id, g.name, g.target_amount AS "targetAmount", g.target_date AS "targetDate", g.icon, g.color, g.archived,
              COALESCE(SUM(sc.amount),0)::float AS saved,
              COALESCE(SUM(sc.amount) FILTER (WHERE sc.contributed_on > $2::date - 30),0)::float AS last30
            FROM savings_goals g LEFT JOIN savings_contributions sc ON sc.goal_id = g.id
            WHERE g.user_id = $1 AND NOT g.archived GROUP BY g.id ORDER BY g.created_at`, [uid, today]),
      many(`SELECT t.id, t.kind, t.amount, t.occurred_on AS "occurredOn", t.note,
              c.name AS "categoryName", c.icon AS "categoryIcon", c.color AS "categoryColor", a.name AS "accountName"
            FROM transactions t LEFT JOIN categories c ON c.id = t.category_id LEFT JOIN accounts a ON a.id = t.account_id
            WHERE t.user_id = $1 ORDER BY t.occurred_on DESC, t.created_at DESC LIMIT 8`, [uid]),
      many(`SELECT r.id, r.kind, r.name, r.amount, r.frequency, r.every, r.next_date AS "nextDate", r.end_date AS "endDate",
              r.anchor_day AS "anchorDay", r.auto_post AS "autoPost", c.icon AS "categoryIcon", c.color AS "categoryColor"
            FROM recurring_rules r LEFT JOIN categories c ON c.id = r.category_id
            WHERE r.user_id = $1 AND r.active`, [uid]),
      one(`SELECT COALESCE(SUM(c.monthly_budget),0)::float AS total,
              COALESCE(SUM(s.spent) FILTER (WHERE c.monthly_budget IS NOT NULL),0)::float AS spent
            FROM categories c LEFT JOIN LATERAL (
              SELECT SUM(amount) AS spent FROM transactions t WHERE t.category_id = c.id AND t.occurred_on BETWEEN $2 AND $3
            ) s ON true WHERE c.user_id = $1 AND c.kind = 'expense'`, [uid, start, end]),
      many(`SELECT DISTINCT occurred_on AS d FROM transactions WHERE user_id = $1 AND occurred_on > $2::date - 400
            AND occurred_on <= $2 ORDER BY d DESC`, [uid, today]),
    ]);

  const agingShaped = shapeAging(aging);
  const cash = round(accounts.reduce((s, a) => s + a.balance, 0));
  const goalsEnriched = goals.map((g) => enrichGoal(g, today));
  const savings = round(goalsEnriched.reduce((s, g) => s + g.saved, 0));
  const receivable = agingShaped.receivable.total;
  const payable = agingShaped.payable.total;

  // ---- Logging streak & no-spend days -------------------------------------
  const logged = new Set(streakRows.map((r) => r.d));
  let streak = 0;
  for (let d = logged.has(today) ? today : addDays(today, -1); logged.has(d); d = addDays(d, -1)) streak++;
  const noSpendDays = daily.filter((d) => d.date <= today && d.expense === 0).length;

  // ---- 30-day cash forecast -----------------------------------------------
  const occurrences = expandOccurrences(rules, addDays(today, 1), horizon);
  const flows = new Map();
  const bump = (date, key, amt) => {
    const f = flows.get(date) || { inflow: 0, outflow: 0, items: [] };
    f[key] += amt;
    flows.set(date, f);
    return f;
  };
  for (const d of dues) {
    // Overdue payables are assumed to go out today; overdue receivables are not counted on (uncertain).
    if (d.dueDate < today && d.direction === 'receivable') continue;
    const date = d.dueDate < today ? today : d.dueDate;
    bump(date, d.direction === 'receivable' ? 'inflow' : 'outflow', d.outstanding).items.push(d.title);
  }
  for (const o of occurrences) {
    bump(o.date, o.rule.kind === 'income' ? 'inflow' : 'outflow', o.rule.amount).items.push(o.rule.name);
  }
  let bal = cash;
  const forecast = [];
  for (let i = 0; i <= 30; i++) {
    const date = addDays(today, i);
    const f = flows.get(date) || { inflow: 0, outflow: 0, items: [] };
    bal += f.inflow - f.outflow;
    forecast.push({ date, balance: round(bal), inflow: round(f.inflow), outflow: round(f.outflow), items: f.items });
  }
  const lowest = forecast.reduce((m, p) => (p.balance < m.balance ? p : m), forecast[0]);

  // ---- Safe to spend today ------------------------------------------------
  // With budgets: what's left of the budget spread over the remaining days.
  // Without: this month's income minus spending and committed outflows until month end.
  let safeToSpend;
  if (budget.total > 0) {
    safeToSpend = {
      basis: 'budget',
      amount: round(Math.max((budget.total - budget.spent + todaySpend.spent) / daysLeft - todaySpend.spent, 0)),
      perDay: round(Math.max(budget.total - budget.spent + todaySpend.spent, 0) / daysLeft),
    };
  } else {
    const committed = forecast.filter((p) => p.date <= end).reduce((s, p) => s + p.outflow, 0);
    const pool = Math.max(cash - committed, 0);
    safeToSpend = {
      basis: 'cash',
      amount: round(Math.max(pool / daysLeft - todaySpend.spent, 0)),
      perDay: round(pool / daysLeft),
    };
  }

  const upcomingRecurring = expandOccurrences(rules, today, addDays(today, 14)).slice(0, 8).map((o) => ({
    date: o.date, id: o.rule.id, name: o.rule.name, kind: o.rule.kind, amount: o.rule.amount,
    icon: o.rule.categoryIcon, color: o.rule.categoryColor, autoPost: o.rule.autoPost,
  }));

  res.json({
    today,
    month: { key: ym, start, end, days, elapsed, daysLeft, ...month, net: round(month.income - month.expense) },
    prevMonthToDate: prevMonth,
    todaySpend,
    totals: {
      cash, receivable, payable, savings,
      netWorth: round(cash + receivable - payable + savings),
      overdueReceivable: round(receivable - agingShaped.receivable.current),
      overduePayable: round(payable - agingShaped.payable.current),
    },
    aging: agingShaped,
    accounts,
    budget: { ...budget, remaining: round(budget.total - budget.spent) },
    safeToSpend,
    streak,
    noSpendDays,
    daily,
    byCategory,
    dues: {
      overdue: dues.filter((d) => d.status === 'overdue').slice(0, 8),
      upcoming: dues.filter((d) => d.status !== 'overdue' && d.dueDate <= addDays(today, 14)).slice(0, 8),
    },
    goals: goalsEnriched,
    recent,
    upcomingRecurring,
    forecast,
    forecastLow: lowest,
  });
});

export default router;
