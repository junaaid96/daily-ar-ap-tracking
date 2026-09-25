-- Ledgerly core schema: users, money accounts, categories, contacts,
-- receivables/payables ("dues") with partial payments, daily transactions,
-- savings goals and recurring rules.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  email          text NOT NULL,
  password_hash  text NOT NULL,
  currency       text NOT NULL DEFAULT 'USD' CHECK (length(currency) = 3),
  is_demo        boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_key ON users (lower(email));

-- Where money physically lives: cash wallet, bank, mobile wallet, card.
CREATE TABLE accounts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name             text NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  kind             text NOT NULL DEFAULT 'cash' CHECK (kind IN ('cash','bank','mobile','card','other')),
  color            text NOT NULL DEFAULT '#10b981',
  opening_balance  numeric(14,2) NOT NULL DEFAULT 0,
  archived         boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX accounts_user_idx ON accounts (user_id);

CREATE TABLE categories (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            text NOT NULL CHECK (length(name) BETWEEN 1 AND 60),
  kind            text NOT NULL CHECK (kind IN ('expense','income')),
  icon            text NOT NULL DEFAULT 'circle',
  color           text NOT NULL DEFAULT '#64748b',
  monthly_budget  numeric(14,2) CHECK (monthly_budget IS NULL OR monthly_budget >= 0),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind, name)
);

-- People / businesses you lend to, borrow from, invoice or get billed by.
CREATE TABLE contacts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  phone       text,
  email       text,
  company     text,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX contacts_user_idx ON contacts (user_id, name);

-- A receivable (someone owes you) or payable (you owe someone).
-- account_id, when set, means cash actually moved when the due was created
-- (you lent from / borrowed into that account).
CREATE TABLE dues (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_id   uuid NOT NULL REFERENCES contacts(id) ON DELETE RESTRICT,
  direction    text NOT NULL CHECK (direction IN ('receivable','payable')),
  title        text NOT NULL CHECK (length(title) BETWEEN 1 AND 160),
  notes        text,
  reference    text,
  amount       numeric(14,2) NOT NULL CHECK (amount > 0),
  issue_date   date NOT NULL DEFAULT CURRENT_DATE,
  due_date     date,
  account_id   uuid REFERENCES accounts(id) ON DELETE SET NULL,
  written_off  boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CHECK (due_date IS NULL OR due_date >= issue_date)
);
CREATE INDEX dues_user_dir_idx ON dues (user_id, direction, due_date);
CREATE INDEX dues_contact_idx ON dues (contact_id);

CREATE TABLE due_payments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  due_id      uuid NOT NULL REFERENCES dues(id) ON DELETE CASCADE,
  account_id  uuid REFERENCES accounts(id) ON DELETE SET NULL,
  amount      numeric(14,2) NOT NULL CHECK (amount > 0),
  paid_on     date NOT NULL DEFAULT CURRENT_DATE,
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX due_payments_due_idx ON due_payments (due_id);
CREATE INDEX due_payments_user_idx ON due_payments (user_id, paid_on);

