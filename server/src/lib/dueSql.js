// Shared SQL fragments for receivables/payables. `$T` is replaced with the
// placeholder that carries the caller's "today" date.

export const statusExpr = (t) => `CASE
  WHEN ds.written_off THEN 'written_off'
  WHEN ds.outstanding = 0 THEN 'paid'
  WHEN ds.due_date < ${t}::date THEN 'overdue'
  WHEN ds.paid_amount > 0 THEN 'partial'
  ELSE 'open' END`;

export const dueSelect = (t) => `SELECT ds.id, ds.direction, ds.title, ds.notes, ds.reference, ds.amount,
  ds.issue_date AS "issueDate", ds.due_date AS "dueDate", ds.account_id AS "accountId",
  ds.written_off AS "writtenOff", ds.paid_amount AS "paidAmount", ds.outstanding,
  ds.last_paid_on AS "lastPaidOn", ds.payment_count AS "paymentCount", ds.created_at AS "createdAt",
  ${statusExpr(t)} AS status,
  CASE WHEN ds.outstanding > 0 AND ds.due_date < ${t}::date THEN (${t}::date - ds.due_date) ELSE 0 END AS "daysOverdue",
  CASE WHEN ds.due_date IS NULL THEN NULL ELSE (ds.due_date - ${t}::date) END AS "daysUntilDue",
  json_build_object('id', c.id, 'name', c.name, 'phone', c.phone, 'email', c.email) AS contact
  FROM dues_summary ds JOIN contacts c ON c.id = ds.contact_id`;

/** Aging buckets over outstanding, non-written-off dues. */
export const agingSelect = (t) => `SELECT ds.direction,
  COALESCE(SUM(ds.outstanding) FILTER (WHERE ds.due_date IS NULL OR ds.due_date >= ${t}::date), 0) AS current,
  COALESCE(SUM(ds.outstanding) FILTER (WHERE ${t}::date - ds.due_date BETWEEN 1 AND 30), 0) AS d1_30,
  COALESCE(SUM(ds.outstanding) FILTER (WHERE ${t}::date - ds.due_date BETWEEN 31 AND 60), 0) AS d31_60,
  COALESCE(SUM(ds.outstanding) FILTER (WHERE ${t}::date - ds.due_date BETWEEN 61 AND 90), 0) AS d61_90,
  COALESCE(SUM(ds.outstanding) FILTER (WHERE ${t}::date - ds.due_date > 90), 0) AS d90_plus,
  COALESCE(SUM(ds.outstanding), 0) AS total,
  COUNT(*) FILTER (WHERE ds.outstanding > 0)::int AS count
  FROM dues_summary ds`;

export const shapeAging = (rows) => {
  const empty = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0, total: 0, count: 0 };
  const out = { receivable: { ...empty }, payable: { ...empty } };
  for (const r of rows) out[r.direction] = { ...empty, ...r, direction: undefined };
  delete out.receivable.direction;
  delete out.payable.direction;
  return out;
};
