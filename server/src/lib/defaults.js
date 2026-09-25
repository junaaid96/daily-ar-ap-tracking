export const DEFAULT_CATEGORIES = [
  // expense
  ['expense', 'Food & Dining', 'utensils', '#f97316'],
  ['expense', 'Groceries', 'shopping-cart', '#84cc16'],
  ['expense', 'Transport', 'car', '#0ea5e9'],
  ['expense', 'Rent & Housing', 'home', '#6366f1'],
  ['expense', 'Utilities', 'zap', '#eab308'],
  ['expense', 'Shopping', 'shopping-bag', '#ec4899'],
  ['expense', 'Health', 'heart-pulse', '#ef4444'],
  ['expense', 'Entertainment', 'clapperboard', '#a855f7'],
  ['expense', 'Education', 'graduation-cap', '#14b8a6'],
  ['expense', 'Bills & Subscriptions', 'receipt', '#64748b'],
  ['expense', 'Personal Care', 'sparkles', '#f472b6'],
  ['expense', 'Gifts & Donations', 'gift', '#f43f5e'],
  ['expense', 'Other', 'circle', '#94a3b8'],
  // income
  ['income', 'Salary', 'briefcase', '#10b981'],
  ['income', 'Freelance', 'laptop', '#06b6d4'],
  ['income', 'Business', 'store', '#22c55e'],
  ['income', 'Investments', 'trending-up', '#8b5cf6'],
  ['income', 'Gifts Received', 'gift', '#f59e0b'],
  ['income', 'Other Income', 'plus-circle', '#94a3b8'],
];

/** Give a brand-new user a usable starting point: categories + a cash wallet. */
export async function seedDefaults(client, userId) {
  const values = [];
  const params = [userId];
  DEFAULT_CATEGORIES.forEach(([kind, name, icon, color], i) => {
    const o = i * 4;
    values.push(`($1, $${o + 2}, $${o + 3}, $${o + 4}, $${o + 5})`);
    params.push(kind, name, icon, color);
  });
  await client.query(
    `INSERT INTO categories (user_id, kind, name, icon, color) VALUES ${values.join(',')}`,
    params,
  );
  await client.query(
    `INSERT INTO accounts (user_id, name, kind, color) VALUES ($1, 'Cash', 'cash', '#10b981')`,
    [userId],
  );
}
