import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import Layout from '../components/Layout.jsx';
import { Alert, Field, Loading } from '../components/ui.jsx';
import { navigate } from '../router.jsx';
import { setFlash } from '../util.js';

const MAX_IMAGES = 5;
const MAX_BYTES = 5 * 1024 * 1024;

const EMPTY = { title: '', price: '', startDate: '', durationDays: '', difficulty: '', season: '', description: '', images: [] };

/** Страница создания (TourCreatePage) и редактирования (TourEditPage) тура. tourId – при редактировании. */
export default function TourFormPage({ tourId }) {
  const { user } = useAuth();
  const editing = !!tourId;
  const [form, setForm] = useState(EMPTY);
  const [dict, setDict] = useState({ difficulties: [], seasons: [] });
  const [loading, setLoading] = useState(editing);
  const [error, setError] = useState(null);
  const [fields, setFields] = useState({});
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef(null);

  useEffect(() => {
    if (user === null) navigate('/login', { replace: true });
  }, [user]);

  useEffect(() => {
    api.get('/api/dictionaries').then(setDict).catch(() => {});
  }, []);

  useEffect(() => {
    if (!editing || !user) return;
    api
      .get(`/api/tours/${tourId}`)
      .then(({ tour }) => {
        if (!tour.canEdit) return setError('Редактировать тур может только его автор');
        setForm({
          title: tour.title,
          price: String(tour.price),
          startDate: tour.startDate,
          durationDays: String(tour.durationDays),
          difficulty: String(tour.difficulty.id),
          season: String(tour.season.id),
          description: tour.description,
          images: tour.images,
        });
      })
      .catch((e) => setError(e.status === 404 ? 'Тур не найден' : e.message))
      .finally(() => setLoading(false));
  }, [editing, tourId, user]);

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

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const back = () => navigate(editing ? `/tours/${tourId}` : '/profile/tours');

  const addFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    setError(null);
    const free = MAX_IMAGES - form.images.length;
    if (files.length > free) return setError(`Можно добавить ещё не более ${free} изображений (всего – до ${MAX_IMAGES})`);
    for (const f of files) {
      if (!['image/jpeg', 'image/png'].includes(f.type)) return setError('Допустимы только изображения JPG и PNG');
      if (f.size > MAX_BYTES) return setError('Размер каждого изображения – до 5 МБ');
    }
    setUploading(true);
    try {
      const paths = [];
      for (const f of files) paths.push((await api.upload(f)).path);
      setForm((cur) => ({ ...cur, images: [...cur.images, ...paths] }));
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (i) => setForm({ ...form, images: form.images.filter((_, k) => k !== i) });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFields({});
    const body = {
      ...form,
      price: form.price === '' ? null : Number(form.price),
      durationDays: form.durationDays === '' ? null : Number(form.durationDays),
      difficulty: form.difficulty ? Number(form.difficulty) : null,
      season: form.season ? Number(form.season) : null,
    };
    try {
      if (editing) {
        await api.put(`/api/admin/tours/${tourId}`, body);
        setFlash('Изменения сохранены');
        navigate(`/tours/${tourId}`);
      } else {
        await api.post('/api/admin/tours', body);
        navigate('/profile/tours');
      }
    } catch (err) {
      setError(err.message);
      setFields(err.fields || {});
      setBusy(false);
    }
  };

  return (
    <Layout wide>
      <h1 className="page-title">{editing ? 'Редактирование тура' : 'Создание тура'}</h1>
      <form className="panel tour-form" onSubmit={submit} noValidate>
        <Alert>{error}</Alert>
        <div className="tour-form-grid">
          <div>
            <Field label="Название тура" error={fields.title}>
              <input value={form.title} onChange={set('title')} maxLength={150} />
            </Field>
            <Field label="Цена, руб." error={fields.price}>
              <input type="number" min="0" step="0.01" value={form.price} onChange={set('price')} />
            </Field>
            <Field label="Дата начала" error={fields.startDate}>
              <input type="date" value={form.startDate} onChange={set('startDate')} />
            </Field>
            <Field label="Длительность (дней)" error={fields.durationDays}>
              <input type="number" min="1" max="365" step="1" value={form.durationDays} onChange={set('durationDays')} />
            </Field>
            <div className="two-cols">
              <Field label="Сложность" error={fields.difficulty}>
                <select value={form.difficulty} onChange={set('difficulty')}>
                  <option value="">Выберите</option>
                  {dict.difficulties.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Сезон" error={fields.season}>
                <select value={form.season} onChange={set('season')}>
                  <option value="">Выберите</option>
                  {dict.seasons.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </div>
          <div>
            <Field label="Описание тура" error={fields.description}>
              <textarea rows={7} value={form.description} onChange={set('description')} />
            </Field>
            <Field label={`Изображения (до ${MAX_IMAGES} штук, JPG или PNG, до 5 МБ)`} error={fields.images}>
              <div className="images-edit">
                {form.images.map((p, i) => (
                  <div className="thumb" key={p}>
                    <img src={p} alt={`Изображение ${i + 1}`} />
                    <button type="button" className="thumb-remove" onClick={() => removeImage(i)} aria-label="Удалить изображение">
                      ×
                    </button>
                  </div>
                ))}
                {form.images.length < MAX_IMAGES && (
                  <button type="button" className="thumb thumb-add" disabled={uploading} onClick={() => fileInput.current?.click()}>
                    {uploading ? '…' : '+'}
                  </button>
                )}
              </div>
              <input ref={fileInput} type="file" accept="image/png,image/jpeg" multiple hidden onChange={addFiles} data-testid="file-input" />
            </Field>
          </div>
        </div>
        <div className="actions">
          <button className="btn" type="submit" disabled={busy || uploading}>
            {editing ? 'Сохранить' : 'Создать тур'}
          </button>
          <button className="btn btn-light" type="button" onClick={back}>
            Назад
          </button>
        </div>
      </form>
    </Layout>
  );
}