CREATE TABLE recurring_rules (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind         text NOT NULL CHECK (kind IN ('expense','income')),
  name         text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  amount       numeric(14,2) NOT NULL CHECK (amount > 0),
  category_id  uuid REFERENCES categories(id) ON DELETE SET NULL,
  account_id   uuid REFERENCES accounts(id) ON DELETE SET NULL,
  frequency    text NOT NULL CHECK (frequency IN ('daily','weekly','monthly','yearly')),
  every        integer NOT NULL DEFAULT 1 CHECK (every BETWEEN 1 AND 365),
  next_date    date NOT NULL,
  anchor_day   smallint CHECK (anchor_day BETWEEN 1 AND 31), -- keeps 'every 31st' stable across short months
  end_date     date,
  auto_post    boolean NOT NULL DEFAULT true,
  active       boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX recurring_user_idx ON recurring_rules (user_id, next_date);

-- Daily income & expense entries.
CREATE TABLE transactions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind          text NOT NULL CHECK (kind IN ('expense','income')),
  amount        numeric(14,2) NOT NULL CHECK (amount > 0),
  category_id   uuid REFERENCES categories(id) ON DELETE SET NULL,
  account_id    uuid REFERENCES accounts(id) ON DELETE SET NULL,
  occurred_on   date NOT NULL DEFAULT CURRENT_DATE,
  note          text,
  recurring_id  uuid REFERENCES recurring_rules(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX transactions_user_date_idx ON transactions (user_id, occurred_on DESC);
CREATE INDEX transactions_category_idx ON transactions (category_id);

CREATE TABLE savings_goals (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name           text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  target_amount  numeric(14,2) NOT NULL CHECK (target_amount > 0),
  target_date    date,
  icon           text NOT NULL DEFAULT 'piggy-bank',
  color          text NOT NULL DEFAULT '#8b5cf6',
  archived       boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX savings_goals_user_idx ON savings_goals (user_id);

-- Positive = money set aside, negative = withdrawal back to an account.
CREATE TABLE savings_contributions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  goal_id         uuid NOT NULL REFERENCES savings_goals(id) ON DELETE CASCADE,
  account_id      uuid REFERENCES accounts(id) ON DELETE SET NULL,
  amount          numeric(14,2) NOT NULL CHECK (amount <> 0),
  contributed_on  date NOT NULL DEFAULT CURRENT_DATE,
  note            text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX savings_contrib_goal_idx ON savings_contributions (goal_id);
CREATE INDEX savings_contrib_user_idx ON savings_contributions (user_id);

-- Moving money between your own accounts (ATM withdrawal, top-up, card payment).
CREATE TABLE transfers (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_account_id  uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  to_account_id    uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  amount           numeric(14,2) NOT NULL CHECK (amount > 0),
  transferred_on   date NOT NULL DEFAULT CURRENT_DATE,
  note             text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CHECK (from_account_id <> to_account_id)
);
CREATE INDEX transfers_user_idx ON transfers (user_id, transferred_on DESC);

-- Per-due rollup used everywhere (lists, aging, contact balances).
CREATE VIEW dues_summary AS
SELECT d.*,
       COALESCE(p.paid, 0)::numeric(14,2)                         AS paid_amount,
       CASE WHEN d.written_off THEN 0
            ELSE GREATEST(d.amount - COALESCE(p.paid, 0), 0) END::numeric(14,2) AS outstanding,
       p.last_paid_on,
       COALESCE(p.payment_count, 0)::int                          AS payment_count
FROM dues d
LEFT JOIN LATERAL (
  SELECT SUM(amount) AS paid, MAX(paid_on) AS last_paid_on, COUNT(*) AS payment_count
  FROM due_payments dp WHERE dp.due_id = d.id
) p ON true;

-- Live balance of each money account from every flow that touches it.
CREATE VIEW account_balances AS
SELECT a.id, a.user_id,
       (a.opening_balance
        + COALESCE((SELECT SUM(CASE WHEN t.kind = 'income' THEN t.amount ELSE -t.amount END)
                    FROM transactions t WHERE t.account_id = a.id), 0)
        + COALESCE((SELECT SUM(CASE WHEN d.direction = 'receivable' THEN dp.amount ELSE -dp.amount END)
                    FROM due_payments dp JOIN dues d ON d.id = dp.due_id WHERE dp.account_id = a.id), 0)
        + COALESCE((SELECT SUM(CASE WHEN d.direction = 'payable' THEN d.amount ELSE -d.amount END)
                    FROM dues d WHERE d.account_id = a.id), 0)
        - COALESCE((SELECT SUM(sc.amount) FROM savings_contributions sc WHERE sc.account_id = a.id), 0)
        + COALESCE((SELECT SUM(tr.amount) FROM transfers tr WHERE tr.to_account_id = a.id), 0)
        - COALESCE((SELECT SUM(tr.amount) FROM transfers tr WHERE tr.from_account_id = a.id), 0)
       )::numeric(14,2) AS balance
FROM accounts a;
