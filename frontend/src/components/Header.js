import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

function Header() {
  const { isAuthenticated, isLoading, logout, user } = useAuth();

  return (
    <header className="app-header">
      <div className="header-main">
        <Link to="/" className="brand-link">
          Formaslov
        </Link>
        <nav className="app-nav" aria-label="Основная навигация">
          {isAuthenticated ? (
            <>
              <NavLink
                to="/documents"
                className={({ isActive }) =>
                  `nav-link${isActive ? ' active' : ''}`
                }
              >
                Документы
              </NavLink>
              <NavLink
                to="/labels"
                className={({ isActive }) =>
                  `nav-link${isActive ? ' active' : ''}`
                }
              >
                Метки
              </NavLink>
            </>
          ) : null}
          <NavLink
            to="/about"
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            О проекте
          </NavLink>
          <NavLink
            to="/technologies"
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            Технологии
          </NavLink>
          {!isAuthenticated ? (
            <NavLink
              to="/demo"
              className={({ isActive }) =>
                `nav-link${isActive ? ' active' : ''}`
              }
            >
              Демо
            </NavLink>
          ) : null}
        </nav>
      </div>
      {!isLoading ? (
        <nav className="header-actions" aria-label="Пользователь">
          {isAuthenticated ? (
            <>
              <span className="current-user">{user?.username}</span>
              <NavLink
                to="/account"
                className={({ isActive }) =>
                  `nav-link account-link${isActive ? ' active' : ''}`
                }
              >
                Сменить пароль
              </NavLink>
              <button type="button" className="btn secondary" onClick={logout}>
                Выйти
              </button>
            </>
          ) : (
            <>
              <Link to="/register" className="btn secondary button-link">
                Зарегистрироваться
              </Link>
              <Link to="/login" className="btn ghost button-link">
                Войти
              </Link>
            </>
          )}
        </nav>
      ) : null}
    </header>
  );
}

export default Header;
