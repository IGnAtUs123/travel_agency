import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SERVER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Минимальный разбор файла .env (КЛЮЧ=значение), не перезаписывает уже заданные переменные. */
function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m || line.trim().startsWith('#')) continue;
    const value = m[2].replace(/^(['"])(.*)\1$/, '$2');
    if (process.env[m[1]] === undefined) process.env[m[1]] = value;
  }
}

export function loadConfig(env = process.env) {
  if (env === process.env) loadEnvFile(path.join(SERVER_ROOT, '.env'));
  const isProd = env.NODE_ENV === 'production';
  if (isProd && !env.JWT_SECRET) throw new Error('В production необходимо задать JWT_SECRET');
  return {
    port: Number(env.PORT) || 3000,
    databaseUrl: env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/travel_agency',
    jwtSecret: env.JWT_SECRET || 'dev-only-secret-change-me',
    cookieSecure: env.COOKIE_SECURE === 'true',
    uploadDir: env.UPLOAD_DIR || path.join(SERVER_ROOT, 'uploads'),
    clientDist: env.CLIENT_DIST || path.resolve(SERVER_ROOT, '..', 'client', 'dist'),
    adminEmail: env.ADMIN_EMAIL || 'admin@travel.local',
    adminPassword: env.ADMIN_PASSWORD || 'Admin123!',
  };
}
