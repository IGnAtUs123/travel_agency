import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { addUser, ctx, expectStatus, makeEnv } from './helpers.js';

describe('Личная информация', () => {
  test('изменяет ФИО, телефон и дату рождения; Email остаётся прежним', async () => {
    const env = makeEnv();
    const user = await addUser(env);
    const res = await env.controllers.profile.update(
      ctx(user, { body: { fullName: 'Новое Имя', phone: '+7 900 000-00-01', birthDate: '1995-02-03', email: 'hacker@test.ru' } }),
    );
    assert.equal(res.body.user.fullName, 'Новое Имя');
    const saved = await env.db.getUserById(user.id);
    assert.equal(saved.phone, '+79000000001');
    assert.equal(saved.birthDate, '1995-02-03');
    assert.equal(saved.email, 'user@test.ru');
  });

  test('смена пароля: новый работает, старый – нет; пустой пароль не меняет хеш', async () => {
    const env = makeEnv();
    const user = await addUser(env);
    const base = { fullName: user.fullName, phone: user.phone, birthDate: user.birthDate };
    const oldHash = (await env.db.getUserById(user.id)).passwordHash;
    await env.controllers.profile.update(ctx(user, { body: { ...base, password: '' } }));
    assert.equal((await env.db.getUserById(user.id)).passwordHash, oldHash);
    await env.controllers.profile.update(ctx(await env.db.getUserById(user.id), { body: { ...base, password: 'newpass1', confirmPassword: 'newpass1' } }));
    const saved = await env.db.getUserById(user.id);
    assert.equal(await env.hasher.verify('newpass1', saved.passwordHash), true);
    assert.equal(await env.hasher.verify('secret1', saved.passwordHash), false);
  });

  test('ошибки: пустое ФИО, короткий пароль, несовпадение подтверждения', async () => {
    const env = makeEnv();
    const user = await addUser(env);
    const base = { fullName: 'Имя', phone: '+79001234567', birthDate: '2000-01-01' };
    const e1 = await expectStatus(env.controllers.profile.update(ctx(user, { body: { ...base, fullName: '' } })), 400, assert);
    assert.ok(e1.fields.fullName);
    const e2 = await expectStatus(env.controllers.profile.update(ctx(user, { body: { ...base, password: '123', confirmPassword: '123' } })), 400, assert);
    assert.ok(e2.fields.password);
    const e3 = await expectStatus(env.controllers.profile.update(ctx(user, { body: { ...base, password: 'abcdef', confirmPassword: 'abcdeg' } })), 400, assert);
    assert.ok(e3.fields.confirmPassword);
  });

  test('гость → 401', async () => {
    const env = makeEnv();
    await expectStatus(env.controllers.profile.show(ctx(null)), 401, assert);
    await expectStatus(env.controllers.profile.update(ctx(null, { body: {} })), 401, assert);
  });
});
