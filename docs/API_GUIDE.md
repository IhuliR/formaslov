# API_GUIDE.md

## 1. Общая информация

Backend API проекта Formaslov построен на Django REST Framework.

Базовый префикс API:

```text
/api/v1/
```

Все основные endpoints, кроме регистрации и получения JWT-токенов, требуют
авторизации.

Публичная страница `/demo` не является API endpoint. Она работает на
статических frontend-данных и не читает и не изменяет документы, метки или
аннотации в базе.

Формат авторизации:

```http
Authorization: Bearer <access_token>
```

Ресурсы `/documents/`, `/labels/` и `/annotations/` требуют JWT для всех
операций list/create/retrieve/update/delete. Queryset каждого ресурса
ограничен текущим пользователем: документы и метки связаны с ним напрямую,
аннотации — через владельца документа.

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

Регистрация и JWT endpoints подключены через Djoser/Simple JWT:

```python
path('v1/', include('djoser.urls'))
path('v1/', include('djoser.urls.jwt'))
```

### 2.1. Регистрация

```http
POST /api/v1/users/
Content-Type: application/json
```

Request:

```json
{
  "username": "user",
  "password": "strong-password"
}
```

Response `201 Created` содержит созданного пользователя без пароля.
Endpoint предоставляется Djoser и доступен без JWT. Frontend после успешной
регистрации перенаправляет пользователя на `/login`.

### 2.2. Получить текущего пользователя

```http
GET /api/v1/users/me/
Authorization: Bearer <access_token>
```

Response `200 OK`:

```json
{
  "id": 1,
  "username": "ilya"
}
```

Endpoint предоставляется Djoser и требует JWT. Пароль, hash пароля и лишние
профильные поля в ответ не включаются.

### 2.3. Изменить пароль

```http
POST /api/v1/users/set_password/
Authorization: Bearer <access_token>
Content-Type: application/json
```

Request:

```json
{
  "current_password": "old-password",
  "new_password": "new-strong-password",
  "re_new_password": "new-strong-password"
}
```

Response при успехе:

```http
204 No Content
```

Endpoint предоставляется Djoser. В `DJOSER` включён
`SET_PASSWORD_RETYPE`, поэтому оба поля нового пароля обязательны. Djoser:

- проверяет текущий пароль;
- проверяет совпадение `new_password` и `re_new_password`;
- применяет стандартные Django password validators;
- меняет пароль через модель пользователя;
- не возвращает и не записывает пароль в API-ответ.

Примеры `400 Bad Request`:

```json
{
  "current_password": ["Invalid password."]
}
```

```json
{
  "non_field_errors": ["The two password fields didn't match."]
}
```

```json
{
  "new_password": ["This password is too common."]
}
```

Frontend преобразует эти ответы в короткие русскоязычные сообщения. При
успешной смене пароля текущие JWT access/refresh tokens не удаляются, поэтому
пользователь остаётся авторизованным.

### 2.4. Получить пару токенов

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

### 2.5. Обновить access token

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

### 2.6. Проверить token

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
| `title` | string | Человекочитаемое название документа |
| `slug` | string | Технический slug, read-only, уникален в рамках пользователя |
| `original_filename` | string | Исходное имя загруженного файла, если применимо |
| `content` | string | Полный текст документа |
| `created_at` | datetime | Дата создания, read-only |

Если `title` пустой, backend использует имя файла без расширения из
`original_filename`, а затем fallback `Новый документ`. `slug` генерируется
backend через `python-slugify`; frontend не передаёт и не управляет им.

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
      "title": "Тёзка",
      "slug": "tezka",
      "original_filename": "",
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
| `title` | нет | Название документа; при пустом значении используется fallback |
| `original_filename` | нет | Исходное имя файла, например `Тёзка.txt` |
| `content` | да | Текст документа |

Переносы строк в `content` нормализуются при сохранении: `\r\n` и `\r`
преобразуются в `\n`. Это обеспечивает единые offsets для просмотра,
аннотаций и экспорта.

Response `201 Created`:

