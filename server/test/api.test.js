import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { migrate } from '../src/db/migrate.js';
import { pool } from '../src/db/pool.js';
import { advance } from '../src/lib/dates.js';

const app = createApp();
let tokenA;
let tokenB;
const as = (token) => ({
  get: (u) => request(app).get(u).set('Authorization', `Bearer ${token}`).set('x-timezone', 'UTC'),
  post: (u, b) => request(app).post(u).set('Authorization', `Bearer ${token}`).set('x-timezone', 'UTC').send(b),
  patch: (u, b) => request(app).patch(u).set('Authorization', `Bearer ${token}`).set('x-timezone', 'UTC').send(b),
  del: (u) => request(app).delete(u).set('Authorization', `Bearer ${token}`).set('x-timezone', 'UTC'),
});
const today = new Date().toISOString().slice(0, 10);

before(async () => {
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await migrate({ log: () => {} });
  const a = await request(app).post('/api/auth/register').send({ name: 'Alice', email: 'alice@test.dev', password: 'password123' });
  const b = await request(app).post('/api/auth/register').send({ name: 'Bob', email: 'bob@test.dev', password: 'password123', currency: 'eur' });
  tokenA = a.body.token;
  tokenB = b.body.token;
  assert.equal(b.body.user.currency, 'EUR');
});

after(() => pool.end());

test('auth: rejects duplicate email, bad password and missing token', async () => {
  const dup = await request(app).post('/api/auth/register').send({ name: 'A', email: 'ALICE@test.dev', password: 'password123' });
  assert.equal(dup.status, 409);
  const bad = await request(app).post('/api/auth/login').send({ email: 'alice@test.dev', password: 'nope' });
  assert.equal(bad.status, 401);
  assert.equal((await request(app).get('/api/accounts')).status, 401);
  const short = await request(app).post('/api/auth/register').send({ name: 'C', email: 'c@test.dev', password: '123' });
  assert.equal(short.status, 400);
  assert.ok(short.body.fields.password);
});

test('currency can be switched to any supported ISO code', async () => {
  const api = as(tokenB);
  const ok = await api.patch('/api/auth/me', { currency: 'bdt' });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.user.currency, 'BDT');
  assert.equal((await api.get('/api/auth/me')).body.user.currency, 'BDT');
  const bad = await api.patch('/api/auth/me', { currency: 'XYZ' });
  assert.equal(bad.status, 400);
  await api.patch('/api/auth/me', { currency: 'EUR' });
});

test('new users get default categories and a cash account', async () => {
  const cats = await as(tokenA).get('/api/categories');
  assert.ok(cats.body.length > 10);
  const accts = await as(tokenA).get('/api/accounts');
  assert.equal(accts.body.length, 1);
  assert.equal(accts.body[0].balance, 0);
});

