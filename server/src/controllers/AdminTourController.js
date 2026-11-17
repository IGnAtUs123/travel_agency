import { BookingStatus, Tour, TourImage, todayString } from '../models.js';
import { badRequest, conflict, forbidden, notFound } from '../http/errors.js';
import { requireAdmin } from './guards.js';
import { presentRequest, presentTourCard } from './presenters.js';
import { parseId, validateTour } from './validators.js';

export class AdminTourController {
  constructor({ db, storage, clock = () => new Date() }) {
    this.db = db;
    this.storage = storage;
    this.clock = clock;
  }

  /** Вкладка «Мои туры». */
  async myTours(ctx) {
    const admin = requireAdmin(ctx);
    const tours = await this.db.getToursByAdmin(admin.id);
    return { status: 200, body: { tours: tours.map(presentTourCard) } };
  }

  /** Загрузка одного изображения (тело запроса – файл). Возвращает путь к сохранённому файлу. */
  async upload(ctx) {
    requireAdmin(ctx);
    try {
      const path = await this.storage.save(ctx.rawBody);
      return { status: 201, body: { path } };
    } catch (e) {
      throw badRequest(e.message || 'Не удалось загрузить изображение');
    }
  }

  async create(ctx) {
    const admin = requireAdmin(ctx);
    const data = validateTour(ctx.body, (p) => this.storage.isValidPath(p));
    const tour = this.#toTour(data, { adminId: admin.id });
    const id = await this.db.createTour(tour);
    return { status: 201, body: { id } };
  }

  async update(ctx) {
    const admin = requireAdmin(ctx);
    const existing = await this.#ownTour(ctx, admin);
    const data = validateTour(ctx.body, (p) => this.storage.isValidPath(p));
    await this.db.updateTour(this.#toTour(data, { id: existing.id, adminId: existing.adminId }));
    return { status: 200, body: { id: existing.id } };
  }

  /** Заявки на тур вместе с данными заявителей. */
  async requests(ctx) {
    const admin = requireAdmin(ctx);
    const tour = await this.#ownTour(ctx, admin);
    const today = todayString(this.clock());
    const list = await this.db.getBookingsByTour(tour.id);
    return {
      status: 200,
      body: {
        tour: { id: tour.id, title: tour.title, startDate: tour.startDate },
        requests: list.map((b) => presentRequest(b, today)),
      },
    };
  }

  approve(ctx) {
    return this.#process(ctx, BookingStatus.Confirmed);
  }

  reject(ctx) {
    return this.#process(ctx, BookingStatus.Rejected);
  }

  async #process(ctx, status) {
    const admin = requireAdmin(ctx);
    const id = parseId(ctx.params.id);
    const booking = id ? await this.db.getBookingById(id) : null;
    if (!booking) throw notFound('Заявка не найдена');
    if (booking.tour.adminId !== admin.id) throw forbidden();
    if (booking.status !== BookingStatus.Pending) throw conflict('Заявка уже обработана');
    await this.db.updateBookingStatus(id, status);
    return { status: 200, body: { ok: true, tourId: booking.tourId } };
  }

  async #ownTour(ctx, admin) {
    const id = parseId(ctx.params.id);
    const tour = id ? await this.db.getTourById(id) : null;
    if (!tour) throw notFound('Тур не найден');
    if (tour.adminId !== admin.id) throw forbidden('Тур создан другим администратором');
    return tour;
  }

  #toTour(data, extra) {
    return new Tour({
      ...extra,
      title: data.title,
      description: data.description,
      price: data.price,
      startDate: data.startDate,
      durationDays: data.durationDays,
      difficulty: data.difficulty,
      season: data.season,
      images: data.images.map((p, i) => new TourImage({ imagePath: p, sortOrder: i + 1 })),
    });
  }
}
