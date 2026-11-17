# Туристическое агентство

Информационная система: каталог туров, бронирование, личный кабинет клиента и панель администратора.
Стек: **React 19 + Vite** (клиент), **Node.js 22 + Express 4** (сервер, REST API), **PostgreSQL 16**.

## Структура

```
database/schema.sql   схема БД и справочники
server/               Express API (контроллеры, фасад БД, сервисы, тесты)
client/               React-приложение (Vite)
```

Роли: гость (просмотр каталога), клиент (бронирование, профиль), администратор (создание/редактирование
туров, обработка заявок). Администратор не может бронировать собственные туры.

## Требования

Node.js 22+, PostgreSQL 14+ (разрабатывалось на 16), npm.

## Установка и запуск

```bash
# 1. База данных
createdb travel_agency            # или через pgAdmin

# 2. Зависимости
npm run install:all

# 3. Настройки сервера
cp server/.env.example server/.env   # задайте DATABASE_URL, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD

# 4. Таблицы и начальные данные
npm run migrate                      # npm run migrate -- --reset пересоздаёт схему
npm run seed                         # создаёт администратора
npm run seed -- --demo               # + тестовый клиент user@travel.local / User123! и 5 туров
```

### Разработка

```bash
npm run dev:server    # API на http://localhost:3000
npm run dev:client    # клиент на http://localhost:5173 (запросы /api и /uploads проксируются на :3000)
```

### Продакшен

```bash
npm run build         # собирает клиент в client/dist
NODE_ENV=production npm start   # Express отдаёт и API, и собранный клиент на http://localhost:3000
```

В production обязательно задайте `JWT_SECRET`; при работе по HTTPS — `COOKIE_SECURE=true`.

## REST API

| Метод | Путь | Доступ |
|---|---|---|
| GET | `/api/dictionaries` | все |
| POST | `/api/auth/register`, `/api/auth/login`, `/api/auth/logout` | все |
| GET | `/api/auth/me` | все |
| GET | `/api/tours`, `/api/tours/:id` | все (фильтры: `search`, `difficulty`, `season`, `minDays`, `maxDays`) |
| POST | `/api/bookings` | клиент |
| GET | `/api/bookings/my` | клиент |
| POST | `/api/bookings/:id/cancel` | владелец заявки |
| GET, PUT | `/api/profile` | клиент |
| GET, POST | `/api/admin/tours` | администратор |
| PUT | `/api/admin/tours/:id` | автор тура |
| GET | `/api/admin/tours/:id/requests` | автор тура |
| POST | `/api/admin/bookings/:id/approve`, `/reject` | автор тура |
| POST | `/api/admin/uploads` | администратор (тело — изображение JPG/PNG до 5 МБ) |

Аутентификация — JWT в HttpOnly-cookie `token` (7 дней), пароли хранятся как scrypt-хэши.

## Тесты

```bash
npm test                                   # модульные тесты на node:test с FakeDatabaseFacade (БД не нужна)
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/travel_test npm test
```

Со второй командой дополнительно выполняются интеграционные тесты `DatabaseFacade` на реальной PostgreSQL.
**Используйте отдельную базу: тесты очищают таблицы** (схему предварительно создайте через `migrate`
с `DATABASE_URL`, указывающим на тестовую БД).

## Заметки

- Правила бронирования: недоступно, если тур не найден, уже начался или создан самим пользователем;
  отмена — только для заявок «Ожидает»/«Подтверждено» на ещё не начавшийся тур.
- К туру можно загрузить до 5 изображений; тип проверяется по сигнатуре файла, а не по расширению.
