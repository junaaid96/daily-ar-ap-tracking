import jwt from 'jsonwebtoken';
import { HttpError } from '../lib/errors.js';
import { todayIn } from '../lib/dates.js';

const secret = () => {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 16) throw new Error('JWT_SECRET must be set (16+ chars)');
  return s;
};

export const signToken = (user) =>
  jwt.sign({ sub: user.id }, secret(), { expiresIn: process.env.JWT_EXPIRES_IN || '30d' });

export function requireAuth(req, _res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(new HttpError(401, 'Authentication required'));
  try {
    req.userId = jwt.verify(token, secret()).sub;
    next();
  } catch {
    next(new HttpError(401, 'Session expired, please sign in again'));
  }
}

/** "Today" from the caller's time zone so overdue/aging math matches what the user sees. */
export function clientToday(req, _res, next) {
  req.today = todayIn(req.get('x-timezone') || 'UTC');
  next();
}
