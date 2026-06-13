import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

function LandingPage() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <main className="landing-page">
      <section className="landing-hero">
        <p className="eyebrow">Ручная разметка текстов</p>
        <h1>Formaslov</h1>
        <p className="landing-lead">
          Загружайте .txt-файлы, выделяйте фрагменты, назначайте им метки и
          экспортируйте готовую разметку в JSON.
        </p>
        <div className="landing-actions">
          {isAuthenticated && !isLoading ? (
            <>
              <Link to="/documents" className="btn button-link">
                Перейти к документам
              </Link>
              <Link to="/demo" className="btn ghost button-link">
                Посмотреть демо
              </Link>
            </>
          ) : (
            <>
              <Link to="/demo" className="btn button-link">
                Попробовать демо
              </Link>
              <Link to="/register" className="btn secondary button-link">
                Создать аккаунт
              </Link>
            </>
          )}
        </div>
      </section>

      <section className="feature-grid" aria-label="Возможности Formaslov">
        <article className="feature-card">
          <span className="feature-number">01</span>
          <h2>Загрузите текст</h2>
          <p>Создайте документ вручную или выберите UTF-8 файл формата .txt.</p>
        </article>
        <article className="feature-card">
          <span className="feature-number">02</span>
          <h2>Разметьте фрагменты</h2>
          <p>Выделяйте нужные части текста и назначайте им цветные метки.</p>
        </article>
        <article className="feature-card">
          <span className="feature-number">03</span>
          <h2>Экспортируйте JSON</h2>
          <p>Используйте результат для датасетов, анализа и исследований.</p>
        </article>
      </section>
    </main>
  );
}

export default LandingPage;
