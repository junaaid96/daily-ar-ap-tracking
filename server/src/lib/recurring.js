import { tx } from '../db/pool.js';
import { advance } from './dates.js';

const MAX_CATCH_UP = 120;

/**
 * Post every auto-post occurrence that has come due (catching up after
 * periods of inactivity) and move each rule's next_date forward.
 * Returns the number of transactions created.
 */
export async function processRecurring(userId, today) {
  return tx(async (c) => {
    const { rows: rules } = await c.query(
      `SELECT * FROM recurring_rules WHERE user_id = $1 AND active AND auto_post AND next_date <= $2 FOR UPDATE SKIP LOCKED`,
      [userId, today],
    );
    let created = 0;
    for (const r of rules) {
      let next = r.next_date;
      let active = true;
      for (let i = 0; next <= today && i < MAX_CATCH_UP; i++) {
        if (r.end_date && next > r.end_date) { active = false; break; }
        await c.query(
          `INSERT INTO transactions (user_id, kind, amount, category_id, account_id, occurred_on, note, recurring_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [userId, r.kind, r.amount, r.category_id, r.account_id, next, r.name, r.id],
        );
        created++;
        next = advance(next, r.frequency, r.every, r.anchor_day);
      }
      if (r.end_date && next > r.end_date) active = false;
      await c.query('UPDATE recurring_rules SET next_date = $2, active = $3 WHERE id = $1', [r.id, next, active]);
    }
    return created;
  });
}

/** Expand upcoming occurrences of active rules inside [from, to]. */
export function expandOccurrences(rules, from, to, limitPerRule = 62) {
  const out = [];
  for (const r of rules) {
    let d = r.nextDate;
    for (let i = 0; d <= to && i < limitPerRule; i++) {
      if (r.endDate && d > r.endDate) break;
      if (d >= from) out.push({ date: d, rule: r });
      d = advance(d, r.frequency, r.every, r.anchorDay);
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** Rough monthly equivalent of a rule, for "subscriptions cost you X/month". */
export function monthlyEquivalent(r) {
  const per = { daily: 30.4375, weekly: 4.348, monthly: 1, yearly: 1 / 12 }[r.frequency];
  return (r.amount * per) / r.every;
}
