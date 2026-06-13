# AGENTS.md

## 1. Назначение файла

Этот файл задаёт правила работы для ИИ-ассистента/Codex при внесении изменений в проект Formaslov.

Ассистент должен действовать как аккуратный backend/frontend maintainer: понимать текущую архитектуру, не ломать MVP-сценарии, не делать лишних переписываний и явно фиксировать все найденные расхождения между кодом, API-документацией и frontend.

## 2. Контекст проекта

Formaslov — MVP сервиса для ручной разметки текстов.

Основные сценарии:

1. Пользователь логинится через JWT.
2. Создаёт документ вручную или загружает `.txt`.
3. Открывает документ.
4. Видит текст чанками.
5. Выделяет фрагмент текста.
6. Назначает выделению метку.
7. Видит подсвеченные фрагменты.
8. Удаляет аннотации при необходимости.
9. Экспортирует разметку в JSON на frontend-стороне.

Текущий стек:

- Django + DRF backend;
- Djoser + Simple JWT;
- React frontend;
- Axios;
- SQLite локально;
- планируемая портфолио-инфраструктура: Docker, PostgreSQL, Nginx, Gunicorn.

## 3. Главные источники истины

При работе с проектом использовать источники в таком порядке:

1. Фактический backend-код:
   - `backend/api/urls.py`
   - `backend/api/views.py`
   - `backend/api/serializers.py`
   - `backend/core/models.py`
   - `backend/users/models.py`
2. Frontend-код:
   - `frontend/src/api/api.js`
   - `frontend/src/pages/`
   - `frontend/src/components/`
3. Документация:
   - `docs/ARCHITECTURE.md`
   - `docs/API_GUIDE.md`
   - `docs/STYLE_GUIDE.md`
   - `docs/AGENTS.md`
   - `backend/static/schema.yaml`
4. README и deployment-инструкции.

Важно: `backend/static/schema.yaml` сейчас может быть устаревшим. Если schema противоречит коду, не считать schema единственным источником истины. Нужно явно указать расхождение и предложить синхронизацию.

## 4. Общие правила работы

### 4.1. Не ломать текущие сценарии

Перед изменением проверить, не затрагивается ли:

- login;
- refresh token flow;
- список документов;
- создание документа;
- загрузка `.txt`;
- открытие документа;
- chunks;
- выделение текста;
- создание аннотации;
- отображение highlights;
- удаление аннотации;
- список/создание/удаление меток;
- export JSON.

### 4.2. Не делать лишних переписываний

Запрещено без отдельной задачи:

- менять стек;
- переписывать весь frontend;
- заменять DRF ViewSets на другой подход;
- менять JWT-аутентификацию;
- менять модель пользователя;
- менять формат export JSON;
- менять алгоритм chunking;
- переводить labels из глобальных в пользовательские без явного решения.

### 4.3. Работать маленькими шагами

Каждое изменение должно быть тематическим:

- docs отдельно;
- settings/env отдельно;
- Docker отдельно;
- permissions отдельно;
- API schema отдельно;
- frontend refactor отдельно;
- tests отдельно.

Не смешивать большие несвязанные изменения в одном патче.

## 5. Обязательный workflow для Codex

Перед изменениями:

1. Прочитать релевантные файлы.
2. Сформулировать, какие части проекта будут затронуты.
3. Проверить, есть ли расхождение между кодом и документацией.
4. Вносить минимальные изменения.
5. Добавить/обновить тесты, если меняется логика.
6. Обновить документацию, если меняется API/архитектура/запуск.
7. В конце дать отчёт:
   - что изменено;
   - какие файлы затронуты;
   - какие проверки выполнены;
   - какие риски/долги остались.

## 6. Команды для локальной проверки

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py test
python manage.py runserver
```

Если используется Windows PowerShell:

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python manage.py migrate
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py test
python manage.py runserver
```

### Frontend

```bash
cd frontend
npm install
npm test -- --watchAll=false
npm run build
npm start
```

### Docker — после добавления инфраструктуры

```bash
docker compose up --build
```

И отдельно проверить:

```bash
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py collectstatic --noinput
docker compose exec backend python manage.py check
```

## 7. Критичные зоны проекта

### 7.1. Ownership документов

Пользователь должен видеть и менять только свои документы.

Файлы:

- `backend/core/models.py`
- `backend/api/views.py`
- `backend/api/permissions.py`

Текущее правильное поведение для documents:

- `TextDocumentViewSet.get_queryset()` фильтрует по `user=request.user`;
- `perform_create()` выставляет `user=request.user`.

Это нельзя ломать.

### 7.2. Permissions аннотаций

Аннотация принадлежит пользователю не напрямую, а через документ:

```python
annotation.document.user
```

Текущий `IsAuthor` проверяет `obj.user`, что подходит не для всех моделей. При задачах на безопасность это исправить в первую очередь.

### 7.3. Создание аннотации

При создании аннотации нельзя доверять полю `document` от клиента без проверки ownership.

Нужно гарантировать:

- document существует;
- document принадлежит `request.user`;
- label существует;
- `start` и `end` валидны;
- `start < end`;
- `end <= len(document.content)`;
- `text` корректно вычислен.

### 7.4. Метки

`Label` является пользовательской моделью с обязательным `user`.

Нужно сохранять следующие гарантии:

