import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, test } from 'node:test';
import { authenticate, dispatch, parseCookies, setCookieHeader } from '../src/http/dispatch.js';
import { buildRoutes } from '../src/http/routes.js';
import { ImageStorage } from '../src/services/ImageStorage.js';
import { addUser, ctx, expectStatus, makeEnv } from './helpers.js';

describe('Подключение к данным (FakeDatabaseFacade)', () => {
  test('фиктивный фасад заменяет DatabaseFacade во всех контроллерах', async () => {
    const env = makeEnv();
    assert.equal(env.controllers.auth.db, env.db);
    assert.equal(env.controllers.admin.db, env.db);
    assert.deepEqual((await env.controllers.tours.index(ctx())).body.tours, []);
  });

  test('повторный Email в БД → ошибка 23505, как в PostgreSQL', async () => {
    const env = makeEnv();
    await addUser(env);
    await assert.rejects(addUser(env), (e) => e.code === '23505');
  });
});

describe('HTTP-слой', () => {
  test('таблица маршрутов содержит все конечные точки без дубликатов', () => {
    const routes = buildRoutes(makeEnv().controllers);
    const keys = routes.map((r) => `${r.method} ${r.path}`);
    assert.equal(new Set(keys).size, keys.length);
    for (const k of ['POST /api/auth/login', 'GET /api/tours/:id', 'POST /api/bookings', 'POST /api/admin/bookings/:id/approve']) {
      assert.ok(keys.includes(k), k);
    }
  });

  test('dispatch превращает HttpError в ответ, а неизвестную ошибку – в 500 без деталей', async () => {
    const env = makeEnv();
    const route = buildRoutes(env.controllers).find((r) => r.path === '/api/bookings' && r.method === 'POST');
    const r1 = await dispatch(route, ctx(null, { body: {} }));
    assert.equal(r1.status, 401);
    const r2 = await dispatch({ handler: () => { throw new Error('секрет БД'); } }, ctx());
    const original = console.error;
    console.error = () => {};
    try {
      assert.equal(r2.status, 500);
      assert.equal(r2.body.error, 'Сервис временно недоступен');
    } finally {
      console.error = original;
    }
  });

  test('cookie с токеном: разбор, аутентификация, заголовки Set-Cookie', async () => {
    const env = makeEnv();
    const user = await addUser(env);
    const token = env.tokens.sign({ sub: user.id });
    assert.equal(parseCookies(`a=1; token=${token}`).token, token);
    assert.equal((await authenticate(`token=${token}`, env.tokens, env.db)).id, user.id);
    assert.equal(await authenticate('token=broken', env.tokens, env.db), null);
    assert.equal(await authenticate(undefined, env.tokens, env.db), null);
    assert.match(setCookieHeader({ setToken: token }, { cookieSecure: true }), /HttpOnly; SameSite=Lax; Path=\/; Secure; Max-Age=\d+/);
    assert.match(setCookieHeader({ clearToken: true }), /Max-Age=0/);
    assert.equal(setCookieHeader({}), null);
  });
});

describe('ImageStorage', () => {
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);
  const jpg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32)]);

  test('сохраняет PNG и JPG, возвращает проверяемый путь', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ta-'));
    const storage = new ImageStorage(dir);
    const [p1, p2] = await storage.saveAll([png, jpg]);
    assert.ok(p1.endsWith('.png') && p2.endsWith('.jpg'));
    assert.ok(storage.isValidPath(p1) && storage.isValidPath(p2));
    assert.equal((await fs.readdir(dir)).length, 2);
    assert.equal(storage.isValidPath('/uploads/../secret.png'), false);
  });

  test('отвергает пустой файл, не изображение и слишком большой файл', async () => {
    const storage = new ImageStorage(await fs.mkdtemp(path.join(os.tmpdir(), 'ta-')));
    await assert.rejects(storage.save(Buffer.alloc(0)));
    await assert.rejects(storage.save(Buffer.from('<?php echo 1; ?>')), /JPG и PNG/);
    await assert.rejects(storage.save(Buffer.concat([png, Buffer.alloc(5 * 1024 * 1024)])), /5 МБ/);
  });

  test('загрузка через контроллер: только администратор, ошибка → 400', async () => {
    const env = makeEnv();
    env.storage.dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ta-'));
    const admin = await addUser(env, { role: 2, email: 'a@test.ru' });
    const client = await addUser(env);
    const res = await env.controllers.admin.upload(ctx(admin, { rawBody: png }));
    assert.equal(res.status, 201);
    assert.ok(env.storage.isValidPath(res.body.path));
    await expectStatus(env.controllers.admin.upload(ctx(admin, { rawBody: Buffer.from('text') })), 400, assert);
    await expectStatus(env.controllers.admin.upload(ctx(client, { rawBody: png })), 403, assert);
  });
});
