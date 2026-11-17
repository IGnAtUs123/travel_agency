import { useState } from 'react';
import { api } from '../api.js';
import Layout from '../components/Layout.jsx';
import { Alert, Field } from '../components/ui.jsx';
import { Link, navigate } from '../router.jsx';
import { setFlash } from '../util.js';

export default function RegisterPage() {
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', birthDate: '', password: '', confirmPassword: '' });
  const [error, setError] = useState(null);
  const [fields, setFields] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFields({});
    try {
      await api.post('/api/auth/register', form);
      setFlash('Регистрация выполнена. Войдите, используя Email и пароль.');
      navigate('/login');
    } catch (err) {
      setError(err.message);
      setFields(err.fields || {});
      setBusy(false);
    }
  };

  return (
    <Layout>
      <form className="panel form-card" onSubmit={submit} noValidate>
        <h1>Регистрация</h1>
        <Alert>{error}</Alert>
        <Field label="ФИО полностью" error={fields.fullName}>
          <input value={form.fullName} onChange={set('fullName')} autoComplete="name" />
        </Field>
        <Field label="Email (ваш логин)" error={fields.email}>
          <input type="email" value={form.email} onChange={set('email')} autoComplete="email" />
        </Field>
        <Field label="Телефон" error={fields.phone}>
          <input type="tel" value={form.phone} onChange={set('phone')} autoComplete="tel" placeholder="+7 900 123-45-67" />
        </Field>
        <Field label="Дата рождения" error={fields.birthDate}>
          <input type="date" value={form.birthDate} onChange={set('birthDate')} />
        </Field>
        <Field label="Пароль" error={fields.password}>
          <input type="password" value={form.password} onChange={set('password')} autoComplete="new-password" />
        </Field>
        <Field label="Подтвердите пароль" error={fields.confirmPassword}>
          <input type="password" value={form.confirmPassword} onChange={set('confirmPassword')} autoComplete="new-password" />
        </Field>
        <div className="actions">
          <button className="btn" type="submit" disabled={busy}>
            Зарегистрироваться
          </button>
          <Link to="/login" className="btn btn-light">
            Отмена
          </Link>
        </div>
      </form>
    </Layout>
  );
}
