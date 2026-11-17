import { AdminTourController } from './controllers/AdminTourController.js';
import { AuthController } from './controllers/AuthController.js';
import { BookingController } from './controllers/BookingController.js';
import { ProfileController } from './controllers/ProfileController.js';
import { TourController } from './controllers/TourController.js';
import { PasswordHasher } from './services/PasswordHasher.js';
import { TokenService } from './services/TokenService.js';
import { ImageStorage } from './services/ImageStorage.js';

/** Создаёт все контроллеры и сервисы для заданного фасада БД. */
export function createServices({ db, config, clock = () => new Date(), hasher = new PasswordHasher() }) {
  const tokens = new TokenService(config.jwtSecret);
  const storage = new ImageStorage(config.uploadDir);
  const controllers = {
    auth: new AuthController({ db, hasher, tokens, clock }),
    tours: new TourController({ db, clock }),
    bookings: new BookingController({ db, clock }),
    profile: new ProfileController({ db, hasher, clock }),
    admin: new AdminTourController({ db, storage, clock }),
  };
  return { controllers, tokens, storage, hasher };
}
