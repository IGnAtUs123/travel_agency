import { Booking, BookingStatus, todayString } from '../models.js';
import { badRequest, notFound } from '../http/errors.js';
import { requireAuth } from './guards.js';
import { presentBooking } from './presenters.js';
import { parseId } from './validators.js';

export class BookingController {
  constructor({ db, clock = () => new Date() }) {
    this.db = db;
    this.clock = clock;
  }

  /** Бронирование тура: создаёт заявку со статусом «Ожидает». */
  async create(ctx) {
    const user = requireAuth(ctx);
    const tourId = parseId(ctx.body?.tourId);
    const tour = tourId ? await this.db.getTourById(tourId) : null;
    // тур не найден, уже начался или создан этим же пользователем
    if (!tour || tour.hasStarted(todayString(this.clock())) || tour.adminId === user.id) {
      throw badRequest('Бронирование недоступно');
    }
    const id = await this.db.createBooking(new Booking({ userId: user.id, tourId, status: BookingStatus.Pending }));
    return { status: 201, body: { id } };
  }

  /** Список заявок текущего пользователя. */
  async myBookings(ctx) {
    const user = requireAuth(ctx);
    const today = todayString(this.clock());
    const list = await this.db.getBookingsByUser(user.id);
    return { status: 200, body: { bookings: list.map((b) => presentBooking(b, today)) } };
  }

  /** Отмена заявки пользователем (статусы «Ожидает» и «Подтверждено», тур ещё не начался). */
  async cancel(ctx) {
    const user = requireAuth(ctx);
    const id = parseId(ctx.params.id);
    const booking = id ? await this.db.getBookingById(id) : null;
    if (!booking || booking.userId !== user.id) throw notFound('Заявка не найдена');
    if (!booking.canBeCancelled(todayString(this.clock()))) throw badRequest('Эту заявку нельзя отменить');
    await this.db.updateBookingStatus(id, BookingStatus.Cancelled);
    return { status: 200, body: { ok: true } };
  }
}
