// Модели предметной области. Значения перечислений совпадают с идентификаторами
// справочников в базе данных (roles, difficulty_levels, seasons, booking_statuses).

export const Role = Object.freeze({ Client: 1, Admin: 2 });
export const Difficulty = Object.freeze({ Beginner: 1, Medium: 2, Advanced: 3, Extreme: 4 });
export const Season = Object.freeze({ Winter: 1, Spring: 2, Summer: 3, Autumn: 4 });
export const BookingStatus = Object.freeze({ Pending: 1, Confirmed: 2, Rejected: 3, Cancelled: 4 });

export const ROLE_NAMES = { 1: 'Пользователь', 2: 'Администратор' };
export const DIFFICULTY_NAMES = { 1: 'Новичок', 2: 'Средний', 3: 'Продвинутый', 4: 'Экстремальный' };
export const SEASON_NAMES = { 1: 'Зима', 2: 'Весна', 3: 'Лето', 4: 'Осень' };
export const STATUS_NAMES = { 1: 'Ожидает', 2: 'Подтверждено', 3: 'Отклонено', 4: 'Отменено' };

export const MAX_IMAGES = 5;

/** Текущая дата в формате ГГГГ-ММ-ДД (по локальному времени сервера). */
export function todayString(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

export class User {
  constructor(p = {}) {
    this.id = p.id ?? null;
    this.fullName = p.fullName ?? '';
    this.email = p.email ?? '';
    this.phone = p.phone ?? '';
    this.birthDate = p.birthDate ?? '';
    this.passwordHash = p.passwordHash ?? '';
    this.role = p.role ?? Role.Client;
    this.createdAt = p.createdAt ?? null;
  }

  get isAdmin() {
    return this.role === Role.Admin;
  }

  /** Полных лет на дату today (ГГГГ-ММ-ДД). */
  getAge(today = todayString()) {
    const [by, bm, bd] = this.birthDate.split('-').map(Number);
    const [ty, tm, td] = today.split('-').map(Number);
    let age = ty - by;
    if (tm < bm || (tm === bm && td < bd)) age -= 1;
    return age;
  }
}

export class TourImage {
  constructor(p = {}) {
    this.id = p.id ?? null;
    this.tourId = p.tourId ?? null;
    this.imagePath = p.imagePath ?? '';
    this.sortOrder = p.sortOrder ?? 1;
  }
}

export class Tour {
  constructor(p = {}) {
    this.id = p.id ?? null;
    this.adminId = p.adminId ?? null;
    this.title = p.title ?? '';
    this.description = p.description ?? '';
    this.price = p.price ?? 0;
    this.startDate = p.startDate ?? '';
    this.durationDays = p.durationDays ?? 1;
    this.difficulty = p.difficulty ?? Difficulty.Beginner;
    this.season = p.season ?? Season.Summer;
    this.images = p.images ?? []; // TourImage[]
    this.cover = p.cover ?? null; // путь к первому изображению (для списка)
    this.organizer = p.organizer ?? null; // { fullName, email, phone }
    this.createdAt = p.createdAt ?? null;
  }

  /** Тур начался, если дата начала наступила (сегодня или раньше). */
  hasStarted(today = todayString()) {
    return this.startDate <= today;
  }
}

export class Booking {
  constructor(p = {}) {
    this.id = p.id ?? null;
    this.userId = p.userId ?? null;
    this.tourId = p.tourId ?? null;
    this.status = p.status ?? BookingStatus.Pending;
    this.createdAt = p.createdAt ?? null;
    this.processedAt = p.processedAt ?? null;
    this.tour = p.tour ?? null; // Tour (частично заполненный)
    this.user = p.user ?? null; // User (заявитель)
  }

  /** Заявку можно отменить: статус «Ожидает» или «Подтверждено» и тур ещё не начался. */
  canBeCancelled(today = todayString()) {
    const active = this.status === BookingStatus.Pending || this.status === BookingStatus.Confirmed;
    return active && !!this.tour && !this.tour.hasStarted(today);
  }
}

export class TourFilter {
  constructor(p = {}) {
    this.search = p.search ?? '';
    this.difficulty = p.difficulty ?? null;
    this.season = p.season ?? null;
    this.minDays = p.minDays ?? null;
    this.maxDays = p.maxDays ?? null;
  }
}
