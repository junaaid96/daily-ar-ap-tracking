import { Router } from 'express';
import { z } from 'zod';
import { many, one } from '../db/pool.js';
import { parse, date } from '../lib/validate.js';
import { addDays, monthRange, daysBetween } from '../lib/dates.js';
import { agingSelect, shapeAging, dueSelect } from '../lib/dueSql.js';
import { toCsv } from '../lib/csv.js';

const router = Router();
const round = (n) => Math.round(n * 100) / 100;

router.get('/trend', async (req, res) => {
  const { months } = parse(z.object({ months: z.coerce.number().int().min(1).max(36).default(12) }), req.query);
  const first = `${req.today.slice(0, 7)}-01`;
  const rows = await many(
    `WITH m AS (
       SELECT to_char(d, 'YYYY-MM') AS month FROM generate_series(($2::date - make_interval(months => $3 - 1)), $2::date, '1 month') d
     )
     SELECT m.month,
       COALESCE((SELECT SUM(amount) FROM transactions t WHERE t.user_id = $1 AND t.kind='income' AND to_char(t.occurred_on,'YYYY-MM') = m.month),0)::float AS income,
       COALESCE((SELECT SUM(amount) FROM transactions t WHERE t.user_id = $1 AND t.kind='expense' AND to_char(t.occurred_on,'YYYY-MM') = m.month),0)::float AS expense,
       COALESCE((SELECT SUM(amount) FROM savings_contributions s WHERE s.user_id = $1 AND to_char(s.contributed_on,'YYYY-MM') = m.month),0)::float AS saved,
       COALESCE((SELECT SUM(p.amount) FROM due_payments p JOIN dues d ON d.id = p.due_id WHERE p.user_id = $1 AND d.direction='receivable' AND to_char(p.paid_on,'YYYY-MM') = m.month),0)::float AS collected,
       COALESCE((SELECT SUM(p.amount) FROM due_payments p JOIN dues d ON d.id = p.due_id WHERE p.user_id = $1 AND d.direction='payable' AND to_char(p.paid_on,'YYYY-MM') = m.month),0)::float AS repaid
     FROM m ORDER BY m.month`,
    [req.userId, first, months],
  );
  res.json(rows.map((r) => ({ ...r, net: round(r.income - r.expense), savingsRate: r.income > 0 ? (r.income - r.expense) / r.income : null })));
});

const rangeSchema = z.object({ from: date.optional(), to: date.optional(), kind: z.enum(['expense', 'income']).default('expense') });

router.get('/categories', async (req, res) => {
  const f = parse(rangeSchema, req.query);
  const from = f.from || `${req.today.slice(0, 7)}-01`;
  const to = f.to || req.today;
  const rows = await many(
    `SELECT c.id, COALESCE(c.name,'Uncategorized') AS name, COALESCE(c.color,'#94a3b8') AS color, COALESCE(c.icon,'circle') AS icon,
       SUM(t.amount)::float AS total, COUNT(*)::int AS count, AVG(t.amount)::float AS average
     FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
     WHERE t.user_id = $1 AND t.kind = $2 AND t.occurred_on BETWEEN $3 AND $4
     GROUP BY c.id ORDER BY total DESC`, [req.userId, f.kind, from, to]);
  const total = rows.reduce((s, r) => s + r.total, 0);
  res.json({ from, to, total, items: rows.map((r) => ({ ...r, share: total ? r.total / total : 0 })) });
});

router.get('/heatmap', async (req, res) => {
  const { days } = parse(z.object({ days: z.coerce.number().int().min(7).max(400).default(182) }), req.query);
  const from = addDays(req.today, -(days - 1));
  res.json(await many(
    `SELECT d::date::text AS date, COALESCE(SUM(t.amount),0)::float AS expense, COUNT(t.id)::int AS count
     FROM generate_series($2::date, $3::date, '1 day') d
     LEFT JOIN transactions t ON t.user_id = $1 AND t.kind = 'expense' AND t.occurred_on = d::date
     GROUP BY d ORDER BY d`, [req.userId, from, req.today]));
});

