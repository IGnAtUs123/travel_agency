// Набор интеграционных тестов DatabaseFacade на реальной базе PostgreSQL.
// Подключается из DatabaseFacade.integration.test.js (с драйвером pg).
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import { DatabaseFacade } from '../../src/db/DatabaseFacade.js';
import { Booking, BookingStatus, Difficulty, Role, Season, Tour, TourFilter, TourImage, User } from '../../src/models.js';

export function facadeSuite(getPool) {
  let pool;
  let db;
  let admin;
  let client;

  const user = (over = {}) =>
    new User({ fullName: 'Иванов Иван', email: 'user@test.ru', phone: '+79001234567', birthDate: '2000-05-17', passwordHash: 'hash', role: Role.Client, ...over });
  const tour = (over = {}) =>
    new Tour({
      adminId: admin.id, title: 'Тур', description: 'Описание', price: 1500.5, startDate: '2027-01-10', durationDays: 3,
      difficulty: Difficulty.Medium, season: Season.Winter, images: [], ...over,
    });
  const imgs = (...paths) => paths.map((p, i) => new TourImage({ imagePath: p, sortOrder: i + 1 }));

  before(async () => {
    pool = await getPool();
    db = new DatabaseFacade(pool);
  });
  after(async () => {
    await pool.end();
  });
  beforeEach(async () => {
    await pool.query('TRUNCATE bookings, tour_images, tours, users RESTART IDENTITY CASCADE');
    admin = await db.getUserById(await db.createUser(user({ email: 'admin@test.ru', fullName: 'Админ Админович', role: Role.Admin, phone: '+70000000001' })));
    client = await db.getUserById(await db.createUser(user()));
  });

  describe('Пользователи', () => {
    test('createUser / getUserById / getUserByEmail (без учёта регистра)', async () => {
      assert.equal(client.email, 'user@test.ru');
      assert.equal(client.role, Role.Client);
      assert.equal(client.birthDate, '2000-05-17');
      assert.equal((await db.getUserByEmail('USER@Test.ru')).id, client.id);
      assert.equal(await db.getUserByEmail('nobody@test.ru'), null);
      assert.equal(await db.getUserById(9999), null);
      assert.equal(admin.isAdmin, true);
    });

    test('повторный Email → ошибка 23505', async () => {
      await assert.rejects(db.createUser(user({ email: 'USER@test.ru' })), (e) => e.code === '23505');
    });

    test('updateUser меняет ФИО, телефон, дату рождения и хеш, но не Email и роль', async () => {
      client.fullName = 'Новое Имя';
      client.phone = '+79990000000';
      client.birthDate = '1990-01-02';
      client.passwordHash = 'new-hash';
      client.email = 'changed@test.ru';
      await db.updateUser(client);
      const saved = await db.getUserById(client.id);
      assert.deepEqual([saved.fullName, saved.phone, saved.birthDate, saved.passwordHash, saved.email, saved.role], ['Новое Имя', '+79990000000', '1990-01-02', 'new-hash', 'user@test.ru', Role.Client]);
    });
  });

  describe('Туры', () => {
    test('createTour сохраняет тур с изображениями; getTourById возвращает организатора и изображения по порядку', async () => {
      const id = await db.createTour(tour({ images: imgs('/uploads/a.png', '/uploads/b.png') }));
      const t = await db.getTourById(id);
      assert.equal(t.title, 'Тур');
      assert.equal(t.price, 1500.5);
      assert.equal(t.startDate, '2027-01-10');
      assert.equal(t.difficulty, Difficulty.Medium);
      assert.equal(t.season, Season.Winter);
      assert.deepEqual(t.images.map((i) => i.imagePath), ['/uploads/a.png', '/uploads/b.png']);
      assert.equal(t.cover, '/uploads/a.png');
      assert.deepEqual(t.organizer, { fullName: 'Админ Админович', email: 'admin@test.ru', phone: '+70000000001' });
      assert.equal(await db.getTourById(9999), null);
    });

    test('транзакция: при ошибке в изображениях тур не создаётся (6-е изображение нарушает CHECK)', async () => {
      const six = imgs(...Array.from({ length: 6 }, (_, i) => `/uploads/${i}.png`));
      await assert.rejects(db.createTour(tour({ images: six })));
      assert.equal((await db.getTours()).length, 0);
    });

    test('ограничения БД: цена и длительность должны быть положительными', async () => {
      await assert.rejects(db.createTour(tour({ price: 0 })));
      await assert.rejects(db.createTour(tour({ durationDays: 0 })));
    });

    test('updateTour заменяет данные и набор изображений', async () => {
      const id = await db.createTour(tour({ images: imgs('/uploads/a.png', '/uploads/b.png') }));
      await db.updateTour(tour({ id, title: 'Новое', price: 99, durationDays: 7, difficulty: Difficulty.Extreme, season: Season.Summer, images: imgs('/uploads/c.png') }));
      const t = await db.getTourById(id);
      assert.deepEqual([t.title, t.price, t.durationDays, t.difficulty, t.season], ['Новое', 99, 7, Difficulty.Extreme, Season.Summer]);
      assert.deepEqual(t.images.map((i) => i.imagePath), ['/uploads/c.png']);
      assert.equal(t.adminId, admin.id);
    });

    test('getTours: поиск (в т.ч. спецсимволы % и _), фильтры, сортировка по дате, cover', async () => {
      await db.createTour(tour({ title: 'Байкал 100%', description: 'лёд', startDate: '2027-03-01', durationDays: 2, difficulty: Difficulty.Beginner, season: Season.Winter, images: imgs('/uploads/x.png') }));
      await db.createTour(tour({ title: 'Алтай_горы', description: 'про БАЙКАЛ тоже', startDate: '2027-01-01', durationDays: 6, difficulty: Difficulty.Extreme, season: Season.Summer }));
      await db.createTour(tour({ title: 'Камчатка', description: 'вулканы', startDate: '2027-02-01', durationDays: 10, difficulty: Difficulty.Extreme, season: Season.Summer }));
      const titles = async (f) => (await db.getTours(new TourFilter(f))).map((t) => t.title);
      assert.deepEqual(await titles({}), ['Алтай_горы', 'Камчатка', 'Байкал 100%']);
      assert.deepEqual(await titles({ search: 'байкал' }), ['Алтай_горы', 'Байкал 100%']);
      assert.deepEqual(await titles({ search: '100%' }), ['Байкал 100%']);
      assert.deepEqual(await titles({ search: '%' }), ['Байкал 100%']); // % не работает как шаблон
      assert.deepEqual(await titles({ search: 'й_г' }), ['Алтай_горы']);
      assert.deepEqual(await titles({ difficulty: Difficulty.Extreme }), ['Алтай_горы', 'Камчатка']);
      assert.deepEqual(await titles({ season: Season.Winter }), ['Байкал 100%']);
      assert.deepEqual(await titles({ minDays: 3, maxDays: 8 }), ['Алтай_горы']);
      assert.deepEqual(await titles({ difficulty: Difficulty.Extreme, season: Season.Summer, minDays: 8 }), ['Камчатка']);
      assert.deepEqual(await titles({ search: "x'; DROP TABLE tours; --" }), []);
      const all = await db.getTours(new TourFilter({}));
      assert.equal(all.find((t) => t.title === 'Байкал 100%').cover, '/uploads/x.png');
      assert.equal(all.find((t) => t.title === 'Камчатка').cover, null);
    });

    test('getToursByAdmin возвращает только туры администратора', async () => {
      const other = await db.getUserById(await db.createUser(user({ email: 'a2@test.ru', role: Role.Admin })));
      await db.createTour(tour({ title: 'Мой' }));
      await db.createTour(tour({ title: 'Чужой', adminId: other.id }));
      assert.deepEqual((await db.getToursByAdmin(admin.id)).map((t) => t.title), ['Мой']);
    });
  });

  describe('Заявки', () => {
    let tourId;
    beforeEach(async () => {
      tourId = await db.createTour(tour());
    });
    const book = (userId = client.id, status) => db.createBooking(new Booking({ userId, tourId, status }));

    test('createBooking: статус по умолчанию «Ожидает»; getBookingById возвращает тур и заявителя', async () => {
      const id = await book();
      const b = await db.getBookingById(id);
      assert.equal(b.status, BookingStatus.Pending);
      assert.equal(b.processedAt, null);
      assert.ok(b.createdAt);
      assert.deepEqual([b.tour.id, b.tour.adminId, b.tour.title, b.tour.price, b.tour.startDate, b.tour.durationDays], [tourId, admin.id, 'Тур', 1500.5, '2027-01-10', 3]);
      assert.deepEqual([b.user.fullName, b.user.email, b.user.phone, b.user.birthDate], ['Иванов Иван', 'user@test.ru', '+79001234567', '2000-05-17']);
      assert.equal(b.user.getAge('2026-11-16'), 26);
      assert.equal(await db.getBookingById(9999), null);
    });

    test('внешние ключи: заявка на несуществующий тур или пользователя отклоняется', async () => {
      await assert.rejects(db.createBooking(new Booking({ userId: client.id, tourId: 9999 })));
      await assert.rejects(db.createBooking(new Booking({ userId: 9999, tourId })));
    });

    test('getBookingsByUser: только свои, новые сверху', async () => {
      const other = await db.getUserById(await db.createUser(user({ email: 'o@test.ru' })));
      const a = await book();
      await book(other.id);
      const b = await book();
      assert.deepEqual((await db.getBookingsByUser(client.id)).map((x) => x.id), [b, a]);
    });

    test('getBookingsByTour: сначала ожидающие, затем по времени', async () => {
      const a = await book();
      const b = await book();
      const c = await book();
      await db.updateBookingStatus(a, BookingStatus.Confirmed);
      assert.deepEqual((await db.getBookingsByTour(tourId)).map((x) => x.id), [b, c, a]);
    });

    test('updateBookingStatus: processed_at заполняется при одобрении/отклонении, но не при отмене', async () => {
      const a = await book();
      const b = await book();
      const c = await book();
      await db.updateBookingStatus(a, BookingStatus.Confirmed);
      await db.updateBookingStatus(b, BookingStatus.Rejected);
      await db.updateBookingStatus(c, BookingStatus.Cancelled);
      const get = async (id) => db.getBookingById(id);
      assert.deepEqual([(await get(a)).status, !!(await get(a)).processedAt], [BookingStatus.Confirmed, true]);
      assert.deepEqual([(await get(b)).status, !!(await get(b)).processedAt], [BookingStatus.Rejected, true]);
      assert.deepEqual([(await get(c)).status, (await get(c)).processedAt], [BookingStatus.Cancelled, null]);
    });
  });
}
