import { addDays } from '../lib/dates.js';

// Deterministic pseudo-random so every demo looks plausible but varied.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/** Fill a freshly-created user (who already has default categories + Cash) with ~3 months of data. */
export async function seedDemoData(c, userId, today) {
  const rand = rng(Date.parse(today) / 86_400_000);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const amt = (min, max) => Math.round((min + rand() * (max - min)) * 100) / 100;

  const { rows: cats } = await c.query('SELECT id, name FROM categories WHERE user_id = $1', [userId]);
  const cat = Object.fromEntries(cats.map((r) => [r.name, r.id]));
  const { rows: [cash] } = await c.query(`SELECT id FROM accounts WHERE user_id = $1 AND name = 'Cash'`, [userId]);
  await c.query('UPDATE accounts SET opening_balance = 420 WHERE id = $1', [cash.id]);
  const ins = async (sql, params) => (await c.query(sql, params)).rows[0];
  const bank = await ins(`INSERT INTO accounts (user_id, name, kind, color, opening_balance) VALUES ($1,'Main Bank','bank','#6366f1',3200) RETURNING id`, [userId]);
  const wallet = await ins(`INSERT INTO accounts (user_id, name, kind, color, opening_balance) VALUES ($1,'Mobile Wallet','mobile','#ec4899',150) RETURNING id`, [userId]);

  const budgets = { 'Food & Dining': 350, Groceries: 400, Transport: 150, Shopping: 200, Entertainment: 120, Utilities: 180, 'Rent & Housing': 1200 };
  for (const [name, b] of Object.entries(budgets)) {
    await c.query('UPDATE categories SET monthly_budget = $2 WHERE id = $1', [cat[name], b]);
  }

  // ---- Daily transactions over the last 95 days ---------------------------
  const tx = [];
  const daily = [
    ['Food & Dining', ['Lunch', 'Coffee', 'Dinner out', 'Breakfast', 'Snacks'], 4, 28, 0.75],
    ['Groceries', ['Supermarket', 'Vegetables & fruit', 'Weekly groceries'], 12, 70, 0.3],
    ['Transport', ['Ride share', 'Bus fare', 'Fuel', 'Metro card'], 2, 35, 0.45],
    ['Shopping', ['Clothes', 'Household items', 'Online order'], 10, 90, 0.08],
    ['Entertainment', ['Movie tickets', 'Concert', 'Games'], 8, 45, 0.06],
    ['Health', ['Pharmacy', 'Doctor visit'], 6, 60, 0.04],
    ['Personal Care', ['Haircut', 'Toiletries'], 5, 30, 0.05],
  ];
  for (let i = 94; i >= 0; i--) {
    const d = addDays(today, -i);
    if (rand() < 0.1 && i > 0) continue; // occasional no-spend day
    for (const [name, notes, min, max, p] of daily) {
      if (rand() < p) tx.push(['expense', amt(min, max), cat[name], pick([cash.id, cash.id, cash.id, wallet.id, bank.id, bank.id]), d, pick(notes)]);
    }
    const dom = Number(d.slice(8, 10));
    if (dom === 1) tx.push(['income', 3800, cat.Salary, bank.id, d, 'Monthly salary']);
    if (dom === 12 || dom === 26) tx.push(['income', amt(250, 700), cat.Freelance, bank.id, d, pick(['Logo design', 'Website fix', 'Consulting call'])]);
    if (dom === 3) tx.push(['expense', 1150, cat['Rent & Housing'], bank.id, d, 'Apartment rent']);
    if (dom === 15) tx.push(['expense', 45, cat.Utilities, bank.id, d, 'Internet']);
    if (dom === 9) tx.push(['expense', 15.99, cat['Bills & Subscriptions'], bank.id, d, 'Streaming subscription']);
    if (dom === 20) tx.push(['expense', amt(60, 95), cat.Utilities, bank.id, d, 'Electricity bill']);
    if (dom === 5 && rand() < 0.6) tx.push(['expense', amt(40, 120), cat['Gifts & Donations'], cash.id, d, 'Charity']);
  }
  // Weekly ATM withdrawals keep the cash wallet topped up.
  for (let i = 91; i >= 0; i -= 7) {
    await c.query(`INSERT INTO transfers (user_id, from_account_id, to_account_id, amount, transferred_on, note)
      VALUES ($1,$2,$3,$4,$5,'ATM withdrawal')`, [userId, bank.id, cash.id, 120, addDays(today, -i)]);
    if (i % 14 === 7) {
      await c.query(`INSERT INTO transfers (user_id, from_account_id, to_account_id, amount, transferred_on, note)
        VALUES ($1,$2,$3,$4,$5,'Wallet top-up')`, [userId, bank.id, wallet.id, 110, addDays(today, -i)]);
    }
  }
  for (let i = 0; i < tx.length; i += 200) {
    const chunk = tx.slice(i, i + 200);
    const vals = chunk.map((_, j) => `($1,$${j * 6 + 2},$${j * 6 + 3},$${j * 6 + 4},$${j * 6 + 5},$${j * 6 + 6},$${j * 6 + 7})`);
    await c.query(`INSERT INTO transactions (user_id, kind, amount, category_id, account_id, occurred_on, note) VALUES ${vals.join(',')}`,
      [userId, ...chunk.flat()]);
  }

  // ---- Recurring bills & income -------------------------------------------
  const monthStart = `${today.slice(0, 7)}-01`;
  const nextMonth = (day) => {
    const d = `${today.slice(0, 8)}${String(day).padStart(2, '0')}`;
    return d > today ? d : `${addDays(monthStart, 32).slice(0, 8)}${String(day).padStart(2, '0')}`;
  };
  const rules = [
    ['expense', 'Apartment rent', 1150, cat['Rent & Housing'], bank.id, 'monthly', nextMonth(3), false],
    ['expense', 'Internet', 45, cat.Utilities, bank.id, 'monthly', nextMonth(15), true],
    ['expense', 'Streaming subscription', 15.99, cat['Bills & Subscriptions'], bank.id, 'monthly', nextMonth(9), true],
    ['expense', 'Gym membership', 35, cat.Health, bank.id, 'monthly', nextMonth(22), true],
    ['expense', 'Cloud storage', 29.99, cat['Bills & Subscriptions'], bank.id, 'yearly', addDays(today, 40), true],
    ['income', 'Salary', 3800, cat.Salary, bank.id, 'monthly', nextMonth(1), false],
  ];
  for (const [kind, name, amount, category, account, freq, next, auto] of rules) {
    await c.query(
      `INSERT INTO recurring_rules (user_id, kind, name, amount, category_id, account_id, frequency, next_date, anchor_day, auto_post)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [userId, kind, name, amount, category, account, freq, next, Number(next.slice(8, 10)), auto]);
  }

  // ---- Contacts & receivables / payables ----------------------------------
  const people = [
    ['Rahim Traders', '+8801711000001', 'Rahim Traders Ltd.'],
    ['Sarah Khan', '+8801711000002', null],
    ['Acme Studio', null, 'Acme Studio'],
    ['Tanvir Ahmed', '+8801711000004', null],
    ['Green Grocers', '+8801711000005', 'Green Grocers'],
    ['Nadia Islam', '+8801711000006', null],
  ];
  const contact = {};
  for (const [name, phone, company] of people) {
    contact[name] = (await ins(`INSERT INTO contacts (user_id, name, phone, company) VALUES ($1,$2,$3,$4) RETURNING id`,
      [userId, name, phone, company])).id;
  }
  const dues = [
    // direction, contact, title, amount, issued (days ago), due (days from issue), account, payments [[daysAgo, amount]]
    ['receivable', 'Acme Studio', 'Website redesign — Invoice #1042', 1800, 48, 30, null, [[20, 600]], 'INV-1042'],
    ['receivable', 'Sarah Khan', 'Lent for laptop repair', 250, 70, 21, cash.id, [], null],
    ['receivable', 'Rahim Traders', 'Consulting — March', 950, 12, 15, null, [], 'INV-1043'],
    ['receivable', 'Tanvir Ahmed', 'Concert tickets split', 60, 5, 10, null, [], null],
    ['receivable', 'Nadia Islam', 'Emergency loan', 400, 110, 60, bank.id, [[80, 100], [45, 100]], null],
    ['receivable', 'Acme Studio', 'Logo package — Invoice #1031', 600, 90, 30, null, [[62, 600]], 'INV-1031'],
    ['payable', 'Green Grocers', 'Monthly grocery credit', 185, 18, 20, null, [], null],
    ['payable', 'Tanvir Ahmed', 'Borrowed for trip', 300, 40, 45, cash.id, [[10, 120]], null],
    ['payable', 'Rahim Traders', 'Office chair (installments)', 420, 25, 7, null, [[15, 140]], 'PO-778'],
    ['payable', 'Sarah Khan', 'Dinner I owe', 42, 3, 4, null, [], null],
  ];
  for (const [direction, who, title, amount, ago, term, account, payments, ref] of dues) {
    const issue = addDays(today, -ago);
    const d = await ins(
      `INSERT INTO dues (user_id, contact_id, direction, title, amount, issue_date, due_date, account_id, reference)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [userId, contact[who], direction, title, amount, issue, addDays(issue, term), account, ref]);
    for (const [pAgo, pAmt] of payments) {
      await c.query(`INSERT INTO due_payments (user_id, due_id, account_id, amount, paid_on) VALUES ($1,$2,$3,$4,$5)`,
        [userId, d.id, bank.id, pAmt, addDays(today, -pAgo)]);
    }
  }

  // ---- Savings goals -------------------------------------------------------
  const goals = [
    ['Emergency fund', 5000, addDays(today, 240), 'shield', '#10b981', [[85, 500], [55, 400], [25, 450], [3, 200]]],
    ['New laptop', 1400, addDays(today, 100), 'laptop', '#6366f1', [[60, 200], [30, 250], [8, 150]]],
    ['Vacation', 2200, addDays(today, 180), 'plane', '#f59e0b', [[40, 150], [12, 180]]],
  ];
  for (const [name, target, date, icon, color, contribs] of goals) {
    const g = await ins(`INSERT INTO savings_goals (user_id, name, target_amount, target_date, icon, color) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [userId, name, target, date, icon, color]);
    for (const [ago, a] of contribs) {
      await c.query(`INSERT INTO savings_contributions (user_id, goal_id, account_id, amount, contributed_on) VALUES ($1,$2,$3,$4,$5)`,
        [userId, g.id, bank.id, a, addDays(today, -ago)]);
    }
  }
}
