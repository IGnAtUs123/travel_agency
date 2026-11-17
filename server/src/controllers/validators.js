import { Difficulty, MAX_IMAGES, Season } from '../models.js';
import { badRequest } from '../http/errors.js';

export const MIN_PASSWORD = 6;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const str = (v) => (typeof v === 'string' ? v.trim() : '');

export function isValidDate(s) {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function parseId(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function throwIfErrors(fields) {
  if (Object.keys(fields).length) throw badRequest('Проверьте правильность заполнения полей', fields);
}

/** Проверка данных регистрации; возвращает очищенные значения. */
export function validateRegistration(body = {}, today) {
  const f = {};
  const fullName = str(body.fullName);
  const email = str(body.email).toLowerCase();
  const phone = str(body.phone).replace(/[\s()-]/g, '');
  const birthDate = str(body.birthDate);
  const password = typeof body.password === 'string' ? body.password : '';
  if (!fullName) f.fullName = 'Введите ФИО';
  else if (fullName.length > 150) f.fullName = 'Слишком длинное значение';
  if (!EMAIL_RE.test(email) || email.length > 100) f.email = 'Введите корректный Email';
  if (!/^\+?\d{10,15}$/.test(phone)) f.phone = 'Введите корректный номер телефона';
  if (!isValidDate(birthDate) || birthDate > today || birthDate < '1900-01-01') f.birthDate = 'Введите корректную дату рождения';
  if (password.length < MIN_PASSWORD) f.password = `Пароль должен содержать не менее ${MIN_PASSWORD} символов`;
  else if (password !== body.confirmPassword) f.confirmPassword = 'Пароли не совпадают';
  throwIfErrors(f);
  return { fullName, email, phone, birthDate, password };
}

/** Проверка редактирования профиля; пароль необязателен. */
export function validateProfile(body = {}, today) {
  const f = {};
  const fullName = str(body.fullName);
  const phone = str(body.phone).replace(/[\s()-]/g, '');
  const birthDate = str(body.birthDate);
  const password = typeof body.password === 'string' ? body.password : '';
  if (!fullName) f.fullName = 'Введите ФИО';
  else if (fullName.length > 150) f.fullName = 'Слишком длинное значение';
  if (!/^\+?\d{10,15}$/.test(phone)) f.phone = 'Введите корректный номер телефона';
  if (!isValidDate(birthDate) || birthDate > today || birthDate < '1900-01-01') f.birthDate = 'Введите корректную дату рождения';
  if (password) {
    if (password.length < MIN_PASSWORD) f.password = `Пароль должен содержать не менее ${MIN_PASSWORD} символов`;
    else if (password !== body.confirmPassword) f.confirmPassword = 'Пароли не совпадают';
  }
  throwIfErrors(f);
  return { fullName, phone, birthDate, password: password || null };
}

/** Проверка данных тура; imageValidator(path) -> boolean. */
export function validateTour(body = {}, imageValidator) {
  const f = {};
  const title = str(body.title);
  const description = str(body.description);
  const price = Number(body.price);
  const startDate = str(body.startDate);
  const durationDays = Number(body.durationDays);
  const difficulty = Number(body.difficulty);
  const season = Number(body.season);
  const images = Array.isArray(body.images) ? body.images : [];

  if (!title) f.title = 'Введите название';
  else if (title.length > 150) f.title = 'Слишком длинное название';
  if (!description) f.description = 'Введите описание';
  if (body.price === '' || body.price == null || !Number.isFinite(price) || price <= 0 || price > 99999999.99)
    f.price = 'Цена должна быть больше нуля';
  if (!isValidDate(startDate)) f.startDate = 'Введите корректную дату начала';
  if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 365) f.durationDays = 'Длительность – от 1 до 365 дней';
  if (!Object.values(Difficulty).includes(difficulty)) f.difficulty = 'Выберите сложность';
  if (!Object.values(Season).includes(season)) f.season = 'Выберите сезон';
  if (images.length > MAX_IMAGES) f.images = `Не более ${MAX_IMAGES} изображений`;
  else if (new Set(images).size !== images.length || !images.every((p) => imageValidator(p))) f.images = 'Некорректный список изображений';

  throwIfErrors(f);
  return { title, description, price: Math.round(price * 100) / 100, startDate, durationDays, difficulty, season, images };
}
