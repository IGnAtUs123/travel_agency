-- ===== СПРАВОЧНИКИ =====

-- Роли пользователей
CREATE TABLE roles (
    role_id   SERIAL PRIMARY KEY,
    role_name VARCHAR(30) NOT NULL UNIQUE
);

-- Уровни сложности туров
CREATE TABLE difficulty_levels (
    difficulty_id SERIAL PRIMARY KEY,
    level_name    VARCHAR(30) NOT NULL UNIQUE
);

-- Сезоны проведения туров
CREATE TABLE seasons (
    season_id   SERIAL PRIMARY KEY,
    season_name VARCHAR(20) NOT NULL UNIQUE
);

-- Статусы заявок на бронирование
CREATE TABLE booking_statuses (
    status_id   SERIAL PRIMARY KEY,
    status_name VARCHAR(30) NOT NULL UNIQUE
);

-- ===== ТАБЛИЦЫ =====

-- Пользователи
CREATE TABLE users (
    user_id       SERIAL PRIMARY KEY,
    role_id       INT NOT NULL REFERENCES roles(role_id),
    full_name     VARCHAR(150) NOT NULL,
    email         VARCHAR(100) NOT NULL UNIQUE,
    phone         VARCHAR(20) NOT NULL,
    birth_date    DATE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Туры
CREATE TABLE tours (
    tour_id       SERIAL PRIMARY KEY,
    admin_id      INT NOT NULL REFERENCES users(user_id),
    difficulty_id INT NOT NULL REFERENCES difficulty_levels(difficulty_id),
    season_id     INT NOT NULL REFERENCES seasons(season_id),
    title         VARCHAR(150) NOT NULL,
    description   TEXT NOT NULL,
    price         NUMERIC(10,2) NOT NULL CHECK (price > 0),
    start_date    DATE NOT NULL,
    duration_days INT NOT NULL CHECK (duration_days > 0),
    created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Изображения туров (не более 5 у одного тура)
CREATE TABLE tour_images (
    image_id   SERIAL PRIMARY KEY,
    tour_id    INT NOT NULL REFERENCES tours(tour_id) ON DELETE CASCADE,
    image_path VARCHAR(255) NOT NULL,
    sort_order SMALLINT NOT NULL CHECK (sort_order BETWEEN 1 AND 5),
    UNIQUE (tour_id, sort_order)
);

-- Заявки на бронирование
CREATE TABLE bookings (
    booking_id   SERIAL PRIMARY KEY,
    user_id      INT NOT NULL REFERENCES users(user_id),
    tour_id      INT NOT NULL REFERENCES tours(tour_id),
    status_id    INT NOT NULL DEFAULT 1 REFERENCES booking_statuses(status_id),
    created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP
);

-- ===== ИНДЕКСЫ =====
-- Email уникален без учёта регистра
CREATE UNIQUE INDEX ux_users_email_lower ON users (lower(email));
CREATE INDEX idx_tours_admin     ON tours(admin_id);
CREATE INDEX idx_bookings_user   ON bookings(user_id);
CREATE INDEX idx_bookings_tour   ON bookings(tour_id);

-- ===== НАЧАЛЬНЫЕ ДАННЫЕ =====
INSERT INTO roles (role_name) VALUES ('Пользователь'), ('Администратор');

INSERT INTO difficulty_levels (level_name)
VALUES ('Новичок'), ('Средний'), ('Продвинутый'), ('Экстремальный');

INSERT INTO seasons (season_name)
VALUES ('Зима'), ('Весна'), ('Лето'), ('Осень');

-- Порядок важен: статус по умолчанию для заявки – «Ожидает» (status_id = 1)
INSERT INTO booking_statuses (status_name)
VALUES ('Ожидает'), ('Подтверждено'), ('Отклонено'), ('Отменено');
