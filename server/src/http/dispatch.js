import { HttpError } from './errors.js';

/** Выполняет обработчик маршрута и приводит результат/ошибку к виду { status, body, setToken?, clearToken? }. */
export async function dispatch(route, ctx) {
  try {
    const result = await route.handler(ctx);
    return { status: 200, ...result };
  } catch (e) {
    if (e instanceof HttpError) {
      return { status: e.status, body: { error: e.message, ...(e.fields ? { fields: e.fields } : {}) } };
    }
    console.error(e);
    return { status: 500, body: { error: 'Сервис временно недоступен' } };
  }
}

export function parseCookies(header = '') {
  const out = {};
  for (const part of String(header).split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

/** Определяет пользователя по cookie с токеном; при любой проблеме возвращает null (гость). */
export async function authenticate(cookieHeader, tokens, db) {
  const token = parseCookies(cookieHeader).token;
  const payload = token ? tokens.verify(token) : null;
  if (!payload) return null;
  try {
    return await db.getUserById(payload.sub);
  } catch {
    return null;
  }
}

export const COOKIE_MAX_AGE = 7 * 24 * 3600;

/** Значение заголовка Set-Cookie для результата (или null, если куки не меняются). */
export function setCookieHeader(result, { cookieSecure = false } = {}) {
  const base = 'HttpOnly; SameSite=Lax; Path=/' + (cookieSecure ? '; Secure' : '');
  if (result.setToken) return `token=${result.setToken}; ${base}; Max-Age=${COOKIE_MAX_AGE}`;
  if (result.clearToken) return `token=; ${base}; Max-Age=0`;
  return null;
}
