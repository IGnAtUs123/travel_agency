import { Role, User, todayString } from '../models.js';
import { conflict, HttpError } from '../http/errors.js';
import { presentUser } from './presenters.js';
import { validateRegistration } from './validators.js';

export class AuthController {
  constructor({ db, hasher, tokens, clock = () => new Date() }) {
    this.db = db;
    this.hasher = hasher;
    this.tokens = tokens;
    this.clock = clock;
  }

  /** Регистрация: создаёт учётную запись с ролью «Пользователь». */
  async register(ctx) {
    const data = validateRegistration(ctx.body, todayString(this.clock()));
    if (await this.db.getUserByEmail(data.email)) {
      throw conflict('Пользователь с таким Email уже зарегистрирован', { email: 'Email уже используется' });
    }
    const user = new User({ ...data, passwordHash: await this.hasher.hash(data.password), role: Role.Client });
    try {
      const id = await this.db.createUser(user);
      return { status: 201, body: { id } };
    } catch (e) {
      if (e?.code === '23505') throw conflict('Пользователь с таким Email уже зарегистрирован', { email: 'Email уже используется' });
      throw e;
    }
  }

  /** Вход: проверяет Email и пароль, возвращает токен сессии. */
  async login(ctx) {
    const email = String(ctx.body?.email ?? '').trim();
    const password = typeof ctx.body?.password === 'string' ? ctx.body.password : '';
    if (!email || !password) {
      throw new HttpError(400, 'Введите Email и пароль', { email: !email, password: !password });
    }
    const user = await this.db.getUserByEmail(email);
    if (!user || !(await this.hasher.verify(password, user.passwordHash))) {
      throw new HttpError(401, 'Неверный Email или пароль', { email: true, password: true });
    }
    return { status: 200, body: { user: presentUser(user) }, setToken: this.tokens.sign({ sub: user.id }) };
  }

  async logout() {
    return { status: 200, body: { ok: true }, clearToken: true };
  }

  async me(ctx) {
    return { status: 200, body: { user: ctx.user ? presentUser(ctx.user) : null } };
  }
}
