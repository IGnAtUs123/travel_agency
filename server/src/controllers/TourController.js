import { Difficulty, Season, TourFilter, todayString } from '../models.js';
import { notFound } from '../http/errors.js';
import { dictionaries, presentTour, presentTourCard } from './presenters.js';
import { parseId } from './validators.js';

const posInt = (v) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};
const oneOf = (v, enumObj) => {
  const n = Number(v);
  return Object.values(enumObj).includes(n) ? n : null;
};

export class TourController {
  constructor({ db, clock = () => new Date() }) {
    this.db = db;
    this.clock = clock;
  }

  /** Список туров с поиском и фильтрами. */
  async index(ctx) {
    const q = ctx.query ?? {};
    const filter = new TourFilter({
      search: typeof q.search === 'string' ? q.search.trim().slice(0, 100) : '',
      difficulty: oneOf(q.difficulty, Difficulty),
      season: oneOf(q.season, Season),
      minDays: posInt(q.minDays),
      maxDays: posInt(q.maxDays),
    });
    const tours = await this.db.getTours(filter);
    return { status: 200, body: { tours: tours.map(presentTourCard) } };
  }

  /** Страница тура. */
  async details(ctx) {
    const id = parseId(ctx.params.id);
    const tour = id ? await this.db.getTourById(id) : null;
    if (!tour) throw notFound('Тур не найден');
    return { status: 200, body: { tour: presentTour(tour, { user: ctx.user, today: todayString(this.clock()) }) } };
  }

  async dictionaries() {
    return { status: 200, body: dictionaries() };
  }
}
