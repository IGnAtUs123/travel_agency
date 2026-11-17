import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { Role } from '../src/models.js';
import { addUser, ctx, expectStatus, makeEnv, validRegistration } from './helpers.js';

describe('Регистрация', () => {
  test('создаёт пользователя с ролью «Пользователь» и хеширует пароль', async () => {
    const env = makeEnv();
    const res = await env.controllers.auth.register(ctx(null, { body: validRegistration() }));
    assert.equal(res.status, 201);
    const user = await env.db.getUserByEmail('petrov@test.ru'); // email приводится к нижнему регистру
    assert.equal(user.role, Role.Client);
    assert.equal(user.phone, '+79001112233');
    assert.notEqual(user.passwordHash, 'secret1');
    assert.ok(await env.hasher.verify('secret1', user.passwordHash));
  });

  test('повторный Email → 409', async () => {
    const env = makeEnv();
    await addUser(env, { email: 'petrov@test.ru' });
    const e = await expectStatus(env.controllers.auth.register(ctx(null, { body: validRegistration() })), 409, assert);
    assert.ok(e.fields.email);
  });

  test('несовпадение паролей → 400 с подсветкой поля', async () => {
    const env = makeEnv();
    const e = await expectStatus(
      env.controllers.auth.register(ctx(null, { body: validRegistration({ confirmPassword: 'other' }) })),
      400,
      assert,
    );
    assert.ok(e.fields.confirmPassword);
  });

  test('неверные данные: Email, короткий пароль, дата рождения в будущем', async () => {
    const env = makeEnv();
    const e = await expectStatus(
      env.controllers.auth.register(
        ctx(null, { body: validRegistration({ email: 'not-an-email', password: '123', confirmPassword: '123', birthDate: '2030-01-01' }) }),
      ),
      400,
      assert,
    );
    assert.ok(e.fields.email && e.fields.password && e.fields.birthDate);
  });

  test('пустые обязательные поля → 400', async () => {
    const env = makeEnv();
    const e = await expectStatus(env.controllers.auth.register(ctx(null, { body: {} })), 400, assert);
    assert.ok(e.fields.fullName && e.fields.email && e.fields.phone);
  });
});

describe('Авторизация', () => {
  test('верные данные: возвращает пользователя и токен сессии', async () => {
    const env = makeEnv();
    const u = await addUser(env);
    const res = await env.controllers.auth.login(ctx(null, { body: { email: 'USER@test.ru', password: 'secret1' } }));
    assert.equal(res.status, 200);
    assert.equal(res.body.user.email, 'user@test.ru');
    assert.equal(res.body.user.passwordHash, undefined); // хеш пароля не отдаётся клиенту
    assert.equal(env.tokens.verify(res.setToken).sub, u.id);
  });

  test('неверный пароль и неизвестный Email → 401', async () => {
    const env = makeEnv();
    await addUser(env);
    await expectStatus(env.controllers.auth.login(ctx(null, { body: { email: 'user@test.ru', password: 'wrong' } })), 401, assert);
    await expectStatus(env.controllers.auth.login(ctx(null, { body: { email: 'nobody@test.ru', password: 'secret1' } })), 401, assert);
  });

  test('пустые поля → 400, подсвечиваются оба поля', async () => {
    const env = makeEnv();
    const e = await expectStatus(env.controllers.auth.login(ctx(null, { body: { email: '', password: '' } })), 400, assert);
    assert.deepEqual(e.fields, { email: true, password: true });
  });

  test('выход очищает токен; me возвращает null для гостя', async () => {
    const env = makeEnv();
    assert.equal((await env.controllers.auth.logout()).clearToken, true);
    assert.equal((await env.controllers.auth.me(ctx(null))).body.user, null);
  });
});

describe('Токены и пароли', () => {
  test('подделанный и просроченный токены отвергаются', async () => {
    const env = makeEnv();
    const t = env.tokens.sign({ sub: 1 });
    assert.equal(env.tokens.verify(t).sub, 1);
    assert.equal(env.tokens.verify(t.slice(0, -2) + 'xx'), null);
    assert.equal(env.tokens.verify('мусор'), null);
    const later = new (env.tokens.constructor)('test-secret', { now: () => Date.now() + 8 * 24 * 3600 * 1000 });
    assert.equal(later.verify(t), null);
  });

  test('PasswordHasher: разные соли, неверный пароль не проходит', async () => {
    const env = makeEnv();
    const a = await env.hasher.hash('abc123');
    const b = await env.hasher.hash('abc123');
    assert.notEqual(a, b);
    assert.equal(await env.hasher.verify('abc123', a), true);
    assert.equal(await env.hasher.verify('abc124', a), false);
    assert.equal(await env.hasher.verify('abc123', 'не-хеш'), false);
  });
});