- queryset фильтруется по `request.user`;
- владелец при создании выставляется backend;
- имя уникально в рамках пользователя;
- аннотация может использовать только метку владельца документа;
- `Annotation.label` остаётся с `on_delete=PROTECT`.

### 7.5. Chunks и offsets

Endpoint `documents/{id}/chunks/` возвращает chunk и абсолютные offsets. Frontend зависит от `chunk_start` и `chunk_end` для создания аннотаций.

Нельзя менять формат ответа без обновления:

- `API_GUIDE.md`;
- `backend/static/schema.yaml`;
- `frontend/src/pages/DocumentPage.js`;
- тестов.

### 7.6. Редактирование документа

Если пользователь меняет `content`, старые аннотации могут указывать на неправильные offsets. Сейчас автоматического пересчёта нет.

Не добавлять “быстрый фикс” без ясного решения. Возможные варианты:

1. Запрещать редактирование документа после появления аннотаций.
2. При редактировании удалять/инвалидировать старые аннотации.
3. Реализовать сложный пересчёт offsets.
4. Оставить MVP-поведение, но явно предупредить пользователя.

Для портфолио лучше выбрать простой и честный вариант.

## 8. Правила изменения API

При изменении API обязательно:

1. Обновить backend-код.
2. Обновить frontend-код, если он зависит от ответа/request format.
3. Обновить `API_GUIDE.md`.
4. Обновить `backend/static/schema.yaml`.
5. Добавить/обновить тесты.
6. В отчёте явно написать, изменился ли API-контракт.

Нельзя менять response shape существующего endpoint без причины.

## 9. Правила изменения Docker/deploy

При добавлении Docker-инфраструктуры придерживаться минимальной схемы:

```text
nginx → backend/gunicorn → postgres
nginx → frontend build/static
```

Рекомендуемые файлы:

```text
Dockerfile
frontend/Dockerfile
docker-compose.yml
nginx/default.conf
.env.example
```

Или другая структура, если она проще, но её нужно описать в README.

Обязательные требования:

- не хранить реальные секреты в repo;
- использовать `.env`;
- добавить `.env.example`;
- использовать PostgreSQL в compose;
- добавить volume для PostgreSQL;
- добавить volume для static files;
- настроить `collectstatic`;
- передать frontend API URL через `REACT_APP_API_URL`;
- не копировать `node_modules` в образ;
- не коммитить `db.sqlite3`.

## 10. Правила изменения настроек Django

При переводе settings на env:

- сохранить локальный запуск;
- не сломать `manage.py` команды;
- не захардкодить production-секреты;
- добавить безопасные defaults только для локальной разработки;
- `DEBUG` парсить как boolean;
- `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS` парсить как списки;
- добавить PostgreSQL-конфиг для Docker;
- оставить SQLite fallback только если это осознанное решение для локального режима.

## 11. Правила работы с frontend

Не менять route structure без необходимости:

```text
/login
/documents
/documents/:id
/labels
/
```

Все запросы должны идти через `frontend/src/api/api.js`.

При изменении auth flow проверить:

- login;
- localStorage save;
- Authorization header;
- refresh on 401;
- logout;
- redirect to login.

При изменении document markup UI проверить:

- выделение мышкой;
- выделение клавиатурой;
- подсветку существующих аннотаций;
- удаление аннотаций;
- переход между chunks.

## 12. Документация

Документация должна быть практичной, а не декоративной.

Файлы:

- `README.md` — для рекрутера/разработчика: что это, стек, запуск, демо, скриншоты, env, Docker.
- `ARCHITECTURE.md` — как устроен проект.
- `API_GUIDE.md` — API-контракт и примеры.
- `STYLE_GUIDE.md` — правила кода.
- `AGENTS.md` — инструкции для ИИ-ассистента.

При изменении документации не выдумывать несуществующие возможности. Если фича только планируется, явно писать “планируется” или “рекомендуется”.

## 13. Известные технические долги

При аудите или рефакторинге учитывать этот список:

1. `SECRET_KEY` захардкожен.
2. `DEBUG = True`.
3. `ALLOWED_HOSTS = []`.
4. SQLite используется как основная база.
5. `db.sqlite3` присутствует в проекте/архиве.
6. `Annotation.text` ограничен `max_length=500`.
7. Редактирование документа может ломать offsets аннотаций.
8. `backend/static/schema.yaml` нужно полностью синхронизировать с фактическим API.
9. Старые templates `document.html` и `login.html` похожи на legacy и требуют проверки перед удалением.

## 14. Приоритеты ближайших задач

Рекомендуемый порядок подготовки к портфолио:

1. Вынести settings в env.
2. Исправить permissions и validation аннотаций.
3. Решить судьбу labels: global или per-user.
4. Обновить OpenAPI schema.
5. Добавить базовые API-тесты.
6. Добавить Docker/PostgreSQL/Nginx.
7. Подготовить деплой/демо.

## 15. Формат финального отчёта Codex

После выполнения задачи Codex должен дать отчёт в таком формате:

```markdown
## Что сделано
- ...

## Изменённые файлы
- ...

## Проверки
- [x] python manage.py check
- [x] python manage.py test
- [ ] npm run build — не запускал, причина: ...

## Изменения API
- Нет / Да: ...

## Риски и что проверить вручную
- ...

## Следующий рекомендуемый шаг
- ...
```

Если проверка не запускалась, нельзя писать, что всё работает. Нужно честно указать, что не запускалось и почему.
