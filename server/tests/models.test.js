import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Booking, BookingStatus, Role, Tour, User, todayString } from '../src/models.js';

test('User.getAge: день рождения ещё не наступил', () => {
  const u = new User({ birthDate: '2000-12-01' });
  assert.equal(u.getAge('2026-11-16'), 25);
});

test('User.getAge: день рождения сегодня', () => {
  const u = new User({ birthDate: '2000-11-16' });
  assert.equal(u.getAge('2026-11-16'), 26);
});

test('User.isAdmin зависит от роли', () => {
  assert.equal(new User({ role: Role.Admin }).isAdmin, true);
  assert.equal(new User({ role: Role.Client }).isAdmin, false);
});

test('Tour.hasStarted: будущая дата – не начался, сегодняшняя и прошлая – начался', () => {
  assert.equal(new Tour({ startDate: '2026-11-17' }).hasStarted('2026-11-16'), false);
  assert.equal(new Tour({ startDate: '2026-11-16' }).hasStarted('2026-11-16'), true);
  assert.equal(new Tour({ startDate: '2026-01-13' }).hasStarted('2026-11-16'), true);
});

test('Booking.canBeCancelled: статусы и дата начала тура', () => {
  const future = new Tour({ startDate: '2027-01-01' });
  const past = new Tour({ startDate: '2026-01-01' });
  const b = (status, tour) => new Booking({ status, tour });
  assert.equal(b(BookingStatus.Pending, future).canBeCancelled('2026-11-16'), true);
  assert.equal(b(BookingStatus.Confirmed, future).canBeCancelled('2026-11-16'), true);
  assert.equal(b(BookingStatus.Rejected, future).canBeCancelled('2026-11-16'), false);
  assert.equal(b(BookingStatus.Cancelled, future).canBeCancelled('2026-11-16'), false);
  assert.equal(b(BookingStatus.Pending, past).canBeCancelled('2026-11-16'), false);
});

test('todayString форматирует дату как ГГГГ-ММ-ДД', () => {
  assert.equal(todayString(new Date(2026, 0, 5)), '2026-01-05');
});
