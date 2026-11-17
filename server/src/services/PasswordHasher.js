import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(crypto.scrypt);

/** Хеширование паролей алгоритмом scrypt (встроенный модуль crypto, без внешних зависимостей). */
export class PasswordHasher {
  constructor({ cost = 16384 } = {}) {
    this.cost = cost;
  }

  async hash(password) {
    const salt = crypto.randomBytes(16);
    const key = await scrypt(password, salt, 64, { N: this.cost });
    return `scrypt$${this.cost}$${salt.toString('base64')}$${key.toString('base64')}`;
  }

  async verify(password, stored) {
    const parts = String(stored || '').split('$');
    if (parts.length !== 4 || parts[0] !== 'scrypt') return false;
    const cost = Number(parts[1]);
    const salt = Buffer.from(parts[2], 'base64');
    const expected = Buffer.from(parts[3], 'base64');
    const actual = await scrypt(password, salt, expected.length, { N: cost });
    return crypto.timingSafeEqual(actual, expected);
  }
}
