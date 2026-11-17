import { forbidden, unauthorized } from '../http/errors.js';

export function requireAuth(ctx) {
  if (!ctx.user) throw unauthorized();
  return ctx.user;
}

export function requireAdmin(ctx) {
  const user = requireAuth(ctx);
  if (!user.isAdmin) throw forbidden();
  return user;
}