```json
{
  "id": 1,
  "user": 1,
  "title": "Тёзка",
  "slug": "tezka",
  "original_filename": "",
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
  "title": "Тёзка",
  "slug": "tezka",
  "original_filename": "Тёзка.txt",
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
| `original_filename` | нет | Новое исходное имя файла |
| `content` | нет | Новый текст |

Если `title` изменился, backend автоматически пересоздаёт `slug`, сохраняя
уникальность в рамках текущего пользователя. URL документа продолжает
использовать числовой `id`.

Response:

```json
{
  "id": 1,
  "user": 1,
  "title": "Updated title",
  "slug": "updated-title",
  "original_filename": "",
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
- при успехе создаётся `TextDocument`, где `title` равен имени файла без
  расширения, `original_filename` хранит полное исходное имя, а `slug`
  генерируется автоматически;
- переносы строк `\r\n` и `\r` в прочитанном тексте сохраняются как `\n`.

Response `201 Created`:

```json
{
  "id": 1,
  "user": 1,
  "title": "example",
  "slug": "example",
  "original_filename": "example.txt",
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

Backend делит сохранённый `document.content` на блоки текста, разделённые
пустыми строками. `chunk_start` и `chunk_end` всегда относятся к исходной
сохранённой строке без дополнительного преобразования в chunk endpoint.

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

Ресурс меток управляет личным списком labels текущего пользователя.

Модель: `backend/core/models.py` (`core.models.Label`).

Поля:

| Поле | Тип | Описание |
|---|---|---|
| `id` | integer | ID метки |
| `name` | string | Название метки |
| `color` | string | HEX-цвет, например `#ffff00` |

Каждая метка принадлежит пользователю. Поле владельца не принимается и не
возвращается API: backend определяет владельца по JWT. Имя метки уникально
только в рамках одного пользователя, поэтому разные пользователи могут создать
метки с одинаковым названием.

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

Пользователь получает только свои метки. Запрос конкретной чужой метки
возвращает `404 Not Found`.

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

При повторном имени у того же пользователя возвращается `400 Bad Request`.

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

Если метка используется в аннотациях, backend сохраняет метку и связанные
аннотации и возвращает `409 Conflict`:

```json
{
  "detail": "Нельзя удалить метку «зло»: она используется в 7 аннотациях. Сначала удалите или измените эти аннотации.",
  "code": "label_in_use",
  "annotations_count": 7
}
```

`Annotation.label` продолжает использовать `on_delete=PROTECT`: связанные
аннотации не удаляются автоматически.

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

При создании или обновлении аннотации поля `document` и `label` принимают
только объекты текущего пользователя. Чужой ID обрабатывается как невалидное
значение поля и возвращает `400 Bad Request` без раскрытия существования
объекта.

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
  "end": 10,
  "text": "Selected t"
}
```

Frontend может передавать `text` для явного отображения своего контракта, но
backend не доверяет этому значению и всегда вычисляет сохранённый текст как
`document.content[start:end]`.

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

При создании и обновлении backend проверяет:

- документ принадлежит текущему пользователю;
- метка принадлежит текущему пользователю;
- `start >= 0`;
- `start < end`;
- `end <= len(document.content)`;
- выбранный фрагмент не состоит только из пробелов и переносов строк.

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

При изменении `document`, `start` или `end` backend повторно вычисляет `text`
по актуальным координатам.

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

1. `users/` принимает `username` и `password` для регистрации.
2. `jwt/create/` возвращает `access` и `refresh`.
3. Все защищённые endpoints принимают `Authorization: Bearer <token>`.
4. `documents/` возвращает limit/offset pagination.
5. Создание и обновление документов принимают `FormData`.
6. React-форма читает `.txt` через `FileReader` и отправляет результат как
   `content`, имя файла как `original_filename` и редактируемый `title` в
   `documents/`; отдельный `documents/upload/` endpoint продолжает принимать
   `.txt` файл в поле `file`.
7. `documents/{id}/chunks/` возвращает `chunk`, `chunk_start`, `chunk_end`, `has_next`, `has_prev`, `total_chunks`, `chunk_index`.
8. `annotations/` принимает абсолютные offsets и возвращает сохранённую аннотацию.
9. `labels/` возвращает массив меток без пагинации.
10. Frontend экспортирует schema v2 с полным `document.content`; текст каждой
   аннотации повторно вычисляется через `document.content.slice(start, end)`.
   Метаданные документа включают `title`, `slug` и `original_filename`, а имя
   файла формируется как `{slug}_export.json` с fallback
   `document_{id}_export.json`.

## 9. Известные расхождения и зоны риска

### 9.1. `schema.yaml` не полностью точен

Нужно обновить описание:

- request для `/documents/upload/` должен описывать поле `file`, а не `TextDocument`;
- response для `/documents/{id}/chunks/` должен описывать кастомный объект chunk-response, а не `TextDocument`;
- JWT status codes нужно проверить по фактическому поведению Djoser/Simple JWT;
- `annotations/?document=<id>` отсутствует/неочевиден в schema;
- endpoints документов фактически используют `multipart/form-data` из-за `MultiPartParser`.

## 10. Правила обновления API

При любом изменении API:

1. Обновить `backend/api/views.py`, `backend/api/serializers.py`, `backend/api/urls.py`.
2. Обновить/добавить тесты.
3. Обновить `backend/static/schema.yaml`.
4. Обновить этот `API_GUIDE.md`.
5. Проверить frontend-зависимости в `frontend/src/api/api.js` и страницах.
6. Не менять формат существующих ответов без необходимости.
7. Если формат ответа меняется, обновить frontend в том же изменении.