router.get('/weekday', async (req, res) => {
  res.json(await many(
    `SELECT EXTRACT(ISODOW FROM occurred_on)::int AS dow, ROUND(SUM(amount) / GREATEST(COUNT(DISTINCT occurred_on),1), 2)::float AS "avgPerActiveDay",
       SUM(amount)::float AS total
     FROM transactions WHERE user_id = $1 AND kind = 'expense' AND occurred_on > $2::date - 90
     GROUP BY 1 ORDER BY 1`, [req.userId, req.today]));
});

router.get('/aging', async (req, res) => {
  const [aging, overdue] = await Promise.all([
    many(`${agingSelect('$2')} WHERE ds.user_id = $1 AND ds.outstanding > 0 GROUP BY ds.direction`, [req.userId, req.today]),
    many(`${dueSelect('$2')} WHERE ds.user_id = $1 AND ds.outstanding > 0 ORDER BY ds.direction, ds.due_date NULLS LAST`, [req.userId, req.today]),
  ]);
  if (req.query.format === 'csv') {
    const csv = toCsv(overdue.map((d) => ({ ...d, contactName: d.contact.name })), [
      ['direction', 'Type'], ['contactName', 'Contact'], ['title', 'Title'], ['reference', 'Reference'], ['issueDate', 'Issued'],
      ['dueDate', 'Due'], ['amount', 'Amount'], ['paidAmount', 'Paid'], ['outstanding', 'Outstanding'], ['daysOverdue', 'Days overdue'], ['status', 'Status']]);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="aging-${req.today}.csv"`);
    return res.send(`﻿${csv}`);
  }
  res.json({ ...shapeAging(aging), items: overdue });
});

// Plain-language observations about this month vs last month.
router.get('/insights', async (req, res) => {
  const uid = req.userId;
  const today = req.today;
  const cur = monthRange(today.slice(0, 7));
  const prev = monthRange(addDays(cur.start, -1).slice(0, 7));
  const elapsed = daysBetween(cur.start, today) + 1;
  const prevTo = addDays(prev.start, Math.min(elapsed, prev.days) - 1);

  const [cats, biggest, totals, dues, weekday] = await Promise.all([
    many(`SELECT COALESCE(c.name,'Uncategorized') AS name,
            COALESCE(SUM(t.amount) FILTER (WHERE t.occurred_on BETWEEN $2 AND $3),0)::float AS cur,
            COALESCE(SUM(t.amount) FILTER (WHERE t.occurred_on BETWEEN $4 AND $5),0)::float AS prev
          FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
          WHERE t.user_id = $1 AND t.kind = 'expense' AND t.occurred_on BETWEEN $4 AND $3
          GROUP BY c.name`, [uid, cur.start, today, prev.start, prevTo]),
    one(`SELECT t.amount, t.note, t.occurred_on AS date, c.name AS category FROM transactions t
         LEFT JOIN categories c ON c.id = t.category_id
         WHERE t.user_id = $1 AND t.kind='expense' AND t.occurred_on BETWEEN $2 AND $3 ORDER BY t.amount DESC LIMIT 1`, [uid, cur.start, today]),
    one(`SELECT COALESCE(SUM(amount) FILTER (WHERE kind='expense' AND occurred_on BETWEEN $2 AND $3),0)::float AS cur,
            COALESCE(SUM(amount) FILTER (WHERE kind='expense' AND occurred_on BETWEEN $4 AND $5),0)::float AS prev,
            COALESCE(SUM(amount) FILTER (WHERE kind='income' AND occurred_on BETWEEN $2 AND $3),0)::float AS income
         FROM transactions WHERE user_id = $1`, [uid, cur.start, today, prev.start, prevTo]),
    one(`SELECT COUNT(*) FILTER (WHERE direction='receivable' AND due_date < $2)::int AS overdue_r,
            COALESCE(SUM(outstanding) FILTER (WHERE direction='receivable' AND due_date < $2),0)::float AS overdue_r_amt,
            COUNT(*) FILTER (WHERE direction='payable' AND due_date BETWEEN $2 AND $2::date + 7)::int AS soon_p,
            COALESCE(SUM(outstanding) FILTER (WHERE direction='payable' AND due_date BETWEEN $2 AND $2::date + 7),0)::float AS soon_p_amt
         FROM dues_summary WHERE user_id = $1 AND outstanding > 0`, [uid, today]),
    one(`SELECT to_char(occurred_on, 'FMDay') AS day, SUM(amount)::float AS total FROM transactions
         WHERE user_id = $1 AND kind='expense' AND occurred_on > $2::date - 90 GROUP BY 1 ORDER BY 2 DESC LIMIT 1`, [uid, today]),
  ]);

  const insights = [];
  if (totals.prev > 0) {
    const change = (totals.cur - totals.prev) / totals.prev;
    insights.push({
      tone: change > 0.1 ? 'warning' : change < -0.1 ? 'positive' : 'neutral',
      icon: change > 0 ? 'trending-up' : 'trending-down',
      title: `Spending is ${change >= 0 ? 'up' : 'down'} ${Math.abs(Math.round(change * 100))}% vs last month`,
      body: `Compared with the same ${elapsed} days last month.`,
      value: { cur: totals.cur, prev: totals.prev },
    });
  }
  const movers = cats.filter((c) => c.prev > 0 || c.cur > 0)
    .map((c) => ({ ...c, delta: c.cur - c.prev }))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  if (movers[0] && Math.abs(movers[0].delta) > 0) {
    const m = movers[0];
    insights.push({
      tone: m.delta > 0 ? 'warning' : 'positive', icon: 'shapes',
      title: `${m.name} ${m.delta > 0 ? 'rose' : 'fell'} the most`,
      body: m.prev > 0 ? `${m.delta > 0 ? '+' : '−'}${Math.abs(Math.round((m.delta / m.prev) * 100))}% compared with last month so far.` : 'New spending in this category this month.',
      value: { cur: m.cur, prev: m.prev, delta: m.delta },
    });
  }
  if (totals.income > 0) {
    const rate = (totals.income - totals.cur) / totals.income;
    insights.push({
      tone: rate >= 0.2 ? 'positive' : rate < 0 ? 'danger' : 'neutral', icon: 'piggy-bank',
      title: `You're keeping ${Math.round(rate * 100)}% of your income`,
      body: rate >= 0.2 ? 'Great savings rate — above the 20% rule of thumb.' : rate < 0 ? 'You are spending more than you earn this month.' : 'Aim for 20% to build a healthy cushion.',
      value: { rate },
    });
  }
  if (biggest) {
    insights.push({ tone: 'neutral', icon: 'receipt', title: 'Largest expense this month',
      body: biggest.note || biggest.category || 'Expense', value: { amount: biggest.amount, date: biggest.date } });
  }
  if (dues.overdue_r > 0) {
    insights.push({ tone: 'danger', icon: 'alarm-clock', title: `${dues.overdue_r} receivable${dues.overdue_r > 1 ? 's are' : ' is'} overdue`,
      body: 'Send a friendly reminder from the Receivables page.', value: { amount: dues.overdue_r_amt }, link: '/receivables?status=overdue' });
  }
  if (dues.soon_p > 0) {
    insights.push({ tone: 'warning', icon: 'calendar-clock', title: `${dues.soon_p} payment${dues.soon_p > 1 ? 's' : ''} due within 7 days`,
      body: 'Plan ahead so nothing slips.', value: { amount: dues.soon_p_amt }, link: '/payables' });
  }
  if (weekday) {
    insights.push({ tone: 'neutral', icon: 'calendar-days', title: `${weekday.day.trim()} is your biggest spending day`,
      body: 'Based on the last 90 days.', value: { amount: weekday.total } });
  }
  res.json(insights);
});

export default router;
