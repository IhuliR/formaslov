# API_GUIDE.md

## 1. Общая информация

Backend API проекта Formaslov построен на Django REST Framework.

Базовый префикс API:

```text
/api/v1/
```

Все основные endpoints, кроме получения JWT-токенов, требуют авторизации.

Формат авторизации:

```http
Authorization: Bearer <access_token>
```

Актуальный роутинг задаётся в:

- `backend/config/urls.py`
- `backend/api/urls.py`

Сериализация задаётся в:

- `backend/api/serializers.py`

Бизнес-логика API находится в:

- `backend/api/views.py`

Статический OpenAPI-файл расположен в:

- `backend/static/schema.yaml`

Важно: текущий `schema.yaml` может расходиться с фактическим поведением кода. При конфликте сначала проверяй `urls.py`, `views.py`, `serializers.py`, затем обновляй документацию и schema.

## 2. Аутентификация

JWT endpoints подключены через Djoser/Simple JWT:

```python
path('v1/', include('djoser.urls.jwt'))
```

### 2.1. Получить пару токенов

```http
POST /api/v1/jwt/create/
Content-Type: application/json
```

Request:

```json
{
  "username": "user",
  "password": "password"
}
```

Response:

```json
{
  "refresh": "<refresh_token>",
  "access": "<access_token>"
}
```

Frontend не должен жёстко полагаться на конкретный HTTP status этого endpoint. В текущем коде `LoginPage` проверяет наличие `access` и `refresh`, а не status.

### 2.2. Обновить access token

```http
POST /api/v1/jwt/refresh/
Content-Type: application/json
```

Request:

```json
{
  "refresh": "<refresh_token>"
}
```

Response:

```json
{
  "access": "<new_access_token>"
}
```

### 2.3. Проверить token

```http
POST /api/v1/jwt/verify/
Content-Type: application/json
```

Request:

```json
{
  "token": "<token>"
}
```

При валидном токене возвращается успешный пустой/служебный ответ Simple JWT.

## 3. Documents API

Ресурс документов управляет текстами пользователя.

Модель: `backend/core/models.py` (`core.models.TextDocument`).

Поля:

| Поле | Тип | Описание |
|---|---|---|
| `id` | integer | ID документа |
| `user` | integer/string | Владелец документа, read-only |
| `title` | string | Название документа, необязательное |
| `content` | string | Полный текст документа |
| `created_at` | datetime | Дата создания, read-only |

Текущее важное ограничение: `TextDocumentViewSet` использует `parser_classes = [MultiPartParser]`, поэтому create/update документов выполняются через `multipart/form-data`.

### 3.1. Список документов

```http
GET /api/v1/documents/
Authorization: Bearer <access_token>
```

Query parameters:

| Параметр | Тип | Описание |
|---|---|---|
| `limit` | integer | Количество документов на странице |
| `offset` | integer | Смещение для пагинации |

Response:

```json
{
  "count": 2,
  "next": null,
  "previous": null,
  "results": [
    {
      "id": 1,
      "user": 1,
      "title": "Example",
      "content": "Text...",
      "created_at": "2026-01-01T00:00:00Z"
    }
  ]
}
```

Особенность: пользователь получает только свои документы. Фильтрация выполняется в `TextDocumentViewSet.get_queryset()`.

### 3.2. Создать документ вручную

```http
POST /api/v1/documents/
Authorization: Bearer <access_token>
Content-Type: multipart/form-data
```

Form fields:

| Поле | Обязательное | Описание |
|---|---:|---|
| `title` | нет | Название документа |
| `content` | да | Текст документа |

Response `201 Created`:

```json
{
  "id": 1,
  "user": 1,
  "title": "Example",
  "content": "Text...",
  "created_at": "2026-01-01T00:00:00Z"
}
```

### 3.3. Получить документ

```http
GET /api/v1/documents/{id}/
Authorization: Bearer <access_token>
```

Response:

```json
{
  "id": 1,
  "user": 1,
  "title": "Example",
  "content": "Text...",
  "created_at": "2026-01-01T00:00:00Z"
}
```

Если документ не принадлежит пользователю, он не должен быть доступен.

### 3.4. Частично обновить документ

```http
PATCH /api/v1/documents/{id}/
Authorization: Bearer <access_token>
Content-Type: multipart/form-data
```

Form fields:

| Поле | Обязательное | Описание |
|---|---:|---|
| `title` | нет | Новое название |
| `content` | нет | Новый текст |

Response:

```json
{
  "id": 1,
  "user": 1,
  "title": "Updated title",
  "content": "Updated text...",
  "created_at": "2026-01-01T00:00:00Z"
}
```

Важно: изменение `content` может сделать существующие offsets аннотаций невалидными. Сейчас автоматического пересчёта аннотаций нет.

### 3.5. Удалить документ

```http
DELETE /api/v1/documents/{id}/
Authorization: Bearer <access_token>
```

