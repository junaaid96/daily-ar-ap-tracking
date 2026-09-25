import { Router } from 'express';
import { z } from 'zod';
import { many, one } from '../db/pool.js';
import { parse, parsePatch, setClause, color, id } from '../lib/validate.js';
import { notFound, HttpError } from '../lib/errors.js';

const router = Router();

const schema = z.object({
  name: z.string().trim().min(1).max(60),
  kind: z.enum(['expense', 'income']),
  icon: z.string().trim().min(1).max(40).default('circle'),
  color: color.default('#64748b'),
  monthlyBudget: z.coerce.number().finite().min(0).nullable().optional(),
});

const COLS = `id, name, kind, icon, color, monthly_budget AS "monthlyBudget"`;

const uniqueGuard = (err) => {
  if (err.code === '23505') throw new HttpError(409, 'A category with this name already exists');
  throw err;
};

router.get('/', async (req, res) => {
  res.json(await many(`SELECT ${COLS} FROM categories WHERE user_id = $1 ORDER BY kind, name`, [req.userId]));
});

router.post('/', async (req, res) => {
  const b = parse(schema, req.body);
  const row = await one(
    `INSERT INTO categories (user_id, name, kind, icon, color, monthly_budget) VALUES ($1,$2,$3,$4,$5,$6) RETURNING ${COLS}`,
    [req.userId, b.name, b.kind, b.icon, b.color, b.monthlyBudget ?? null],
  ).catch(uniqueGuard);
  res.status(201).json(row);
});

router.patch('/:id', async (req, res) => {
  const catId = parse(id, req.params.id);
  const patch = parsePatch(schema, req.body);
  const { sets, values } = setClause(patch, {
    name: 'name', kind: 'kind', icon: 'icon', color: 'color', monthlyBudget: 'monthly_budget',
  }, 3);
  const row = await one(
    `UPDATE categories SET ${['id = id', ...sets].join(', ')} WHERE id = $1 AND user_id = $2 RETURNING ${COLS}`,
    [catId, req.userId, ...values],
  ).catch(uniqueGuard);
  if (!row) throw notFound('Category');
  res.json(row);
});

router.delete('/:id', async (req, res) => {
  const catId = parse(id, req.params.id);
  const row = await one('DELETE FROM categories WHERE id = $1 AND user_id = $2 RETURNING id', [catId, req.userId]);
  if (!row) throw notFound('Category');
  res.status(204).end();
});

export default router;
