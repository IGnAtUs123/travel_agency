import { useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import Layout from '../components/Layout.jsx';
import { Alert, Loading, useLoad } from '../components/ui.jsx';
import { Link, navigate } from '../router.jsx';
import { daysLabel, formatDate, formatPrice, setFlash } from '../util.js';

function Gallery({ images, title }) {
  const [i, setI] = useState(0);
  if (!images.length) return <div className="gallery gallery-empty">Нет фото</div>;
  const go = (d) => setI((i + d + images.length) % images.length);
  return (
    <div className="gallery">
      <img src={images[i]} alt={title} />
      {images.length > 1 && (
        <div className="gallery-nav">
          <button type="button" className="icon-btn" onClick={() => go(-1)} aria-label="Предыдущее фото">
            ‹
          </button>
          <span>
            {i + 1} / {images.length}
          </span>
          <button type="button" className="icon-btn" onClick={() => go(1)} aria-label="Следующее фото">
            ›
          </button>
        </div>
      )}
    </div>
  );
}

export default function TourPage({ id }) {
  const { user } = useAuth();
  const [{ loading, data, error }] = useLoad(() => api.get(`/api/tours/${id}`), [id, user?.id]);
  const [busy, setBusy] = useState(false);
  const [bookError, setBookError] = useState(null);

  const book = async () => {
    // Гость перенаправляется на страницу входа
    if (!user) return navigate('/login');
    setBusy(true);
    setBookError(null);
    try {
      await api.post('/api/bookings', { tourId: Number(id) });
      setFlash('Заявка отправлена. Статус заявки отображается в разделе «Мои бронирования».');
      navigate('/profile/bookings');
    } catch (e) {
      if (e.status === 401) navigate('/login');
      else setBookError(e.message);
      setBusy(false);
    }
  };

  if (loading)
    return (
      <Layout>
        <Loading />
      </Layout>
    );
  if (error)
    return (
      <Layout>
        <Alert>{error.status === 404 ? 'Тур не найден' : error.message}</Alert>
        <p className="center">
          <Link to="/" className="btn btn-light">
            Назад
          </Link>
        </p>
      </Layout>
    );

  const t = data.tour;
  return (
    <Layout wide>
      <h1 className="page-title">Бронирование тура</h1>
      <div className="panel tour-page">
        <div className="tour-info">
          <h2>{t.title}</h2>
          <p>
            <b>Длительность:</b> {daysLabel(t.durationDays)}
          </p>
          <p>
            <b>Сложность:</b> {t.difficulty.name}
          </p>
          <p>
            <b>Сезон:</b> {t.season.name}
          </p>
          <p>
            <b>Дата начала:</b> {formatDate(t.startDate)}
          </p>
          <h3>Описание тура</h3>
          <p className="description">{t.description}</p>
          <p className="price">Цена: {formatPrice(t.price)}</p>
        </div>
        <div className="tour-side">
          <Gallery images={t.images} title={t.title} />
          {t.organizer && (
            <p className="contacts">
              Номер: {t.organizer.phone}
              <br />
              Почта: {t.organizer.email}
            </p>
          )}
        </div>
      </div>

      <Alert>{bookError}</Alert>
      {t.hasStarted && <Alert kind="info">Тур уже начался – бронирование недоступно.</Alert>}
      <div className="actions">
        {!t.hasStarted && !t.canEdit && (
          <button className="btn" onClick={book} disabled={busy}>
            Забронировать
          </button>
        )}
        {t.canEdit && (
          <Link to={`/admin/tours/${t.id}/edit`} className="btn">
            Редактировать тур
          </Link>
        )}
        <button className="btn btn-light" onClick={() => (window.history.length > 1 ? window.history.back() : navigate('/'))}>
          Назад
        </button>
      </div>
    </Layout>
  );
}
