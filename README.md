# Ledgerly — daily AR / AP, expenses & savings tracker

Ledgerly tracks **who owes you** (accounts receivable), **who you owe**
(accounts payable), and your **daily spending, budgets and savings**, all in one
place. It's built with **React + Vite**, an **Express** API, and **Neon Postgres**.

Anyone can register. Every account is fully isolated: every row is scoped to its
owner, and there are no admins and no shared data.

## Features

**Receivables & payables**
- Record money someone owes you or you owe them, with an issue date, due date, and reference (invoice/bill number).
- Partial payments with a full payment history. "Settle in full" is one click. You can write a record off and restore it later.
- Statuses are computed automatically: *open → partial → overdue → settled*.
- **Aging report** with buckets: not yet due, 1–30, 31–60, 61–90 and 90+ days. It exports to CSV.
- Optionally mark a record as a loan ("I handed over cash"), so the account balance moves when the loan is made.
- **Friendly reminders**: a pre-written message you can send by WhatsApp, SMS, email or the native share sheet, or copy.
- **Contacts** have a running balance and a bank-style **statement**. Contacts can be created inline while you type.

**Daily money**
- Two-tap expense and income entry. Category chips, "yesterday"/"2 days ago" shortcuts, and suggestions based on notes you often type.
- The amount field does calculator math, so you can type `12+8.5` to add up a split bill.
- Multiple **accounts** (cash, bank, mobile wallet, card) with live balances and **transfers** between them.
- **Budgets** per category, with *on track / at risk / over* pacing warnings.
- **Bills & recurring**: rent, subscriptions and salary are auto-logged on schedule (missed dates are caught up), or confirmed by hand. The page shows what they cost per month and per year.
- **Savings goals** with deposits and withdrawals, the monthly amount you need to save, a projected finish date at your current pace, and an on-track badge.

**Insight**
- **Safe to spend today**: what's left of your budget (or your cash after upcoming bills) spread over the rest of the month.
- **30-day cash forecast**: your balance projected forward using dues, bills and income. It warns you before the balance dips below zero.
- Net position, logging streak, no-spend days, and plain-language insights (for example "Shopping rose the most").
- Reports: income vs expenses, category breakdown, a spending calendar heatmap, spending by weekday, and collections vs repayments.

**UX**
- Light and dark themes, a mobile bottom nav with a quick-add button, and forms that open as bottom sheets on phones.
- `Ctrl/⌘ K` command palette, plus single-key shortcuts: **N** quick add, **E** expense, **I** income, **R** receivable, **P** payable, **S** savings, **T** transfer.
- **Switch currency any time** from the top bar, the account menu, the command palette or Settings. You can choose any of about 160 ISO currencies, searchable by name, code or symbol. Only the display currency changes; recorded amounts aren't converted.

## Project layout

```
api/index.js          Vercel serverless entry (wraps the Express app)
server/               Express API
  src/app.js          app factory (routes, error handling, static hosting)
  src/routes/         auth, accounts, categories, contacts, dues, transactions,
                      budgets, goals, recurring, dashboard, reports
  src/db/migrations/  SQL migrations (applied automatically on boot)
  test/               node:test + supertest integration tests
client/               React 19 + Vite + Tailwind CSS v4 + TanStack Query + Recharts
vercel.json           build + rewrites for a single-project deploy
```

## Running locally

Requirements: Node 20.6+ and a Postgres database (Neon or local).

```bash
npm install                      # installs server + client (npm workspaces)
cp server/.env.example server/.env
# set DATABASE_URL (your Neon connection string) and JWT_SECRET
npm run migrate                  # create tables
npm run seed                     # optional: demo@ledgerly.app / demo1234
npm run dev                      # API on :4000, web app on :5173
```

Tests need a throwaway local database. The URL is in `server/.env.test`, and the test run **drops and recreates the `public` schema**.

```bash
npm test
```

## Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `DATABASE_URL` | server | Neon Postgres connection string (use the pooled host) |
| `JWT_SECRET` | server | Secret for signing session tokens (32+ random chars) |
| `JWT_EXPIRES_IN` | server | Session length, default `30d` |
| `CORS_ORIGIN` | server | Comma-separated allowed origins when the web app is on another domain |
| `AUTO_MIGRATE` | server | Run migrations on boot (default `true`, long-running server only) |
| `PG_POOL_MAX` | server | Pool size (use 3–5 on serverless) |
| `VITE_API_URL` | client | API base URL if the API is hosted separately (empty = same origin) |

## Deploying to Vercel

Production deploys automatically from the **`main`** branch.

The repo deploys as **one Vercel project**. The Vite app is served statically
from `client/dist`, and `/api/*` is rewritten to `api/index.js`, which runs the
Express app as a serverless function.

1. Import the repository in Vercel. The framework preset can stay as "Other" because `vercel.json` sets the build.
2. Add the `DATABASE_URL`, `JWT_SECRET` and `PG_POOL_MAX=3` environment variables.
3. Serverless functions don't run the boot-time migrator. Apply migrations once with `npm run migrate` from your machine, pointed at the production `DATABASE_URL`.

## API overview

All endpoints except `/api/auth/*` and `/api/health` need an `Authorization: Bearer <token>` header.
Clients send `X-Timezone` so that "today", overdue checks and aging match the user's local date.

| Resource | Endpoints |
|---|---|
| Auth | `POST /auth/register`, `POST /auth/login`, `GET/PATCH/DELETE /auth/me`, `POST /auth/password` |
| Receivables/payables | `GET/POST /dues`, `GET/PATCH/DELETE /dues/:id`, `POST /dues/:id/payments`, `POST /dues/:id/settle`, `DELETE /dues/:id/payments/:pid`, `GET /dues/aging` |
| Contacts | `GET/POST /contacts`, `GET/PATCH/DELETE /contacts/:id` (includes statement) |
| Transactions | `GET/POST /transactions`, `PATCH/DELETE /transactions/:id`, `GET /transactions/export.csv`, `GET /transactions/suggestions` |
| Accounts | `GET/POST /accounts`, `PATCH/DELETE /accounts/:id`, `GET/POST /accounts/transfers`, `DELETE /accounts/transfers/:id` |
| Budgets & categories | `GET /budgets?month=YYYY-MM`, `GET/POST /categories`, `PATCH/DELETE /categories/:id` |
| Savings | `GET/POST /goals`, `GET/PATCH/DELETE /goals/:id`, `POST /goals/:id/contributions`, `DELETE /goals/:id/contributions/:cid` |
| Recurring | `GET/POST /recurring`, `PATCH/DELETE /recurring/:id`, `POST /recurring/:id/post`, `POST /recurring/:id/skip` |
| Insight | `GET /dashboard`, `GET /reports/{trend,categories,heatmap,weekday,aging,insights}` |
