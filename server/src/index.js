import { createApp } from './app.js';
import { migrate } from './db/migrate.js';

const port = Number(process.env.PORT || 4000);

if (process.env.AUTO_MIGRATE !== 'false') {
  await migrate({ log: (m) => console.log(`[migrate] ${m}`) });
}

createApp().listen(port, () => {
  console.log(`Ledgerly API listening on http://localhost:${port}`);
});
