# ARCHITECTURE.md

## 1. Назначение проекта

Formaslov — MVP веб-сервиса для ручной разметки текстов. Пользователь авторизуется, создаёт или загружает текстовый документ, просматривает его фрагментами, выделяет участки текста, назначает им метки и экспортирует результат разметки в JSON.

Проект сейчас находится в состоянии учебного/портфолио MVP: базовые сценарии работают, но перед публикацией как портфолио его нужно дополнительно стабилизировать, контейнеризовать, вынести настройки в переменные окружения, обновить API-документацию и закрыть несколько слабых мест в безопасности/валидации.

## 2. Текущий технологический стек

### Backend

- Python
- Django
- Django REST Framework
- Djoser
- Simple JWT
- django-cors-headers
- SQLite в текущей локальной версии

### Frontend

- React
- Create React App / react-scripts
- React Router
- Axios
- LocalStorage для хранения JWT-токенов

### Документация API

- Статический OpenAPI-файл: `backend/static/schema.yaml`
- ReDoc-шаблон: `backend/templates/redoc.html`
- URL документации: `/redoc/`

Важно: текущий `schema.yaml` частично расходится с фактическим поведением backend-кода. При изменении API нужно сверять `backend/api/urls.py`, `backend/api/views.py`, `backend/api/serializers.py` и обновлять `backend/static/schema.yaml`.

## 3. Структура проекта

```text
formaslov/
├── backend/
│   ├── config/              # Django project: settings, urls, wsgi/asgi
│   ├── api/                 # DRF serializers, viewsets, routers, permissions
│   ├── core/                # Доменные модели: документы, метки, аннотации
│   ├── users/               # Кастомная модель пользователя
│   ├── static/              # Backend static files и schema.yaml
│   ├── templates/           # ReDoc и legacy HTML templates
│   ├── manage.py
│   └── requirements.txt
├── frontend/                # React-приложение
├── docs/                    # Документация проекта
├── demo/                    # Статическая browser-only демонстрация
├── README.md
└── .env.example
```

## 4. Django-приложения

### `config`

Django project package. Содержит:

- `settings.py` — настройки проекта;
- `urls.py` — корневой роутинг;
- `wsgi.py`, `asgi.py`.

Текущие особенности:

- `SECRET_KEY` захардкожен;
- `DEBUG = True`;
- `ALLOWED_HOSTS = []`;
- база данных — локальная SQLite в `backend/db.sqlite3`;
- `STATICFILES_DIRS = [BASE_DIR / 'static']`;
- `AUTH_USER_MODEL = 'users.MyUser'`;
- глобальная DRF-аутентификация — JWT;
- глобальный permission-класс — `IsAuthenticated`.

Перед production-like деплоем настройки нужно вынести в `.env`.

### `users`

Содержит кастомную модель пользователя:

```python
class MyUser(AbstractUser):
    ...
```

Сейчас модель не добавляет новых полей к стандартному `AbstractUser`, но уже подключена через `AUTH_USER_MODEL`. Это нормальная основа для будущего расширения профиля, но менять модель пользователя после миграций нужно осторожно.

### `core`

Доменное приложение. Содержит основные модели:

#### `TextDocument`

Текстовый документ пользователя.

Поля:

- `user` — владелец документа;
- `title` — название, необязательное;
- `content` — полный текст документа;
- `created_at` — дата создания.

Связи:

- `User -> TextDocument`: one-to-many через `related_name='documents'`.

#### `Label`

Метка для классификации фрагментов текста.

Поля:

- `name` — название метки;
- `color` — HEX-цвет, по умолчанию `#ffff00`.

Текущее поведение: метки глобальные для всех пользователей. У модели нет связи с `user`.

Это нужно явно учитывать: если проект должен быть многопользовательским, нужно решить, остаются ли метки глобальным справочником или становятся пользовательскими.

#### `Annotation`

Аннотация, связывающая фрагмент документа с меткой.

Поля:

- `document` — документ;
- `label` — метка;
- `start` — абсолютное начало выделения в `document.content`;
- `end` — абсолютный конец выделения в `document.content`;
- `text` — сохранённый текст выделенного фрагмента;
- `created_at` — дата создания.

Связи:

- `TextDocument -> Annotation`: one-to-many через `related_name='annotations'`;
- `Label -> Annotation`: many-to-one, `on_delete=PROTECT`.

## 5. API-слой

API находится в приложении `backend/api`.

### `backend/api/urls.py`

Используется `DefaultRouter`:

```text
/api/v1/documents/
/api/v1/labels/
/api/v1/annotations/
/api/v1/jwt/create/
/api/v1/jwt/refresh/
/api/v1/jwt/verify/
```

