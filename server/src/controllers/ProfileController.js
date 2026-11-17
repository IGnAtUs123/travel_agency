import { todayString } from '../models.js';
import { requireAuth } from './guards.js';
import { presentUser } from './presenters.js';
import { validateProfile } from './validators.js';

export class ProfileController {
  constructor({ db, hasher, clock = () => new Date() }) {
    this.db = db;
    this.hasher = hasher;
    this.clock = clock;
  }

  async show(ctx) {
    const user = requireAuth(ctx);
    return { status: 200, body: { user: presentUser(user) } };
  }

  /** Изменение ФИО, телефона, даты рождения и (необязательно) пароля. Email не меняется. */
  async update(ctx) {
    const user = requireAuth(ctx);
    const data = validateProfile(ctx.body, todayString(this.clock()));
    user.fullName = data.fullName;
    user.phone = data.phone;
    user.birthDate = data.birthDate;
    if (data.password) user.passwordHash = await this.hasher.hash(data.password);
    await this.db.updateUser(user);
    return { status: 200, body: { user: presentUser(user) } };
  }
}
