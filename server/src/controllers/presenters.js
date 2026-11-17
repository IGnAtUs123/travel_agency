import { BookingStatus, DIFFICULTY_NAMES, SEASON_NAMES, STATUS_NAMES } from '../models.js';

export const presentUser = (u) => ({
  id: u.id,
  fullName: u.fullName,
  email: u.email,
  phone: u.phone,
  birthDate: u.birthDate,
  isAdmin: u.isAdmin,
});

export const presentTourCard = (t) => ({
  id: t.id,
  title: t.title,
  price: t.price,
  startDate: t.startDate,
  durationDays: t.durationDays,
  difficulty: { id: t.difficulty, name: DIFFICULTY_NAMES[t.difficulty] },
  season: { id: t.season, name: SEASON_NAMES[t.season] },
  cover: t.cover,
});

export const presentTour = (t, { user, today }) => ({
  ...presentTourCard(t),
  description: t.description,
  adminId: t.adminId,
  images: t.images.map((i) => i.imagePath),
  organizer: t.organizer,
  hasStarted: t.hasStarted(today),
  canEdit: !!user && user.isAdmin && user.id === t.adminId,
});

export const presentBooking = (b, today) => ({
  id: b.id,
  status: { id: b.status, name: STATUS_NAMES[b.status] },
  createdAt: b.createdAt,
  canCancel: b.canBeCancelled(today),
  tour: {
    id: b.tour.id,
    title: b.tour.title,
    price: b.tour.price,
    startDate: b.tour.startDate,
    durationDays: b.tour.durationDays,
  },
});

export const presentRequest = (b, today) => ({
  id: b.id,
  status: { id: b.status, name: STATUS_NAMES[b.status] },
  createdAt: b.createdAt,
  processedAt: b.processedAt,
  canProcess: b.status === BookingStatus.Pending,
  applicant: {
    fullName: b.user.fullName,
    age: b.user.getAge(today),
    phone: b.user.phone,
    email: b.user.email,
  },
});

export const dictionaries = () => ({
  difficulties: Object.entries(DIFFICULTY_NAMES).map(([id, name]) => ({ id: Number(id), name })),
  seasons: Object.entries(SEASON_NAMES).map(([id, name]) => ({ id: Number(id), name })),
});
