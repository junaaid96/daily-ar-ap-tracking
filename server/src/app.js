import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { HttpError } from './lib/errors.js';
import { requireAuth, clientToday } from './middleware/auth.js';
import { pool } from './db/pool.js';
import auth from './routes/auth.js';
import accounts from './routes/accounts.js';
import categories from './routes/categories.js';
import contacts from './routes/contacts.js';
import dues from './routes/dues.js';
import transactions from './routes/transactions.js';
import budgets from './routes/budgets.js';
import goals from './routes/goals.js';
import recurring from './routes/recurring.js';
import dashboard from './routes/dashboard.js';
import reports from './routes/reports.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  const origins = (process.env.CORS_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);
  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
  app.use(cors({ origin: origins.length ? origins : true, exposedHeaders: ['Content-Disposition'] }));
  app.use(express.json({ limit: '200kb' }));
  if (process.env.NODE_ENV !== 'test') app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

  app.get('/api/health', async (_req, res) => {
    const { rows: [r] } = await pool.query('SELECT now() AS time');
    res.json({ ok: true, db: 'up', time: r.time });
  });

  // Public numbers for the sign-in page. Cached briefly so it can't hammer the DB.
  const CURRENCY_COUNT = Intl.supportedValuesOf('currency').length;
  let statsCache = { at: 0, users: 0 };
  app.get('/api/stats', async (_req, res) => {
    if (Date.now() - statsCache.at > 60_000) {
      const { rows: [r] } = await pool.query('SELECT COUNT(*)::int AS users FROM users WHERE NOT is_demo');
      statsCache = { at: Date.now(), users: r.users };
    }
    res.set('Cache-Control', 'public, max-age=60');
    res.json({ users: statsCache.users, currencies: CURRENCY_COUNT });
  });

  app.use('/api/auth', clientToday, auth);

  const api = express.Router();
  api.use(requireAuth, clientToday);
  api.use('/accounts', accounts);
  api.use('/categories', categories);
  api.use('/contacts', contacts);
  api.use('/dues', dues);
  api.use('/transactions', transactions);
  api.use('/budgets', budgets);
  api.use('/goals', goals);
  api.use('/recurring', recurring);
  api.use('/dashboard', dashboard);
  api.use('/reports', reports);
  app.use('/api', api);

  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Endpoint not found')));

  // In production, serve the built React app from the same origin.
  const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
  if (fs.existsSync(path.join(dist, 'index.html'))) {
    app.use(express.static(dist, { maxAge: '1h', index: false }));
    app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message, fields: err.details });
    }
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Malformed JSON body' });
    if (err.code === '23503') return res.status(409).json({ error: 'This item is still referenced by other records' });
    if (err.code === '22P02') return res.status(400).json({ error: 'Invalid identifier' });
    console.error(err);
    res.status(500).json({ error: 'Something went wrong on our side' });
  });

  return app;
}
