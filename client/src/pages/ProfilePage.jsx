import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import Layout from '../components/Layout.jsx';
import { Alert, Field, FlashMessage, Loading, useLoad } from '../components/ui.jsx';
import { Link, navigate } from '../router.jsx';
import { daysLabel, formatDate, formatPrice } from '../util.js';

const STATUS_CLASS = { 1: 'status-pending', 2: 'status-ok', 3: 'status-bad', 4: 'status-bad' };

function MyBookingsTab() {
  const [{ loading, data, error }, setState] = useLoad(() => api.get('/api/bookings/my'));
  const [message, setMessage] = useState(null);

  const cancel = async (b) => {
    if (!window.confirm(`Отменить бронирование тура «${b.tour.title}»?`)) return;
    setMessage(null);
    try {
      await api.post(`/api/bookings/${b.id}/cancel`);
      const fresh = await api.get('/api/bookings/my');
      setState({ loading: false, data: fresh, error: null });
    } catch (e) {
      setMessage(e.message);
    }
  };

  if (loading) return <Loading />;
  if (error) return <Alert>{error.message}</Alert>;
  const list = data.bookings;
  return (
    <>
      <h2>Мои бронирования</h2>
      <FlashMessage />
      <Alert>{message}</Alert>
      {list.length === 0 && <p className="muted">У вас пока нет бронирований</p>}
      {list.map((b, i) => (
        <div className="list-card" key={b.id} data-testid="booking-card">
          <span className="list-num">{i + 1}</span>
          <div className="list-main">
            <b>{b.tour.title}</b>
            <div>
              {formatDate(b.tour.startDate)} · {daysLabel(b.tour.durationDays)}
            </div>
            <div>{formatPrice(b.tour.price)}</div>
          </div>
          <div className="list-side">
            <div className={`status ${STATUS_CLASS[b.status.id]}`}>
              Статус: <b>{b.status.name}</b>
            </div>
            <div className="btn-row">
              <Link to={`/tours/${b.tour.id}`} className="btn btn-light btn-sm">
                Подробнее
              </Link>
              {b.canCancel && (
                <button className="btn btn-light btn-sm" onClick={() => cancel(b)}>
                  Отменить
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </>
  );
}

function MyToursTab() {
  const [{ loading, data, error }] = useLoad(() => api.get('/api/admin/tours'));
  if (loading) return <Loading />;
  if (error) return <Alert>{error.message}</Alert>;
  return (
    <>
      <div className="title-row">
        <h2>Мои туры</h2>
        <Link to="/admin/tours/new" className="btn">
          Создать тур
        </Link>
      </div>
      {data.tours.length === 0 && <p className="muted">Вы ещё не создали ни одного тура</p>}
      {data.tours.map((t, i) => (
        <div className="list-card" key={t.id} data-testid="my-tour-card">
          <span className="list-num">{i + 1}</span>
          <div className="list-main">
            <Link to={`/tours/${t.id}`}>
              <b>{t.title}</b>
            </Link>
            <div>
              {formatDate(t.startDate)} · {daysLabel(t.durationDays)}
            </div>
            <div>{formatPrice(t.price)}</div>
          </div>
          <div className="list-side">
            <Link to={`/admin/tours/${t.id}/requests`} className="btn btn-light btn-sm">
              Просмотреть заявки
            </Link>
          </div>
        </div>
      ))}
    </>
  );
}

function PersonalInfoTab() {
  const { user, setUser } = useAuth();
  const [form, setForm] = useState({ fullName: user.fullName, phone: user.phone, birthDate: user.birthDate, password: '', confirmPassword: '' });
  const [fields, setFields] = useState({});
  const [error, setError] = useState(null);
  const [ok, setOk] = useState(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setOk(null);
    setFields({});
    try {
      const d = await api.put('/api/profile', form);
      setUser(d.user);
      setForm({ ...form, password: '', confirmPassword: '' });
      setOk('Изменения сохранены');
    } catch (err) {
      setError(err.message);
      setFields(err.fields || {});
    }
  };

  return (
    <form onSubmit={submit} noValidate className="form-card form-card-inner">
      <h2>Личная информация</h2>
      <Alert>{error}</Alert>
      <Alert kind="success">{ok}</Alert>
      <Field label="ФИО полностью" error={fields.fullName}>
        <input value={form.fullName} onChange={set('fullName')} />
      </Field>
      <Field label="Email (логин)">
        <input value={user.email} readOnly disabled />
      </Field>
      <Field label="Телефон" error={fields.phone}>
        <input type="tel" value={form.phone} onChange={set('phone')} />
      </Field>
      <Field label="Дата рождения" error={fields.birthDate}>
        <input type="date" value={form.birthDate} onChange={set('birthDate')} />
      </Field>
      <Field label="Новый пароль (необязательно)" error={fields.password}>
        <input type="password" value={form.password} onChange={set('password')} autoComplete="new-password" />
      </Field>
      <Field label="Подтвердите новый пароль" error={fields.confirmPassword}>
        <input type="password" value={form.confirmPassword} onChange={set('confirmPassword')} autoComplete="new-password" />
      </Field>
      <div className="actions">
        <button className="btn" type="submit">
          Сохранить изменения
        </button>
        <button className="btn btn-light" type="button" onClick={() => navigate('/profile/bookings')}>
          Назад
        </button>
      </div>
    </form>
  );
}

export default function ProfilePage({ tab }) {
  const { user, logout } = useAuth();

  useEffect(() => {
    if (user === null) navigate('/login', { replace: true });
    else if (user && tab === 'tours' && !user.isAdmin) navigate('/profile/bookings', { replace: true });
  }, [user, tab]);

  if (!user) return <Layout><Loading /></Layout>;

  const exit = async () => {
    await logout();
    navigate('/');
  };
  const item = (key, label) => (
    <Link to={`/profile/${key}`} className={tab === key ? 'menu-item active' : 'menu-item'}>
      {label}
    </Link>
  );

  return (
    <Layout wide>
      <h1 className="page-title">Профиль</h1>
      <div className="profile">
        <nav className="menu panel">
          {item('bookings', 'Мои бронирования')}
          {user.isAdmin && item('tours', 'Мои туры')}
          {item('info', 'Личная информация')}
          <button className="menu-item" onClick={exit}>
            Выйти
          </button>
        </nav>
        <section className="panel profile-content">
          {tab === 'tours' && user.isAdmin ? <MyToursTab /> : tab === 'info' ? <PersonalInfoTab /> : <MyBookingsTab />}
        </section>
      </div>
    </Layout>
  );
}
