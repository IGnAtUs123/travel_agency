/**
 * Таблица маршрутов REST API. Используется Express-приложением (app.js);
 * обработчики – методы контроллеров, получающие контекст { params, query, body, rawBody, user }.
 */
export function buildRoutes(c) {
  return [
    // справочники и авторизация
    { method: 'GET', path: '/api/dictionaries', handler: (x) => c.tours.dictionaries(x) },
    { method: 'POST', path: '/api/auth/register', handler: (x) => c.auth.register(x) },
    { method: 'POST', path: '/api/auth/login', handler: (x) => c.auth.login(x) },
    { method: 'POST', path: '/api/auth/logout', handler: (x) => c.auth.logout(x) },
    { method: 'GET', path: '/api/auth/me', handler: (x) => c.auth.me(x) },

    // туры
    { method: 'GET', path: '/api/tours', handler: (x) => c.tours.index(x) },
    { method: 'GET', path: '/api/tours/:id', handler: (x) => c.tours.details(x) },

    // заявки пользователя
    { method: 'POST', path: '/api/bookings', handler: (x) => c.bookings.create(x) },
    { method: 'GET', path: '/api/bookings/my', handler: (x) => c.bookings.myBookings(x) },
    { method: 'POST', path: '/api/bookings/:id/cancel', handler: (x) => c.bookings.cancel(x) },

    // профиль
    { method: 'GET', path: '/api/profile', handler: (x) => c.profile.show(x) },
    { method: 'PUT', path: '/api/profile', handler: (x) => c.profile.update(x) },

    // администратор
    { method: 'GET', path: '/api/admin/tours', handler: (x) => c.admin.myTours(x) },
    { method: 'POST', path: '/api/admin/tours', handler: (x) => c.admin.create(x) },
    { method: 'PUT', path: '/api/admin/tours/:id', handler: (x) => c.admin.update(x) },
    { method: 'GET', path: '/api/admin/tours/:id/requests', handler: (x) => c.admin.requests(x) },
    { method: 'POST', path: '/api/admin/bookings/:id/approve', handler: (x) => c.admin.approve(x) },
    { method: 'POST', path: '/api/admin/bookings/:id/reject', handler: (x) => c.admin.reject(x) },
    { method: 'POST', path: '/api/admin/uploads', raw: true, handler: (x) => c.admin.upload(x) },
  ];
}
