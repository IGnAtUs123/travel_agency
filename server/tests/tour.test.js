import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { Difficulty, Role, Season } from '../src/models.js';
import { addTour, addUser, ctx, expectStatus, makeEnv, validTour } from './helpers.js';

const UUID = '123e4567-e89b-12d3-a456-426614174000';

async function setup() {
  const env = makeEnv();
  const admin = await addUser(env, { role: Role.Admin, email: 'admin@test.ru' });
  const other = await addUser(env, { role: Role.Admin, email: 'admin2@test.ru' });
  const client = await addUser(env, { email: 'client@test.ru' });
  return { env, admin, other, client };
}

describe('Список туров', () => {
  test('поиск по названию и описанию, без учёта регистра', async () => {
    const { env, admin } = await setup();
    await addTour(env, admin.id, { title: 'Байкал зимой', description: 'лёд' });
    await addTour(env, admin.id, { title: 'Алтай', description: 'горы и БАЙКАЛ рядом' });
    await addTour(env, admin.id, { title: 'Камчатка', description: 'вулканы' });
    const res = await env.controllers.tours.index(ctx(null, { query: { search: 'байкал' } }));
    assert.deepEqual(res.body.tours.map((t) => t.title).sort(), ['Алтай', 'Байкал зимой']);
  });

  test('фильтры: сложность, сезон, длительность', async () => {
    const { env, admin } = await setup();
    await addTour(env, admin.id, { title: 'A', difficulty: Difficulty.Beginner, season: Season.Summer, durationDays: 2 });
    await addTour(env, admin.id, { title: 'B', difficulty: Difficulty.Extreme, season: Season.Winter, durationDays: 6 });
    await addTour(env, admin.id, { title: 'C', difficulty: Difficulty.Extreme, season: Season.Summer, durationDays: 10 });
    const titles = async (query) => (await env.controllers.tours.index(ctx(null, { query }))).body.tours.map((t) => t.title);
    assert.deepEqual(await titles({ difficulty: '4' }), ['B', 'C']);
    assert.deepEqual(await titles({ season: '3' }), ['A', 'C']);
    assert.deepEqual(await titles({ minDays: '4', maxDays: '7' }), ['B']);
    assert.deepEqual(await titles({ difficulty: '4', season: '3' }), ['C']);
    assert.deepEqual(await titles({ difficulty: 'abc' }), ['A', 'B', 'C']); // некорректный фильтр игнорируется
  });

  test('туры отсортированы по дате начала; пустой результат – пустой список', async () => {
    const { env, admin } = await setup();
    await addTour(env, admin.id, { title: 'Позже', startDate: '2027-03-01' });
    await addTour(env, admin.id, { title: 'Раньше', startDate: '2027-01-01' });
    const all = (await env.controllers.tours.index(ctx())).body.tours.map((t) => t.title);
    assert.deepEqual(all, ['Раньше', 'Позже']);
    assert.deepEqual((await env.controllers.tours.index(ctx(null, { query: { search: 'нет такого' } }))).body.tours, []);
  });
});

describe('Страница тура', () => {
  test('содержит организатора; canEdit только у автора', async () => {
    const { env, admin, other } = await setup();
    const tour = await addTour(env, admin.id);
    const asGuest = (await env.controllers.tours.details(ctx(null, { params: { id: String(tour.id) } }))).body.tour;
    assert.equal(asGuest.organizer.email, 'admin@test.ru');
    assert.equal(asGuest.canEdit, false);
    const asAuthor = (await env.controllers.tours.details(ctx(admin, { params: { id: String(tour.id) } }))).body.tour;
    assert.equal(asAuthor.canEdit, true);
    const asOther = (await env.controllers.tours.details(ctx(other, { params: { id: String(tour.id) } }))).body.tour;
    assert.equal(asOther.canEdit, false);
  });

  test('несуществующий тур → 404', async () => {
    const { env } = await setup();
    await expectStatus(env.controllers.tours.details(ctx(null, { params: { id: '999' } })), 404, assert);
    await expectStatus(env.controllers.tours.details(ctx(null, { params: { id: 'abc' } })), 404, assert);
  });
});

describe('Создание и редактирование тура', () => {
  test('администратор создаёт тур со своим adminId и изображениями', async () => {
    const { env, admin } = await setup();
    const images = [`/uploads/${UUID}.jpg`, `/uploads/${UUID.replace('0000', '1111')}.png`];
    const res = await env.controllers.admin.create(ctx(admin, { body: validTour({ images }) }));
    assert.equal(res.status, 201);
    const tour = await env.db.getTourById(res.body.id);
    assert.equal(tour.adminId, admin.id);
    assert.deepEqual(tour.images.map((i) => i.imagePath), images);
    assert.equal(tour.cover, images[0]);
  });

  test('пользователь и гость не могут создавать туры (403 / 401)', async () => {
    const { env, client } = await setup();
    await expectStatus(env.controllers.admin.create(ctx(client, { body: validTour() })), 403, assert);
    await expectStatus(env.controllers.admin.create(ctx(null, { body: validTour() })), 401, assert);
  });

  test('неверные данные: цена, длительность, сложность, число изображений', async () => {
    const { env, admin } = await setup();
    const bad = async (over) => (await expectStatus(env.controllers.admin.create(ctx(admin, { body: validTour(over) })), 400, assert)).fields;
    assert.ok((await bad({ price: 0 })).price);
    assert.ok((await bad({ price: -5 })).price);
    assert.ok((await bad({ durationDays: 0 })).durationDays);
    assert.ok((await bad({ difficulty: 9 })).difficulty);
    assert.ok((await bad({ title: '  ' })).title);
    assert.ok((await bad({ startDate: '2027-02-30' })).startDate);
    const six = Array.from({ length: 6 }, (_, i) => `/uploads/${UUID.replace('0000', '000' + i)}.jpg`);
    assert.ok((await bad({ images: six })).images);
    assert.ok((await bad({ images: ['/etc/passwd'] })).images);
  });

  test('редактировать может только автор; изображения заменяются', async () => {
    const { env, admin, other } = await setup();
    const tour = await addTour(env, admin.id);
    const params = { id: String(tour.id) };
    await expectStatus(env.controllers.admin.update(ctx(other, { params, body: validTour() })), 403, assert);
    const images = [`/uploads/${UUID}.png`];
    await env.controllers.admin.update(ctx(admin, { params, body: validTour({ title: 'Изменён', price: 777, images }) }));
    const updated = await env.db.getTourById(tour.id);
    assert.equal(updated.title, 'Изменён');
    assert.equal(updated.price, 777);
    assert.equal(updated.adminId, admin.id);
    assert.deepEqual(updated.images.map((i) => i.imagePath), images);
    await expectStatus(env.controllers.admin.update(ctx(admin, { params: { id: '999' }, body: validTour() })), 404, assert);
  });

  test('«Мои туры» содержит только туры администратора', async () => {
    const { env, admin, other } = await setup();
    await addTour(env, admin.id, { title: 'Мой' });
    await addTour(env, other.id, { title: 'Чужой' });
    const res = await env.controllers.admin.myTours(ctx(admin));
    assert.deepEqual(res.body.tours.map((t) => t.title), ['Мой']);
  });
});
