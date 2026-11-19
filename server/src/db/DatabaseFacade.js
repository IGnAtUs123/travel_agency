import { Booking, BookingStatus, Tour, TourImage, User } from "../models.js";

const num = (v) => (v === null || v === undefined ? null : Number(v));
const iso = (v) => (v instanceof Date ? v.toISOString() : (v ?? null));

const USER_COLS = `u.user_id, u.role_id, u.full_name, u.email, u.phone,
  to_char(u.birth_date, 'YYYY-MM-DD') AS birth_date, u.password_hash, u.created_at`;

const TOUR_COLS = `t.tour_id, t.admin_id, t.title, t.description, t.price,
  to_char(t.start_date, 'YYYY-MM-DD') AS start_date, t.duration_days,
  t.difficulty_id, t.season_id, t.created_at`;

const BOOKING_SELECT = `
  SELECT b.booking_id, b.user_id, b.tour_id, b.status_id, b.created_at, b.processed_at,
         t.admin_id, t.title, t.price, to_char(t.start_date, 'YYYY-MM-DD') AS start_date, t.duration_days,
         u.full_name, u.email, u.phone, to_char(u.birth_date, 'YYYY-MM-DD') AS birth_date
  FROM bookings b
  JOIN tours t ON t.tour_id = b.tour_id
  JOIN users u ON u.user_id = b.user_id`;

function mapUser(r) {
  return new User({
    id: num(r.user_id),
    role: num(r.role_id),
    fullName: r.full_name,
    email: r.email,
    phone: r.phone,
    birthDate: r.birth_date,
    passwordHash: r.password_hash,
    createdAt: iso(r.created_at),
  });
}

function mapTour(r) {
  return new Tour({
    id: num(r.tour_id),
    adminId: num(r.admin_id),
    title: r.title,
    description: r.description,
    price: Number(r.price),
    startDate: r.start_date,
    durationDays: num(r.duration_days),
    difficulty: num(r.difficulty_id),
    season: num(r.season_id),
    cover: r.cover ?? null,
    createdAt: iso(r.created_at),
  });
}

function mapBooking(r) {
  return new Booking({
    id: num(r.booking_id),
    userId: num(r.user_id),
    tourId: num(r.tour_id),
    status: num(r.status_id),
    createdAt: iso(r.created_at),
    processedAt: iso(r.processed_at),
    tour: new Tour({
      id: num(r.tour_id),
      adminId: num(r.admin_id),
      title: r.title,
      price: Number(r.price),
      startDate: r.start_date,
      durationDays: num(r.duration_days),
    }),
    user: new User({
      id: num(r.user_id),
      fullName: r.full_name,
      email: r.email,
      phone: r.phone,
      birthDate: r.birth_date,
    }),
  });
}

export class DatabaseFacade {
  constructor(pool) {
    this.pool = pool;
  }