test('receivable lifecycle: partial payments, overpay guard, settle, balances', async () => {
  const api = as(tokenA);
  const [cash] = (await api.get('/api/accounts')).body;
  const created = await api.post('/api/dues', {
    direction: 'receivable', contactName: 'Rahim', title: 'Lent for rent', amount: 500,
    issueDate: '2026-01-01', dueDate: '2026-01-15', accountId: cash.id,
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const due = created.body;
  assert.equal(due.status, 'overdue');
  assert.equal(due.outstanding, 500);
  assert.equal(due.contact.name, 'Rahim');

  // Lending from cash reduces the cash balance.
  let bal = (await api.get('/api/accounts')).body[0].balance;
  assert.equal(bal, -500);

  const p1 = await api.post(`/api/dues/${due.id}/payments`, { amount: 200, accountId: cash.id });
  assert.equal(p1.status, 201);
  assert.equal(p1.body.outstanding, 300);
  assert.equal(p1.body.payments.length, 1);

  const over = await api.post(`/api/dues/${due.id}/payments`, { amount: 301 });
  assert.equal(over.status, 400);

  const settled = await api.post(`/api/dues/${due.id}/settle`, { accountId: cash.id });
  assert.equal(settled.body.outstanding, 0);
  assert.equal(settled.body.status, 'paid');
  bal = (await api.get('/api/accounts')).body[0].balance;
  assert.equal(bal, 0);

  // Can't shrink the amount below what was paid.
  const shrink = await api.patch(`/api/dues/${due.id}`, { amount: 100 });
  assert.equal(shrink.status, 400);

  const contact = await api.get(`/api/contacts/${due.contact.id}`);
  assert.equal(contact.body.net, 0);
  assert.equal(contact.body.ledger.length, 3);
  assert.equal(contact.body.ledger[0].balance, 0);
});

test('aging buckets and status filters', async () => {
  const api = as(tokenA);
  const d = (n) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
  await api.post('/api/dues', { direction: 'payable', contactName: 'Shop', title: 'Old bill', amount: 100, issueDate: d(100), dueDate: d(95) });
  await api.post('/api/dues', { direction: 'payable', contactName: 'Shop', title: 'Recent bill', amount: 40, issueDate: d(10), dueDate: d(5) });
  await api.post('/api/dues', { direction: 'payable', contactName: 'Shop', title: 'Future bill', amount: 60, issueDate: d(1), dueDate: d(-10) });
  const aging = (await api.get('/api/dues/aging')).body.payable;
  assert.deepEqual([aging.current, aging.d1_30, aging.d90_plus, aging.total], [60, 40, 100, 200]);
  const overdue = await api.get('/api/dues?direction=payable&status=overdue');
  assert.equal(overdue.body.length, 2);
  const search = await api.get('/api/dues?q=future');
  assert.equal(search.body.length, 1);
});

test('users cannot see or use each other\'s data', async () => {
  const alice = as(tokenA);
  const bob = as(tokenB);
  const [aliceCash] = (await alice.get('/api/accounts')).body;
  const bobDues = await bob.get('/api/dues?status=all');
  assert.equal(bobDues.body.length, 0);
  const steal = await bob.post('/api/transactions', { kind: 'expense', amount: 5, accountId: aliceCash.id });
  assert.equal(steal.status, 400);
  const aliceDue = (await alice.get('/api/dues?status=all')).body[0];
  assert.equal((await bob.get(`/api/dues/${aliceDue.id}`)).status, 404);
  assert.equal((await bob.post(`/api/dues/${aliceDue.id}/payments`, { amount: 1 })).status, 404);
});

test('transactions, budgets and CSV export', async () => {
  const api = as(tokenA);
  const cats = (await api.get('/api/categories')).body;
  const food = cats.find((c) => c.name === 'Food & Dining');
  await api.patch(`/api/categories/${food.id}`, { monthlyBudget: 100 });
  await api.post('/api/transactions', { kind: 'expense', amount: 30.5, categoryId: food.id, note: 'Lunch' });
  await api.post('/api/transactions', { kind: 'expense', amount: 80, categoryId: food.id, note: '=HYPERLINK("x")' });
  await api.post('/api/transactions', { kind: 'income', amount: 1000, note: 'Salary' });
  const list = await api.get('/api/transactions?kind=expense');
  assert.equal(list.body.count, 2);
  assert.equal(list.body.expense, 110.5);

  const budgets = (await api.get('/api/budgets')).body;
  const b = budgets.items.find((i) => i.id === food.id);
  assert.equal(b.spent, 110.5);
  assert.equal(b.state, 'over');
  // Patching another field must not wipe the budget.
  await api.patch(`/api/categories/${food.id}`, { color: '#123456' });
  assert.equal((await api.get('/api/categories')).body.find((c) => c.id === food.id).monthlyBudget, 100);

  const csv = await api.get('/api/transactions/export.csv');
  assert.match(csv.headers['content-type'], /text\/csv/);
  assert.match(csv.text, /'=HYPERLINK/);
});

test('savings goals: deposit, withdraw guard, progress', async () => {
  const api = as(tokenA);
  const g = await api.post('/api/goals', { name: 'Laptop', targetAmount: 1000, initialAmount: 250 });
  assert.equal(g.status, 201);
  assert.equal(g.body.saved, 250);
  const w = await api.post(`/api/goals/${g.body.id}/contributions`, { type: 'withdraw', amount: 300 });
  assert.equal(w.status, 400);
  const d = await api.post(`/api/goals/${g.body.id}/contributions`, { amount: 750 });
  assert.equal(d.body.completed, true);
  assert.equal(d.body.progress, 1);
});

test('recurring rules auto-post missed occurrences and advance', async () => {
  const api = as(tokenA);
  const start = new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 10);
  const r = await api.post('/api/recurring', { name: 'Coffee sub', amount: 3, frequency: 'daily', nextDate: start });
  assert.equal(r.status, 201);
  assert.ok(r.body.nextDate > today);
  const posted = await api.get(`/api/transactions?q=Coffee sub`);
  assert.equal(posted.body.count, 4); // 3 days ago .. today

  const manual = await api.post('/api/recurring', { name: 'Rent', amount: 900, nextDate: today, autoPost: false });
  assert.equal(manual.body.nextDate, today);
  const skipped = await api.post(`/api/recurring/${manual.body.id}/skip`);
  assert.ok(skipped.body.nextDate > today);
});

test('month-end recurrence keeps the anchor day', () => {
  assert.equal(advance('2026-01-31', 'monthly', 1, 31), '2026-02-28');
  assert.equal(advance('2026-02-28', 'monthly', 1, 31), '2026-03-31');
  assert.equal(advance('2024-02-29', 'yearly', 1, 29), '2025-02-28');
  assert.equal(advance('2026-01-01', 'weekly', 2), '2026-01-15');
});

test('dashboard and reports respond with the expected shape', async () => {
  const api = as(tokenA);
  const dash = await api.get('/api/dashboard');
  assert.equal(dash.status, 200);
  assert.equal(dash.body.forecast.length, 31);
  assert.ok('safeToSpend' in dash.body);
  assert.ok(dash.body.streak >= 1);
  for (const p of ['trend', 'categories', 'heatmap', 'weekday', 'aging', 'insights']) {
    assert.equal((await api.get(`/api/reports/${p}`)).status, 200, p);
  }
});

test('public stats count real users only and list supported currencies', async () => {
  const res = await request(app).get('/api/stats');
  assert.equal(res.status, 200);
  assert.equal(res.body.users, 2); // Alice and Bob
  assert.ok(res.body.currencies > 100);
});
