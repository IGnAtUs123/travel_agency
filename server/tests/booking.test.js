import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { BookingStatus, Role } from '../src/models.js';
import { addTour, addUser, ctx, expectStatus, makeEnv } from './helpers.js';

async function setup() {
  const env = makeEnv();
  const admin = await addUser(env, { role: Role.Admin, email: 'admin@test.ru' });
  const other = await addUser(env, { role: Role.Admin, email: 'admin2@test.ru' });
  const client = await addUser(env, { email: 'client@test.ru', birthDate: '2008-11-16' });
  const tour = await addTour(env, admin.id);
  return { env, admin, other, client, tour };
}

const book = (env, user, tourId) => env.controllers.bookings.create(ctx(user, { body: { tourId } }));

describe('Бронирование', () => {
  test('создаёт заявку со статусом «Ожидает»', async () => {
    const { env, client, tour } = await setup();
    const res = await book(env, client, tour.id);
    assert.equal(res.status, 201);
    const b = await env.db.getBookingById(res.body.id);
    assert.equal(b.status, BookingStatus.Pending);
    assert.equal(b.userId, client.id);
    assert.equal(b.tourId, tour.id);
  });

  test('гость → 401', async () => {
    const { env, tour } = await setup();
    await expectStatus(book(env, null, tour.id), 401, assert);
  });

  test('недоступно: тур не найден, уже начался, создан этим же пользователем', async () => {
    const { env, admin, client } = await setup();
    const started = await addTour(env, admin.id, { startDate: '2026-11-16' }); // сегодня = «уже наступила»
    const own = await addTour(env, client.id, { title: 'Свой' });
    await expectStatus(book(env, client, 9999), 400, assert);
    await expectStatus(book(env, client, started.id), 400, assert);
    await expectStatus(book(env, client, own.id), 400, assert);
    assert.equal(env.db.bookings.length, 0);
  });

  test('«Мои бронирования»: только свои, новые сверху, с признаком canCancel', async () => {
    const { env, admin, client, tour } = await setup();
    const t2 = await addTour(env, admin.id, { title: 'Второй' });
    await book(env, client, tour.id);
    await book(env, client, t2.id);
    const res = await env.controllers.bookings.myBookings(ctx(client));
    assert.deepEqual(res.body.bookings.map((b) => b.tour.title), ['Второй', 'Тур на Байкал']);
    assert.ok(res.body.bookings.every((b) => b.canCancel && b.status.name === 'Ожидает'));
    const empty = await env.controllers.bookings.myBookings(ctx(admin));
    assert.deepEqual(empty.body.bookings, []);
  });
});

describe('Отмена бронирования', () => {
  test('ожидающая и подтверждённая заявки отменяются', async () => {
    const { env, client, tour } = await setup();
    const a = (await book(env, client, tour.id)).body.id;
    const b = (await book(env, client, tour.id)).body.id;
    await env.db.updateBookingStatus(b, BookingStatus.Confirmed);
    await env.controllers.bookings.cancel(ctx(client, { params: { id: String(a) } }));
    await env.controllers.bookings.cancel(ctx(client, { params: { id: String(b) } }));
    assert.equal((await env.db.getBookingById(a)).status, BookingStatus.Cancelled);
    assert.equal((await env.db.getBookingById(b)).status, BookingStatus.Cancelled);
  });

  test('отклонённую и уже отменённую заявку отменить нельзя', async () => {
    const { env, client, tour } = await setup();
    const a = (await book(env, client, tour.id)).body.id;
    await env.db.updateBookingStatus(a, BookingStatus.Rejected);
    await expectStatus(env.controllers.bookings.cancel(ctx(client, { params: { id: String(a) } })), 400, assert);
    await env.db.updateBookingStatus(a, BookingStatus.Cancelled);
    await expectStatus(env.controllers.bookings.cancel(ctx(client, { params: { id: String(a) } })), 400, assert);
  });

  test('чужую заявку отменить нельзя (404), несуществующую – тоже', async () => {
    const { env, other, client, tour } = await setup();
    const a = (await book(env, client, tour.id)).body.id;
    await expectStatus(env.controllers.bookings.cancel(ctx(other, { params: { id: String(a) } })), 404, assert);
    await expectStatus(env.controllers.bookings.cancel(ctx(client, { params: { id: '999' } })), 404, assert);
  });

  test('после начала тура отмена недоступна', async () => {
    const { env, client, tour } = await setup();
    const a = (await book(env, client, tour.id)).body.id;
    env.db.tours.find((t) => t.id === tour.id).startDate = '2026-11-10'; // тур «начался»
    await expectStatus(env.controllers.bookings.cancel(ctx(client, { params: { id: String(a) } })), 400, assert);
  });
});

