import { createServices } from '../src/container.js';
import { FakeDatabaseFacade } from '../src/db/FakeDatabaseFacade.js';
import { Difficulty, Role, Season, Tour, User } from '../src/models.js';
import { PasswordHasher } from '../src/services/PasswordHasher.js';

export const TODAY = '2026-11-16';
export const fixedClock = () => new Date(2026, 10, 16, 12, 0, 0); // 16.11.2026

/** Окружение для тестов: фиктивная БД, контроллеры с фиксированной датой, быстрый хешер. */
export function makeEnv() {
  const db = new FakeDatabaseFacade();
  const config = { jwtSecret: 'test-secret', uploadDir: '/tmp/travel-agency-test-uploads' };
  const hasher = new PasswordHasher({ cost: 1024 });
  const services = createServices({ db, config, clock: fixedClock, hasher });
  return { db, hasher, ...services };
}

export async function addUser(env, { role = Role.Client, email = 'user@test.ru', password = 'secret1', fullName = 'Иванов Иван', birthDate = '2000-05-17' } = {}) {
  const id = await env.db.createUser(
    new User({ fullName, email, phone: '+79001234567', birthDate, passwordHash: await env.hasher.hash(password), role }),
  );
  return env.db.getUserById(id);
}

export async function addTour(env, adminId, over = {}) {
  const id = await env.db.createTour(
    new Tour({
      adminId,
      title: 'Тур на Байкал',
      description: 'Описание тура',
      price: 15000,
      startDate: '2026-12-20',
      durationDays: 5,
      difficulty: Difficulty.Medium,
      season: Season.Winter,
      images: [],
      ...over,
    }),
  );
  return env.db.getTourById(id);
}

export const ctx = (user = null, extra = {}) => ({ user, params: {}, query: {}, body: {}, ...extra });

/** Ожидает, что промис завершится ошибкой HttpError с указанным статусом. */
export async function expectStatus(promise, status, assert) {
  try {
    await promise;
  } catch (e) {
    assert.equal(e.status, status, `ожидался статус ${status}, получено ${e.status}: ${e.message}`);
    return e;
  }
  assert.fail(`ожидалась ошибка со статусом ${status}`);
}

export const validRegistration = (over = {}) => ({
  fullName: 'Петров Пётр',
  email: 'Petrov@Test.ru',
  phone: '+7 (900) 111-22-33',
  birthDate: '1999-03-01',
  password: 'secret1',
  confirmPassword: 'secret1',
  ...over,
});

export const validTour = (over = {}) => ({
  title: 'Новый тур',
  description: 'Описание',
  price: 12000,
  startDate: '2027-01-10',
  durationDays: 4,
  difficulty: Difficulty.Beginner,
  season: Season.Winter,
  images: [],
  ...over,
});
