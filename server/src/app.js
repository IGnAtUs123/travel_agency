import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { authenticate, dispatch, setCookieHeader } from './http/dispatch.js';
import { buildRoutes } from './http/routes.js';

/** Собирает Express-приложение. controllers: { auth, tours, bookings, profile, admin }. */
export function createApp({ db, controllers, tokens, config }) {
  const app = express();
  app.disable('x-powered-by');

  app.use('/uploads', express.static(config.uploadDir, { fallthrough: false, maxAge: '7d' }));

  const jsonParser = express.json({ limit: '100kb' });
  const rawParser = express.raw({ type: ['image/png', 'image/jpeg'], limit: '5mb' });

  for (const route of buildRoutes(controllers)) {
    app[route.method.toLowerCase()](route.path, route.raw ? rawParser : jsonParser, async (req, res) => {
      const user = await authenticate(req.headers.cookie, tokens, db);
      const ctx = {
        params: req.params,
        query: req.query,
        body: route.raw ? undefined : req.body ?? {},
        rawBody: route.raw ? req.body : undefined,
        user,
      };
      const result = await dispatch(route, ctx);
      const cookie = setCookieHeader(result, config);
      if (cookie) res.setHeader('Set-Cookie', cookie);
      res.status(result.status).json(result.body ?? {});
    });
  }

  // неизвестные маршруты API
  app.use('/api', (req, res) => res.status(404).json({ error: 'Не найдено' }));

  // собранный клиент (npm run build в папке client) + переход на index.html для маршрутов SPA
  const indexFile = path.join(config.clientDist, 'index.html');
  if (fs.existsSync(indexFile)) {
    app.use(express.static(config.clientDist));
    app.get(/^\/(?!api\/|uploads\/).*/, (req, res) => res.sendFile(indexFile));
  }

  // ошибки разбора тела запроса и статических файлов
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status = err.status || err.statusCode || 500;
    if (status >= 500) console.error(err);
    const message = status === 413 ? 'Размер файла превышает 5 МБ' : status === 404 ? 'Не найдено' : status < 500 ? 'Некорректный запрос' : 'Сервис временно недоступен';
    res.status(status).json({ error: message });
  });

  return app;
}
