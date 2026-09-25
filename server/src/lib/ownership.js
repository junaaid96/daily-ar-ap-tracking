import { pool } from '../db/pool.js';
import { badRequest } from './errors.js';

const TABLES = new Set(['accounts', 'categories', 'contacts', 'dues', 'savings_goals', 'recurring_rules']);

/**
 * Ensure each referenced row belongs to the user, so nobody can attach
 * their data to someone else's account/category/contact by guessing ids.
 * refs: { accounts: id, categories: id, ... } (null/undefined are skipped)
 */
export async function assertOwned(userId, refs, db = pool) {
  for (const [table, id] of Object.entries(refs)) {
    if (!id) continue;
    if (!TABLES.has(table)) throw new Error(`unknown table ${table}`);
    const { rowCount } = await db.query(`SELECT 1 FROM ${table} WHERE id = $1 AND user_id = $2`, [id, userId]);
    if (!rowCount) throw badRequest(`${table.replace(/_/g, ' ').replace(/s$/, '')} not found`);
  }
}
