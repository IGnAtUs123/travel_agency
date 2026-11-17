import { useState } from 'react';
import { useAuth } from '../auth.jsx';
import Layout from '../components/Layout.jsx';
import { Alert, Field, FlashMessage } from '../components/ui.jsx';
import { Link, navigate } from '../router.jsx';

export default function LoginPage() {
  const { login } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);
  const [fields, setFields] = useState({});
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFields({});
    try {
      await login(form.email, form.password);
      navigate('/');
    } catch (err) {
      setError(err.message);
      setFields(err.fields || {});
      setBusy(false);
    }
  };

  return (
    <Layout>
      <form className="panel form-card" onSubmit={submit} noValidate>
        <h1>Вход в систему</h1>
        <FlashMessage />
        <Alert>{error}</Alert>
        <Field label="Логин (Email)" error={fields.email}>
          <input type="email" autoComplete="username" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="Пароль" error={fields.password}>
          <input type="password" autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </Field>
        <div className="actions">
          <button className="btn" type="submit" disabled={busy}>
            Войти
          </button>
          <Link to="/register" className="btn btn-light">
            Зарегистрироваться
          </Link>
        </div>
      </form>
    </Layout>
  );
}