Response:

```http
204 No Content
```

При удалении документа связанные аннотации удаляются каскадно.

### 3.6. Загрузить `.txt` файл

```http
POST /api/v1/documents/upload/
Authorization: Bearer <access_token>
Content-Type: multipart/form-data
```

Form fields:

| Поле | Обязательное | Описание |
|---|---:|---|
| `file` | да | `.txt` файл в UTF-8 |

Backend-поведение:

- если файла нет — `400`, `{"detail": "Файл не найден."}`;
- если расширение не `.txt` — `400`, `{"detail": "Только .txt файлы разрешены."}`;
- если файл не читается как UTF-8 — `400`, `{"detail": "Ошибка при чтении файла. Проверьте кодировку."}`;
- при успехе создаётся `TextDocument`, где `title = uploaded_file.name`, `content = decoded file content`.

Response `201 Created`:

```json
{
  "id": 1,
  "user": 1,
  "title": "example.txt",
  "content": "File content...",
  "created_at": "2026-01-01T00:00:00Z"
}
```

### 3.7. Получить chunk документа

```http
GET /api/v1/documents/{id}/chunks/?page=1&page_size=1
Authorization: Bearer <access_token>
```

Query parameters:

| Параметр | Тип | По умолчанию | Описание |
|---|---|---:|---|
| `page` | integer | `1` | Номер страницы chunks, начиная с 1 |
| `page_size` | integer | `1` | Количество chunks в ответе |

Backend делит документ на блоки текста, разделённые пустыми строками. Переносы строк нормализуются к `\n`.

Response для одного chunk:

```json
{
  "document_id": 1,
  "page": 1,
  "page_size": 1,
  "has_next": true,
  "has_prev": false,
  "total_chunks": 3,
  "chunk": ["First paragraph..."],
  "chunk_index": 0,
  "chunk_start": 0,
  "chunk_end": 18
}
```

Response для пустого документа:

```json
{
  "document_id": 1,
  "page": 1,
  "page_size": 1,
  "has_next": false,
  "has_prev": false,
  "total_chunks": 0,
  "chunk": [],
  "chunk_index": null,
  "chunk_start": null,
  "chunk_end": null
}
```

Ошибки:

```json
{"detail": "page and page_size must be integers."}
```

```json
{"detail": "page and page_size must be >= 1."}
```

```json
{"detail": "Страница вне диапазона."}
```

## 4. Labels API

Ресурс меток управляет списком доступных labels.

Модель: `backend/core/models.py` (`core.models.Label`).

Поля:

| Поле | Тип | Описание |
|---|---|---|
| `id` | integer | ID метки |
| `name` | string | Название метки |
| `color` | string | HEX-цвет, например `#ffff00` |

Текущее поведение: метки глобальные, не привязаны к пользователю.

### 4.1. Список меток

```http
GET /api/v1/labels/
Authorization: Bearer <access_token>
```

Response:

```json
[
  {
    "id": 1,
    "name": "Тема",
    "color": "#ffff00"
  }
]
```

### 4.2. Создать метку

```http
POST /api/v1/labels/
Authorization: Bearer <access_token>
Content-Type: application/json
```

Request:

```json
{
  "name": "Тема",
  "color": "#ffff00"
}
```

Response `201 Created`:

```json
{
  "id": 1,
  "name": "Тема",
  "color": "#ffff00"
}
```

### 4.3. Получить метку

```http
GET /api/v1/labels/{id}/
Authorization: Bearer <access_token>
```

### 4.4. Обновить метку

```http
PATCH /api/v1/labels/{id}/
Authorization: Bearer <access_token>
Content-Type: application/json
```

Request:

```json
{
  "name": "Новая метка",
  "color": "#ff0000"
}
```

### 4.5. Удалить метку

```http
DELETE /api/v1/labels/{id}/
Authorization: Bearer <access_token>
```

Response:

```http
204 No Content
```

Важно: `Annotation.label` использует `on_delete=PROTECT`. Если метка используется в аннотациях, удаление может завершиться ошибкой.

## 5. Annotations API

Ресурс аннотаций управляет привязкой фрагментов текста к меткам.

Модель: `backend/core/models.py` (`core.models.Annotation`).

Поля:

| Поле | Тип | Описание |
|---|---|---|
| `id` | integer | ID аннотации |
| `document` | integer | ID документа |
| `label` | integer | ID метки |
| `start` | integer | Абсолютный start-offset в `document.content` |
| `end` | integer | Абсолютный end-offset в `document.content` |
| `text` | string | Текст фрагмента, read-only |
| `created_at` | datetime | Дата создания, read-only |

### 5.1. Список аннотаций

```http
GET /api/v1/annotations/
Authorization: Bearer <access_token>
```

Response:

```json
[
  {
    "id": 1,
    "document": 1,
    "label": 1,
    "start": 0,
    "end": 10,
    "text": "Example...",
    "created_at": "2026-01-01T00:00:00Z"
  }
]
```

