// Создание таблиц и справочников: npm run migrate [-- --reset]
// --reset удаляет все данные и создаёт схему заново.
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { SERVER_ROOT, loadConfig } from '../src/config.js';

const config = loadConfig();
const reset = process.argv.includes('--reset');
const sql = fs.readFileSync(path.join(SERVER_ROOT, '..', 'database', 'schema.sql'), 'utf8');

const client = new pg.Client({ connectionString: config.databaseUrl });
await client.connect();
try {
  const exists = (await client.query(`SELECT to_regclass('public.users') AS t`)).rows[0].t;
  if (exists && !reset) {
    console.log('Таблицы уже существуют. Для пересоздания запустите: npm run migrate -- --reset');
  } else {
    if (reset) await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    await client.query(sql);
    console.log('Схема базы данных создана.');
  }
} finally {
  await client.end();
}
