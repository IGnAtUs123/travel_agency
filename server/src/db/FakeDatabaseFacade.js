import { Booking, BookingStatus, Tour, TourImage, User } from '../models.js';

/** Реализация фасада БД в памяти – для модульных тестов (поведение совпадает с DatabaseFacade). */
export class FakeDatabaseFacade {
  constructor() {
    this.users = [];
    this.tours = [];
    this.bookings = [];
    this.nextId = { user: 1, tour: 1, image: 1, booking: 1 };
    this.clock = () => new Date().toISOString();
  }

  // ---------------------------------------------------------------- пользователи
  async getUserByEmail(email) {
    const u = this.users.find((x) => x.email.toLowerCase() === String(email).toLowerCase());
    return u ? new User(u) : null;
  }

  async getUserById(id) {
    const u = this.users.find((x) => x.id === id);
    return u ? new User(u) : null;
  }

  async createUser(user) {
    if (await this.getUserByEmail(user.email)) {
      const err = new Error('duplicate key value violates unique constraint');
      err.code = '23505';
      throw err;
    }
    const id = this.nextId.user++;
    this.users.push(new User({ ...user, id, createdAt: this.clock() }));
    return id;
  }

  async updateUser(user) {
    const u = this.users.find((x) => x.id === user.id);
    if (!u) return;
    Object.assign(u, { fullName: user.fullName, phone: user.phone, birthDate: user.birthDate, passwordHash: user.passwordHash });
  }

  // ---------------------------------------------------------------- туры
  async getTours(filter) {
    const f = filter ?? {};
    const q = f.search ? String(f.search).toLowerCase() : null;
    return this.tours
      .filter((t) => !q || t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q))
      .filter((t) => !f.difficulty || t.difficulty === f.difficulty)
      .filter((t) => !f.season || t.season === f.season)
      .filter((t) => !f.minDays || t.durationDays >= f.minDays)
      .filter((t) => !f.maxDays || t.durationDays <= f.maxDays)
      .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.id - b.id)
      .map((t) => this.#clone(t));
  }

  async getTourById(id) {
    const t = this.tours.find((x) => x.id === id);
    if (!t) return null;
    const tour = this.#clone(t, true);
    const org = this.users.find((u) => u.id === t.adminId);
    tour.organizer = org ? { fullName: org.fullName, email: org.email, phone: org.phone } : null;
    return tour;
  }

  async getToursByAdmin(adminId) {
    return (await this.getTours()).filter((t) => t.adminId === adminId);
  }

  async createTour(tour) {
    const id = this.nextId.tour++;
    this.tours.push(new Tour({ ...tour, id, images: this.#images(id, tour.images), createdAt: this.clock() }));
    return id;
  }

  async updateTour(tour) {
    const t = this.tours.find((x) => x.id === tour.id);
    if (!t) return;
    Object.assign(t, {
      title: tour.title,
      description: tour.description,
      price: tour.price,
      startDate: tour.startDate,
      durationDays: tour.durationDays,
      difficulty: tour.difficulty,
      season: tour.season,
      images: this.#images(t.id, tour.images),
    });
  }

  #images(tourId, images) {
    return (images ?? []).map((img, i) => new TourImage({ id: this.nextId.image++, tourId, imagePath: img.imagePath, sortOrder: i + 1 }));
  }

  #clone(t, withImages = false) {
    const c = new Tour({ ...t, images: withImages ? t.images.map((i) => new TourImage(i)) : [] });
    c.cover = t.images[0]?.imagePath ?? null;
    return c;
  }

  // ---------------------------------------------------------------- заявки
  async createBooking(booking) {
    const id = this.nextId.booking++;
    this.bookings.push(
      new Booking({ id, userId: booking.userId, tourId: booking.tourId, status: booking.status ?? BookingStatus.Pending, createdAt: this.clock() }),
    );
    return id;
  }

  #withRefs(b) {
    const t = this.tours.find((x) => x.id === b.tourId);
    const u = this.users.find((x) => x.id === b.userId);
    return new Booking({
      ...b,
      tour: t ? new Tour({ id: t.id, adminId: t.adminId, title: t.title, price: t.price, startDate: t.startDate, durationDays: t.durationDays }) : null,
      user: u ? new User({ id: u.id, fullName: u.fullName, email: u.email, phone: u.phone, birthDate: u.birthDate }) : null,
    });
  }

  async getBookingById(id) {
    const b = this.bookings.find((x) => x.id === id);
    return b ? this.#withRefs(b) : null;
  }

  async getBookingsByUser(userId) {
    return this.bookings
      .filter((b) => b.userId === userId)
      .sort((a, b) => b.id - a.id)
      .map((b) => this.#withRefs(b));
  }

  async getBookingsByTour(tourId) {
    const pendingFirst = (b) => (b.status === BookingStatus.Pending ? 0 : 1);
    return this.bookings
      .filter((b) => b.tourId === tourId)
      .sort((a, b) => pendingFirst(a) - pendingFirst(b) || a.id - b.id)
      .map((b) => this.#withRefs(b));
  }

  async updateBookingStatus(id, status) {
    const b = this.bookings.find((x) => x.id === id);
    if (!b) return;
    b.status = status;
    if (status === BookingStatus.Confirmed || status === BookingStatus.Rejected) b.processedAt = this.clock();
  }
}
