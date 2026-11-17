// Интеграционные тесты DatabaseFacade. Запускаются только если задана переменная TEST_DATABASE_URL
// (отдельная пустая база с применённым database/schema.sql). ВНИМАНИЕ: таблицы будут очищены!
//   TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/travel_agency_test npm test
import { describe } from 'node:test';
import { facadeSuite } from './facadeSuite.js';

const url = process.env.TEST_DATABASE_URL;

describe('DatabaseFacade на реальной PostgreSQL', { skip: !url && 'не задан TEST_DATABASE_URL' }, () => {
  facadeSuite(async () => {
    const { default: pg } = await import('pg');
    return new pg.Pool({ connectionString: url });
  });
});
