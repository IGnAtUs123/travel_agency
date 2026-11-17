import crypto from 'node:crypto';

const b64 = (buf) => Buffer.from(buf).toString('base64url');

/** Подписанные токены сессии (формат JWT, алгоритм HS256). */
export class TokenService {
  constructor(secret, { ttlSeconds = 7 * 24 * 3600, now = () => Date.now() } = {}) {
    if (!secret) throw new Error('Не задан секрет для подписи токенов');
    this.secret = secret;
    this.ttlSeconds = ttlSeconds;
    this.now = now;
  }

  sign(payload) {
    const header = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const exp = Math.floor(this.now() / 1000) + this.ttlSeconds;
    const body = b64(JSON.stringify({ ...payload, exp }));
    const sig = this.#signature(`${header}.${body}`);
    return `${header}.${body}.${sig}`;
  }

  /** Возвращает полезную нагрузку токена или null, если токен неверен/просрочен. */
  verify(token) {
    if (typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const expected = Buffer.from(this.#signature(`${parts[0]}.${parts[1]}`));
    const actual = Buffer.from(parts[2]);
    if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return null;
    try {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
      if (!payload.exp || payload.exp < Math.floor(this.now() / 1000)) return null;
      return payload;
    } catch {
      return null;
    }
  }

  #signature(data) {
    return crypto.createHmac('sha256', this.secret).update(data).digest('base64url');
  }
}