describe('Обработка заявок администратором', () => {
  test('список заявок содержит данные заявителя, возраст считается по дате рождения', async () => {
    const { env, admin, client, tour } = await setup();
    await book(env, client, tour.id);
    const res = await env.controllers.admin.requests(ctx(admin, { params: { id: String(tour.id) } }));
    const r = res.body.requests[0];
    assert.equal(r.applicant.fullName, client.fullName);
    assert.equal(r.applicant.age, 18); // 2008-11-16 → 18 лет на 16.11.2026
    assert.equal(r.applicant.email, 'client@test.ru');
    assert.equal(r.canProcess, true);
  });

  test('одобрение и отклонение меняют статус; повторная обработка → 409', async () => {
    const { env, admin, client, tour } = await setup();
    const a = (await book(env, client, tour.id)).body.id;
    const b = (await book(env, client, tour.id)).body.id;
    await env.controllers.admin.approve(ctx(admin, { params: { id: String(a) } }));
    await env.controllers.admin.reject(ctx(admin, { params: { id: String(b) } }));
    assert.equal((await env.db.getBookingById(a)).status, BookingStatus.Confirmed);
    assert.equal((await env.db.getBookingById(b)).status, BookingStatus.Rejected);
    assert.ok((await env.db.getBookingById(a)).processedAt);
    await expectStatus(env.controllers.admin.approve(ctx(admin, { params: { id: String(a) } })), 409, assert);
    await expectStatus(env.controllers.admin.reject(ctx(admin, { params: { id: String(b) } })), 409, assert);
  });

  test('отменённую пользователем заявку обработать нельзя', async () => {
    const { env, admin, client, tour } = await setup();
    const a = (await book(env, client, tour.id)).body.id;
    await env.controllers.bookings.cancel(ctx(client, { params: { id: String(a) } }));
    await expectStatus(env.controllers.admin.approve(ctx(admin, { params: { id: String(a) } })), 409, assert);
  });

  test('чужой администратор и обычный пользователь не имеют доступа (403)', async () => {
    const { env, other, client, tour } = await setup();
    const a = (await book(env, client, tour.id)).body.id;
    await expectStatus(env.controllers.admin.requests(ctx(other, { params: { id: String(tour.id) } })), 403, assert);
    await expectStatus(env.controllers.admin.approve(ctx(other, { params: { id: String(a) } })), 403, assert);
    await expectStatus(env.controllers.admin.approve(ctx(client, { params: { id: String(a) } })), 403, assert);
    await expectStatus(env.controllers.admin.approve(ctx(null, { params: { id: String(a) } })), 401, assert);
    assert.equal((await env.db.getBookingById(a)).status, BookingStatus.Pending);
  });

  test('несуществующая заявка → 404; в списке сначала ожидающие', async () => {
    const { env, admin, client, tour } = await setup();
    await expectStatus(env.controllers.admin.approve(ctx(admin, { params: { id: '999' } })), 404, assert);
    const a = (await book(env, client, tour.id)).body.id;
    await book(env, client, tour.id);
    await env.controllers.admin.approve(ctx(admin, { params: { id: String(a) } }));
    const list = (await env.controllers.admin.requests(ctx(admin, { params: { id: String(tour.id) } }))).body.requests;
    assert.deepEqual(list.map((r) => r.status.name), ['Ожидает', 'Подтверждено']);
  });
});
