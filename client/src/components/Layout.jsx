import { useAuth } from '../auth.jsx';
import { Link } from '../router.jsx';

/** Шапка сайта и контейнер страницы. */
export default function Layout({ children, wide = false }) {
  const { user } = useAuth();
  return (
    <>
      <header className="header">
        <div className="header-inner">
          <Link to="/" className="header-link">
            Главная
          </Link>
          <nav className="header-nav">
            {user ? (
              <Link to="/profile" className="header-link">
                Профиль
              </Link>
            ) : (
              <>
                <Link to="/login" className="header-link">
                  Войти
                </Link>
                <Link to="/register" className="header-link">
                  Регистрация
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className={wide ? 'page page-wide' : 'page'}>{children}</main>
    </>
  );
}
