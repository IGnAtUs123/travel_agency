// Начальные данные: npm run seed [-- --demo]
// Создаёт учётную запись администратора; с --demo добавляет тестового пользователя и туры.
import pg from 'pg';
import { loadConfig } from '../src/config.js';
import { DatabaseFacade } from '../src/db/DatabaseFacade.js';
import { Booking, BookingStatus, Difficulty, Role, Season, Tour, User } from '../src/models.js';
import { PasswordHasher } from '../src/services/PasswordHasher.js';

const config = loadConfig();
const demo = process.argv.includes('--demo');
const pool = new pg.Pool({ connectionString: config.databaseUrl });
const db = new DatabaseFacade(pool);
const hasher = new PasswordHasher();

const addDays = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

try {
  let admin = await db.getUserByEmail(config.adminEmail);
  if (!admin) {
    const id = await db.createUser(
      new User({
        fullName: 'Администратор',
        email: config.adminEmail,
        phone: '+70000000000',
        birthDate: '1990-01-01',
        passwordHash: await hasher.hash(config.adminPassword),
        role: Role.Admin,
      }),
    );
    admin = await db.getUserById(id);
    console.log(`Создан администратор: ${config.adminEmail} / ${config.adminPassword} (смените пароль после входа)`);
  } else {
    console.log('Администратор уже существует.');
  }

  if (demo && (await db.getToursByAdmin(admin.id)).length === 0) {
    const clientId = await db.createUser(
      new User({
        fullName: 'Иванов Иван Иванович',
        email: 'user@travel.local',
        phone: '+79001234567',
        birthDate: '2000-05-17',
        passwordHash: await hasher.hash('User123!'),
        role: Role.Client,
      }),
    );
    const tours = [
      ['Восхождение на пик Грандиозный', 'Классический маршрут на пик Грандиозный с ночёвками в палатках. Опытные инструкторы, полное снаряжение.', 2900, addDays(30), 3, Difficulty.Medium, Season.Summer],
      ['Зимний Байкал на коньках', 'Катание по прозрачному льду Байкала, ночёвка на берегу и баня с видом на озеро.', 18500, addDays(60), 4, Difficulty.Beginner, Season.Winter],
      ['Сплав по реке Катунь', 'Семидневный сплав по порогам Катуни с остановками у горячих источников.', 42000, addDays(90), 7, Difficulty.Advanced, Season.Summer],
      ['Осенний трекинг по Ергакам', 'Пешие маршруты среди золотой тайги и горных озёр Ергаков.', 21000, addDays(120), 5, Difficulty.Medium, Season.Autumn],
      ['Экстремальный лыжный спуск', 'Фрирайд на нетронутых склонах с вертолётной заброской.', 76000, addDays(150), 6, Difficulty.Extreme, Season.Winter],
    ];
    const ids = [];
    for (const [title, description, price, startDate, durationDays, difficulty, season] of tours) {
      ids.push(await db.createTour(new Tour({ adminId: admin.id, title, description, price, startDate, durationDays, difficulty, season, images: [] })));
    }
    await db.createBooking(new Booking({ userId: clientId, tourId: ids[0], status: BookingStatus.Pending }));
    await db.createBooking(new Booking({ userId: clientId, tourId: ids[1], status: BookingStatus.Pending }));
    console.log('Добавлены демо-данные: пользователь user@travel.local / User123! и 5 туров.');
  }
} finally {
  await pool.end();
}