### `backend/api/serializers.py`

Сериализаторы:

- `TextDocumentSerializer`
- `LabelSerializer`
- `AnnotationSerializer`

Важная особенность: поле `Annotation.text` read-only. При создании аннотации frontend отправляет `document`, `label`, `start`, `end`; backend сам вычисляет `text = document.content[start:end]`.

### `backend/api/views.py`

#### `TextDocumentViewSet`

Отвечает за CRUD документов, загрузку `.txt` и получение чанков.

Ключевое поведение:

- queryset фильтруется по текущему пользователю;
- при создании `user` выставляется из `request.user`;
- кастомный endpoint `chunks` делит документ на фрагменты по абзацам;
- кастомный endpoint `upload` принимает `.txt` файл.

Особенность: `parser_classes = [MultiPartParser]`. Поэтому create/update документов сейчас ожидают `multipart/form-data`, а не обычный JSON. Frontend отправляет `FormData`.

#### `LabelViewSet`

CRUD меток.

Текущее поведение:

- доступ только для авторизованных пользователей;
- метки не фильтруются по пользователю;
- любой авторизованный пользователь видит и может менять глобальный список меток.

Это либо осознанная модель “общего справочника меток”, либо место для будущего исправления.

#### `AnnotationViewSet`

CRUD аннотаций.

Ключевое поведение:

- queryset фильтруется по `document__user=request.user`;
- поддерживается фильтр `?document=<id>`;
- при создании `text` вычисляется автоматически по `document.content[start:end]`.

Критически важная зона для ревью: создание аннотации должно валидировать, что документ принадлежит текущему пользователю. Сейчас это нужно проверить/усилить отдельно.

## 6. Frontend-архитектура

React-приложение лежит в `frontend/`.

### Основные маршруты

```text
/login
/documents
/documents/:id
/labels
/
```

`/` перенаправляет пользователя на `/documents`, если в `localStorage` есть `access_token`, иначе на `/login`.

### API-клиент

Файл: `frontend/src/api/api.js`.

Особенности:

- `baseURL` читается из `REACT_APP_API_URL`;
- для локальной разработки используется fallback `http://127.0.0.1:8000/api/v1/`;
- access token берётся из `localStorage`;
- refresh token используется при `401`;
- при невозможности обновить токен localStorage очищается, пользователь отправляется на `/login`.

Пример переменной окружения находится в корневом `.env.example`.

### Основные страницы

#### `LoginPage`

- отправляет `username` и `password` на `jwt/create/`;
- сохраняет `access` и `refresh` в `localStorage`;
- перекидывает пользователя на `/documents`.

#### `DocumentsPage`

- показывает список документов текущего пользователя;
- использует limit/offset pagination;
- позволяет создать документ через форму;
- позволяет загрузить `.txt` файл через `documents/upload/`.

#### `DocumentPage`

- показывает документ фрагментами;
- загружает документ, список меток, аннотации и первый chunk;
- позволяет выделить текст в текущем chunk;
- создаёт аннотацию через `annotations/`;
- подсвечивает размеченные фрагменты;
- позволяет удалить аннотацию;
- позволяет редактировать весь текст документа;
- экспортирует разметку в JSON на стороне браузера.

#### `LabelsPage`

- показывает список меток;
- позволяет создать метку с цветом;
- позволяет удалить метку.

## 7. Основные пользовательские сценарии

### Авторизация

1. Пользователь вводит логин и пароль.
2. Frontend отправляет запрос на `/api/v1/jwt/create/`.
3. Backend возвращает `access` и `refresh`.
4. Frontend сохраняет токены в `localStorage`.
5. Все дальнейшие API-запросы отправляются с заголовком:

```http
Authorization: Bearer <access_token>
```

### Создание документа вручную

1. Пользователь вводит title и content.
2. Frontend отправляет `multipart/form-data` на `/api/v1/documents/`.
3. Backend создаёт `TextDocument` с `user=request.user`.
4. Список документов обновляется.

### Загрузка `.txt`

1. Пользователь выбирает `.txt` файл.
2. Frontend отправляет файл на `/api/v1/documents/upload/` в поле `file`.
3. Backend проверяет наличие файла и расширение `.txt`.
4. Backend читает файл как UTF-8.
5. Backend создаёт документ, где `title` равен имени файла, а `content` — содержимому файла.

### Разбиение документа на chunks