Пользователь получает только аннотации к своим документам.

### 5.2. Список аннотаций по документу

Поддерживается query parameter `document`:

```http
GET /api/v1/annotations/?document=1
Authorization: Bearer <access_token>
```

Response — массив аннотаций только для указанного документа и только в рамках документов текущего пользователя.

### 5.3. Создать аннотацию

```http
POST /api/v1/annotations/
Authorization: Bearer <access_token>
Content-Type: application/json
```

Request:

```json
{
  "document": 1,
  "label": 1,
  "start": 0,
  "end": 10
}
```

Response `201 Created`:

```json
{
  "id": 1,
  "document": 1,
  "label": 1,
  "start": 0,
  "end": 10,
  "text": "Selected t",
  "created_at": "2026-01-01T00:00:00Z"
}
```

Backend сам вычисляет поле `text`:

```python
selected_text = document.content[start:end]
```

Критически важно для будущих правок: при создании аннотации нужно валидировать, что `document` принадлежит текущему пользователю, а также что `start/end` находятся в границах документа.

### 5.4. Получить аннотацию

```http
GET /api/v1/annotations/{id}/
Authorization: Bearer <access_token>
```

Доступ должен быть только к аннотациям документов текущего пользователя.

### 5.5. Обновить аннотацию

```http
PATCH /api/v1/annotations/{id}/
Authorization: Bearer <access_token>
Content-Type: application/json
```

Request:

```json
{
  "label": 2,
  "start": 5,
  "end": 20
}
```

Важно: при изменении `start/end` нужно пересчитать `text`. В текущей реализации это стоит проверить отдельно, потому что `perform_create` явно считает `text`, а update-логика отдельно не переопределена.

### 5.6. Удалить аннотацию

```http
DELETE /api/v1/annotations/{id}/
Authorization: Bearer <access_token>
```

Response:

```http
204 No Content
```

## 6. Error format

В кастомных ошибках backend часто использует формат:

```json
{
  "detail": "Описание ошибки"
}
```

DRF validation errors могут иметь формат:

```json
{
  "field_name": ["Error message"]
}
```

Frontend сейчас отображает ошибки через `JSON.stringify(error.response.data)`. Поэтому при изменении API желательно сохранять JSON-ответы понятными и компактными.

## 7. Пагинация

Для `/documents/` используется DRF `LimitOffsetPagination`.

Response format:

```json
{
  "count": 100,
  "next": "http://...",
  "previous": null,
  "results": []
}
```

Для `/documents/{id}/chunks/` используется кастомная page/page_size пагинация, не DRF pagination.

## 8. Frontend-зависимости от API

Frontend ожидает следующие API-особенности:

1. `jwt/create/` возвращает `access` и `refresh`.
2. Все защищённые endpoints принимают `Authorization: Bearer <token>`.
3. `documents/` возвращает limit/offset pagination.
4. Создание и обновление документов принимают `FormData`.
5. `documents/upload/` принимает `.txt` файл в поле `file`.
6. `documents/{id}/chunks/` возвращает `chunk`, `chunk_start`, `chunk_end`, `has_next`, `has_prev`, `total_chunks`, `chunk_index`.
7. `annotations/` принимает абсолютные offsets и возвращает сохранённую аннотацию.
8. `labels/` возвращает массив меток без пагинации.

## 9. Известные расхождения и зоны риска

### 9.1. `schema.yaml` не полностью точен

Нужно обновить описание:

- request для `/documents/upload/` должен описывать поле `file`, а не `TextDocument`;
- response для `/documents/{id}/chunks/` должен описывать кастомный объект chunk-response, а не `TextDocument`;
- JWT status codes нужно проверить по фактическому поведению Djoser/Simple JWT;
- `annotations/?document=<id>` отсутствует/неочевиден в schema;
- endpoints документов фактически используют `multipart/form-data` из-за `MultiPartParser`.

### 9.2. Permissions для `Annotation`

`IsAuthor` сейчас проверяет `obj.user == request.user`. Для `Annotation` владельца нужно проверять через `obj.document.user`.

### 9.3. Создание аннотаций

Нужно убедиться, что пользователь не может создать аннотацию к чужому документу.

### 9.4. Глобальные метки

Нужно явно решить: метки — общий справочник или личные метки пользователя. От этого зависит модель данных, permissions и API.

## 10. Правила обновления API

При любом изменении API:

1. Обновить `backend/api/views.py`, `backend/api/serializers.py`, `backend/api/urls.py`.
2. Обновить/добавить тесты.
3. Обновить `backend/static/schema.yaml`.
4. Обновить этот `API_GUIDE.md`.
5. Проверить frontend-зависимости в `frontend/src/api/api.js` и страницах.
6. Не менять формат существующих ответов без необходимости.
7. Если формат ответа меняется, обновить frontend в том же изменении.
