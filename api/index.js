// Vercel serverless entry: every /api/* request is rewritten here and handled
// by the same Express app used in local development.
import { createApp } from '../server/src/app.js';

export default createApp();
