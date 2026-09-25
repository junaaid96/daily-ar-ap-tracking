import { z } from 'zod';
import { badRequest } from './errors.js';

/** Parse `data` with a zod schema or throw a 400 with field-level messages. */
export function parse(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    const fields = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join('.') || '_';
      fields[key] ??= issue.message;
    }
    const first = Object.entries(fields)[0];
    throw badRequest(first ? `${first[0]}: ${first[1]}` : 'Invalid input', fields);
  }
  return result.data;
}

export const id = z.uuid();
export const money = z.coerce.number().finite().positive().max(999_999_999_999).transform((n) => Math.round(n * 100) / 100);
export const signedMoney = z.coerce.number().finite().refine((n) => n !== 0, 'must not be zero')
  .transform((n) => Math.round(n * 100) / 100);
export const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD')
  .refine((s) => !Number.isNaN(Date.parse(s)), 'invalid date');
export const optText = (max = 500) => z.string().trim().max(max).optional().nullable().transform((v) => v || null);
export const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'must be a hex color');
export const optId = id.optional().nullable().transform((v) => v || null);
export const optDate = date.optional().nullable().or(z.literal('')).transform((v) => v || null);

/**
 * Validate a PATCH body: every field optional, and only keys the client
 * actually sent are returned (zod would otherwise fill in create-time defaults).
 */
export function parsePatch(schema, body = {}) {
  const data = parse(schema.partial(), body);
  return Object.fromEntries(Object.entries(data).filter(([k]) => Object.prototype.hasOwnProperty.call(body, k)));
}

/** Build `SET col = $n` fragments from a patch object and a key->column map. */
export function setClause(patch, columns, startIndex) {
  const sets = [];
  const values = [];
  for (const [key, col] of Object.entries(columns)) {
    if (key in patch) {
      values.push(patch[key]);
      sets.push(`${col} = $${startIndex + values.length - 1}`);
    }
  }
  return { sets, values };
}