1. Frontend запрашивает `/api/v1/documents/{id}/chunks/?page=1&page_size=1`.
2. Backend нормализует переносы строк к `\n`.
3. Backend ищет текстовые блоки, разделённые пустыми строками.
4. Backend возвращает текущий chunk и абсолютные смещения `chunk_start`, `chunk_end`.

### Создание аннотации

1. Пользователь выделяет текст внутри текущего chunk.
2. Frontend вычисляет локальные координаты выделения.
3. Frontend переводит их в абсолютные координаты: `chunk_start + selection.start/end`.
4. Frontend отправляет `document`, `label`, `start`, `end` на `/api/v1/annotations/`.
5. Backend сохраняет аннотацию и вычисляет `text` по исходному документу.

### Экспорт

Экспорт выполняется на frontend-стороне. Backend отдельного export endpoint сейчас не имеет.

Формат экспорта:

```json
{
  "schema_version": 1,
  "exported_at": "2026-01-01T00:00:00.000Z",
  "document": {
    "id": 1,
    "title": "Example",
    "created_at": "..."
  },
  "labels": [
    {"id": 1, "name": "Label", "color": "#ffff00"}
  ],
  "annotations": [
    {
      "id": 1,
      "document": 1,
      "label": 1,
      "start": 0,
      "end": 10,
      "text": "...",
      "created_at": "..."
    }
  ]
}
```

## 8. Текущие архитектурные ограничения

### 8.1. Настройки не production-ready

Сейчас `SECRET_KEY`, `DEBUG`, `ALLOWED_HOSTS`, база данных и CORS заданы прямо в `settings.py`. Для портфолио-деплоя нужно вынести настройки в `.env`.

### 8.2. SQLite для локальной разработки

SQLite подходит для локальной разработки. Файл `backend/db.sqlite3` игнорируется Git и не должен использоваться как production-база.

### 8.3. Метки глобальные

`Label` не связан с пользователем. Это может быть корректно для общего справочника, но небезопасно/неудобно для многопользовательского сервиса, если каждый пользователь должен иметь собственные метки.

### 8.4. Валидация аннотаций неполная

Нужно проверить и усилить:

- принадлежность документа текущему пользователю при создании аннотации;
- `start < end`;
- `end <= len(document.content)`;
- максимальную длину `text`, так как поле `Annotation.text` имеет `max_length=500`;
- поведение при редактировании документа, когда старые offsets могут стать невалидными.

### 8.5. Object permissions требуют ревью

`IsAuthor` сейчас проверяет `obj.user == request.user`. Это подходит для `TextDocument`, но не подходит напрямую для `Annotation`, у которой нет поля `user`; владелец определяется через `annotation.document.user`.

### 8.6. OpenAPI schema частично устарела

`backend/static/schema.yaml` не полностью отражает кастомные ответы `chunks`, `upload` и фактические статусы JWT endpoints. При любом API-изменении schema нужно обновить.

### 8.7. Frontend API URL

`frontend/src/api/api.js` использует `REACT_APP_API_URL` с локальным fallback. Для deployment значение должно задаваться на этапе CRA-сборки.

### 8.8. Нет отдельного backend export endpoint

Экспорт JSON сейчас реализован на frontend-стороне. Это допустимо для MVP, но если нужен воспроизводимый API-контракт экспорта, стоит добавить backend endpoint.

## 9. Целевая архитектура для портфолио-версии

Рекомендуемая минимальная production-like схема:

```text
browser
  ↓
nginx
  ├── /api/   → backend: Django + DRF + Gunicorn
  ├── /admin/ → backend
  ├── /redoc/ → backend
  ├── /static/ → static volume
  └── /       → frontend build

backend
  ↓
postgres
```

Контейнеры:

- `backend` — Django app + Gunicorn;
- `frontend` — сборка React-приложения или отдельный build stage;
- `db` — PostgreSQL;
- `nginx` — reverse proxy и раздача frontend/static;
- опционально `certbot` или внешний reverse proxy для HTTPS.

Тома:

- `postgres_data` — данные PostgreSQL;
- `static_value` — результат `collectstatic`;
- `media_value` — если в будущем появятся загружаемые файлы как media. Сейчас `.txt` сохраняется в БД, не в файловой системе.

## 10. Приоритеты перед публикацией как портфолио

1. Вынести backend-настройки в `.env`.
2. Исправить permissions/валидацию аннотаций.
3. Определиться с моделью меток: глобальные или пользовательские.
4. Обновить `backend/static/schema.yaml` и `docs/API_GUIDE.md`.
5. Добавить Dockerfile/backend, Dockerfile/frontend, docker-compose, nginx config.
6. Добавить базовые тесты API.
7. Подготовить deployment и актуальный публичный demo URL.
