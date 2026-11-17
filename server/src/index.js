import fs from 'node:fs';
import pg from 'pg';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createServices } from './container.js';
import { DatabaseFacade } from './db/DatabaseFacade.js';

const config = loadConfig();
fs.mkdirSync(config.uploadDir, { recursive: true });

const pool = new pg.Pool({ connectionString: config.databaseUrl });
pool.on('error', (e) => console.error('Ошибка соединения с БД:', e.message));

const db = new DatabaseFacade(pool);
const { controllers, tokens } = createServices({ db, config });
const app = createApp({ db, controllers, tokens, config });

const server = app.listen(config.port, () => {
  console.log(`Сервер запущен: http://localhost:${config.port}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => pool.end().then(() => process.exit(0)));
  });
}
