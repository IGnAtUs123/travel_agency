import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import Layout from '../components/Layout.jsx';
import { Alert, Loading, useLoad } from '../components/ui.jsx';
import { Link, navigate } from '../router.jsx';
import { formatDate } from '../util.js';

const STATUS_CLASS = { 1: 'status-pending', 2: 'status-ok', 3: 'status-bad', 4: 'status-bad' };

export default function TourRequestsPage({ tourId }) {
  const { user } = useAuth();
  const [{ loading, data, error }, setState] = useLoad(() => (user?.isAdmin ? api.get(`/api/admin/tours/${tourId}/requests`) : Promise.resolve(null)), [tourId, user?.id]);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    if (user === null) navigate('/login', { replace: true });
  }, [user]);

  const process = async (r, action) => {
    setMessage(null);
    try {
      await api.post(`/api/admin/bookings/${r.id}/${action}`);
    } catch (e) {
      setMessage(e.message);
    }
    // список обновляется в любом случае (например, если заявку уже обработали или отменили)
    try {
      setState({ loading: false, data: await api.get(`/api/admin/tours/${tourId}/requests`), error: null });
    } catch (e) {
      setMessage(e.message);
    }
  };

  if (!user || loading)
    return (
      <Layout>
        <Loading />
      </Layout>
    );
  if (!user.isAdmin)
    return (
      <Layout>
        <Alert>Страница доступна только администратору</Alert>
      </Layout>
    );
  if (error)
    return (
      <Layout>
        <Alert>{error.message}</Alert>
        <p className="center">
          <Link to="/profile/tours" className="btn btn-light">
            Назад к моим турам
          </Link>
        </p>
      </Layout>
    );

  return (
    <Layout wide>
      <div className="title-row">
        <div>
          <h1 className="page-title left">Заявки на тур «{data.tour.title}»</h1>
          <p className="muted">Дата: {formatDate(data.tour.startDate)}</p>
        </div>
        <Link to="/profile/tours" className="btn btn-light">
          Назад к моим турам
        </Link>
      </div>
      <Alert>{message}</Alert>
      <div className="panel">
        {data.requests.length === 0 && <p className="muted">Заявок пока нет</p>}
        {data.requests.map((r, i) => (
          <div className="list-card" key={r.id} data-testid="request-card">
            <span className="list-num">{i + 1}</span>
            <div className="list-main">
              <div>
                Заявитель: <b>{r.applicant.fullName}</b>
              </div>
              <div>Возраст: {r.applicant.age} лет</div>
              <div>Номер: {r.applicant.phone}</div>
              <div>Почта: {r.applicant.email}</div>
            </div>
            <div className="list-side">
              <div className={`status ${STATUS_CLASS[r.status.id]}`}>
                Статус: <b>{r.status.name}</b>
              </div>
              {r.canProcess && (
                <div className="btn-row">
                  <button className="btn btn-light btn-sm" onClick={() => process(r, 'approve')}>
                    Одобрено
                  </button>
                  <button className="btn btn-light btn-sm" onClick={() => process(r, 'reject')}>
                    Отклонено
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </Layout>
  );
}