  async #tx(fn) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await fn(client);
      await client.query("COMMIT");
      return result;
    } catch (e) {
      try {
        await client.query("ROLLBACK");
      } catch {
        /* соединение уже потеряно */
      }
      throw e;
    } finally {
      client.release();
    }
  }

  async getUserByEmail(email) {
    const { rows } = await this.pool.query(
      `SELECT ${USER_COLS} FROM users u WHERE lower(u.email) = lower($1)`,
      [email],
    );
    return rows[0] ? mapUser(rows[0]) : null;
  }

  async getUserById(id) {
    const { rows } = await this.pool.query(
      `SELECT ${USER_COLS} FROM users u WHERE u.user_id = $1`,
      [id],
    );
    return rows[0] ? mapUser(rows[0]) : null;
  }

  async createUser(user) {
    const { rows } = await this.pool.query(
      `INSERT INTO users (role_id, full_name, email, phone, birth_date, password_hash)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING user_id`,
      [
        user.role,
        user.fullName,
        user.email,
        user.phone,
        user.birthDate,
        user.passwordHash,
      ],
    );
    return num(rows[0].user_id);
  }

  async updateUser(user) {
    await this.pool.query(
      `UPDATE users SET full_name = $2, phone = $3, birth_date = $4, password_hash = $5
       WHERE user_id = $1`,
      [user.id, user.fullName, user.phone, user.birthDate, user.passwordHash],
    );
  }

  async getTours(filter) {
    const where = [];
    const params = [];
    const add = (sql, value) => {
      params.push(value);
      where.push(sql.replace("?", `$${params.length}`));
    };
    if (filter?.search) {
      params.push(`%${String(filter.search).replace(/[\\%_]/g, "\\$&")}%`);
      const n = params.length;
      where.push(`(t.title ILIKE $${n} OR t.description ILIKE $${n})`);
    }
    if (filter?.difficulty) add("t.difficulty_id = ?", filter.difficulty);
    if (filter?.season) add("t.season_id = ?", filter.season);
    if (filter?.minDays) add("t.duration_days >= ?", filter.minDays);
    if (filter?.maxDays) add("t.duration_days <= ?", filter.maxDays);
    const sql = `SELECT ${TOUR_COLS},
        (SELECT i.image_path FROM tour_images i WHERE i.tour_id = t.tour_id ORDER BY i.sort_order LIMIT 1) AS cover
      FROM tours t
      ${where.length ? "WHERE " + where.join(" AND ") : ""}
      ORDER BY t.start_date, t.tour_id`;
    const { rows } = await this.pool.query(sql, params);
    return rows.map(mapTour);
  }

  async getTourById(id) {
    const { rows } = await this.pool.query(
      `SELECT ${TOUR_COLS}, u.full_name AS org_name, u.email AS org_email, u.phone AS org_phone
       FROM tours t JOIN users u ON u.user_id = t.admin_id
       WHERE t.tour_id = $1`,
      [id],
    );
    if (!rows[0]) return null;
    const tour = mapTour(rows[0]);
    tour.organizer = {
      fullName: rows[0].org_name,
      email: rows[0].org_email,
      phone: rows[0].org_phone,
    };
    const imgs = await this.pool.query(
      `SELECT image_id, tour_id, image_path, sort_order FROM tour_images WHERE tour_id = $1 ORDER BY sort_order`,
      [id],
    );
    tour.images = imgs.rows.map(
      (r) =>
        new TourImage({
          id: num(r.image_id),
          tourId: num(r.tour_id),
          imagePath: r.image_path,
          sortOrder: num(r.sort_order),
        }),
    );
    tour.cover = tour.images[0]?.imagePath ?? null;
    return tour;
  }

  async getToursByAdmin(adminId) {
    const { rows } = await this.pool.query(
      `SELECT ${TOUR_COLS},
          (SELECT i.image_path FROM tour_images i WHERE i.tour_id = t.tour_id ORDER BY i.sort_order LIMIT 1) AS cover
       FROM tours t WHERE t.admin_id = $1 ORDER BY t.start_date, t.tour_id`,
      [adminId],
    );
    return rows.map(mapTour);
  }

  async createTour(tour) {
    return this.#tx(async (c) => {
      const { rows } = await c.query(
        `INSERT INTO tours (admin_id, difficulty_id, season_id, title, description, price, start_date, duration_days)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING tour_id`,
        [
          tour.adminId,
          tour.difficulty,
          tour.season,
          tour.title,
          tour.description,
          tour.price,
          tour.startDate,
          tour.durationDays,
        ],
      );
      const id = num(rows[0].tour_id);
      await this.#insertImages(c, id, tour.images);
      return id;
    });
  }

  async updateTour(tour) {
    await this.#tx(async (c) => {
      await c.query(
        `UPDATE tours SET difficulty_id = $2, season_id = $3, title = $4, description = $5,
                price = $6, start_date = $7, duration_days = $8
         WHERE tour_id = $1`,
        [
          tour.id,
          tour.difficulty,
          tour.season,
          tour.title,
          tour.description,
          tour.price,
          tour.startDate,
          tour.durationDays,
        ],
      );
      await c.query("DELETE FROM tour_images WHERE tour_id = $1", [tour.id]);
      await this.#insertImages(c, tour.id, tour.images);
    });
  }

  async #insertImages(client, tourId, images) {
    let order = 1;
    for (const img of images ?? []) {
      await client.query(
        `INSERT INTO tour_images (tour_id, image_path, sort_order) VALUES ($1, $2, $3)`,
        [tourId, img.imagePath, order++],
      );
    }
  }

  async createBooking(booking) {
    const { rows } = await this.pool.query(
      `INSERT INTO bookings (user_id, tour_id, status_id) VALUES ($1, $2, $3) RETURNING booking_id`,
      [booking.userId, booking.tourId, booking.status ?? BookingStatus.Pending],
    );
    return num(rows[0].booking_id);
  }

  async getBookingById(id) {
    const { rows } = await this.pool.query(
      `${BOOKING_SELECT} WHERE b.booking_id = $1`,
      [id],
    );
    return rows[0] ? mapBooking(rows[0]) : null;
  }

  async getBookingsByUser(userId) {
    const { rows } = await this.pool.query(
      `${BOOKING_SELECT} WHERE b.user_id = $1 ORDER BY b.created_at DESC, b.booking_id DESC`,
      [userId],
    );
    return rows.map(mapBooking);
  }

  async getBookingsByTour(tourId) {
    const { rows } = await this.pool.query(
      `${BOOKING_SELECT} WHERE b.tour_id = $1
       ORDER BY (b.status_id = 1) DESC, b.created_at, b.booking_id`,
      [tourId],
    );
    return rows.map(mapBooking);
  }

  async updateBookingStatus(id, status) {
    await this.pool.query(
      `UPDATE bookings
       SET status_id = $2::int,
           processed_at = CASE WHEN $2::int IN (2, 3) THEN CURRENT_TIMESTAMP ELSE processed_at END
       WHERE booking_id = $1`,
      [id, status],
    );
  }
}
