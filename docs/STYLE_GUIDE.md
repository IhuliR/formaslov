# STYLE_GUIDE.md

## 1. Общие принципы

Этот проект нужно поддерживать как компактный портфолио-MVP: код должен быть простым, читаемым и предсказуемым. Не нужно преждевременно усложнять архитектуру, добавлять лишние абстракции или переписывать рабочие части без явной причины.

Главные принципы:

1. Сохранять понятную Django/DRF-структуру.
2. Разделять доменную модель, API-слой и frontend.
3. Не ломать текущие пользовательские сценарии.
4. Любое изменение API сопровождать обновлением документации.
5. Любое изменение авторизации/permissions проверять особенно внимательно.
6. Не хранить секреты, локальные базы и build-артефакты в репозитории.

## 2. Python/Django стиль

### 2.1. Базовый стиль

- Следовать PEP 8.
- Использовать 4 пробела для отступов.
- Имена классов — `PascalCase`.
- Имена функций, методов, переменных — `snake_case`.
- Константы — `UPPER_SNAKE_CASE`.
- Не оставлять неиспользуемые импорты.
- Не добавлять “магические” значения без константы или комментария, если значение важно для доменной логики.

### 2.2. Импорты

Группировать импорты так:

```python
# standard library
import re

# django / third-party
from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets

# local
from core.models import TextDocument
from .serializers import TextDocumentSerializer
```

Внутри групп сортировать импорты по читаемости. Не смешивать local imports с third-party.

### 2.3. Модели

Модели должны оставаться в доменных приложениях:

- `core.models` — документы, метки, аннотации;
- `users.models` — пользователь.

Правила:

- `__str__` должен возвращать человекочитаемое значение.
- Для связей всегда задавать понятный `related_name`, если связь используется из обратной стороны.
- Для пользовательских данных всегда продумывать ownership.
- При добавлении полей учитывать миграции и обратную совместимость.

### 2.4. Сериализаторы

Сериализаторы находятся в `backend/api/serializers.py`.

Правила:

- Read-only поля явно указывать в `read_only_fields`.
- Валидацию API-данных держать в serializer-level validation, если она относится к входным данным.
- Валидацию, зависящую от `request.user`, можно делать через `self.context['request']`.
- Не доверять frontend-данным для ownership-полей.

Для аннотаций желательно добавить явную валидацию:

- документ принадлежит текущему пользователю;
- `start < end`;
- `end <= len(document.content)`;
- длина выделенного текста помещается в `Annotation.text` или поле `text` переводится в `TextField`.

### 2.5. ViewSets

ViewSets находятся в `backend/api/views.py`.

Правила:

- `get_queryset()` должен ограничивать данные текущим пользователем там, где есть пользовательские данные.
- `perform_create()` должен выставлять поля, которым нельзя доверять от клиента, например `user=request.user`.
- Для кастомных действий использовать `@action`.
- Возвращать понятные ошибки в формате `{"detail": "..."}`.
- Не помещать тяжёлую доменную логику прямо во view, если она начинает расти; выносить в отдельные функции/services.

### 2.6. Permissions

Permissions находятся в `backend/api/permissions.py`.

Критически важное правило: object-level permission должен учитывать тип объекта.

Текущий `IsAuthor` подходит для объектов с полем `user`, например `TextDocument`, но не подходит напрямую для `Annotation`, где владелец находится через `obj.document.user`.

Рекомендуемый подход:

```python
class IsOwnerOrDocumentOwner(BasePermission):
    def has_object_permission(self, request, view, obj):
        if hasattr(obj, 'user'):
            return obj.user == request.user
        if hasattr(obj, 'document'):
            return obj.document.user == request.user
        return False
```

Или использовать разные permission-классы для разных ресурсов.

## 3. API стиль

### 3.1. URL

- Использовать REST-подход и существующий префикс `/api/v1/`.
- Не добавлять endpoints вне `/api/v1/`, если это API.
- Для нестандартных операций использовать DRF `@action`.
- Имена endpoints должны быть существительными или понятными действиями:
  - `documents/`
  - `documents/upload/`
  - `documents/{id}/chunks/`
  - `labels/`
  - `annotations/`

### 3.2. Форматы данных

- JSON — основной формат для API.
- `multipart/form-data` использовать только там, где это нужно: загрузка файлов или текущие endpoints документов с `MultiPartParser`.
- Не менять content type документов без одновременного обновления frontend.

### 3.3. Ошибки

Для кастомных ошибок использовать:

```json
{"detail": "Описание ошибки"}
```

Ошибки должны быть полезны пользователю и frontend-разработчику.

### 3.4. Пагинация

- Для списков ресурсов использовать DRF pagination.
- Для chunks допускается кастомная page/page_size пагинация, потому что она возвращает смещения текста.
- Не смешивать limit/offset и page/page_size в одном endpoint без необходимости.

### 3.5. API-документация

При изменении API обязательно обновить:

- `API_GUIDE.md`;
- `backend/static/schema.yaml`;
- frontend-код, если он зависит от изменённого формата.

Если `schema.yaml` и код расходятся, нельзя молча править только документацию. Нужно либо привести код и schema к одному контракту, либо явно зафиксировать расхождение в отчёте.

## 4. Frontend стиль

### 4.1. Общие правила

- Использовать функциональные React-компоненты.
- Использовать hooks (`useState`, `useEffect`, `useMemo`, `useCallback`, `useRef`) там, где это оправдано.
- Не хранить API-логику внутри компонентов, если её можно вынести в `frontend/src/api/api.js` или отдельные helper-функции.
- Не дублировать утилиты без необходимости. Например, `toRgba` сейчас встречается в нескольких местах; при рефакторинге можно вынести в общий helper.

### 4.2. Структура frontend

```text
frontend/src/
├── api/              # axios instance and interceptors
├── components/       # reusable components
├── pages/            # route-level pages
├── styles/           # CSS
├── App.js            # routes
└── index.js          # entry point
```

### 4.3. API client

Файл: `frontend/src/api/api.js`.

Правила:

- Все HTTP-запросы должны идти через общий `api` instance.
- Access token добавлять через interceptor.
- Refresh token flow держать централизованно.
- API base URL нужно вынести из hardcode в env перед Docker/deploy.

Рекомендуемый формат для CRA:

```javascript
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api/v1/',
});
```

### 4.4. Компоненты

Компоненты должны быть небольшими и отвечать за одну задачу.

Примеры текущего разделения:

- `Header` — навигация и logout;
- `PrivateRoute` — защита маршрутов;
- `Loader` — состояние загрузки;
- `ErrorMessage` — отображение ошибки;
- `Pagination` — кнопки пагинации;
- `AnnotationList` — список аннотаций;
- `DocumentForm` — создание документа.

### 4.5. Работа с выделением текста

Логика выделения в `DocumentPage` чувствительна к offsets. При изменениях нужно проверять:

- выделение внутри `document-content-box`;
- перевод local offsets в absolute offsets;
- отображение highlights;
- удаление аннотаций;
- переход между chunks;
- редактирование документа после создания аннотаций.

Не менять эту логику “по пути”, если задача не касается выделения/разметки.

## 5. Настройки и окружение

### 5.1. Секреты

Нельзя хранить в репозитории:

- `SECRET_KEY`;
- production credentials;
- пароли от БД;
- токены;
- приватные ключи;
- реальные `.env` файлы.

Нужно добавить `.env.example` с безопасными placeholder-значениями.

### 5.2. Рекомендуемые env-переменные backend

```env
SECRET_KEY=change-me
DEBUG=False
ALLOWED_HOSTS=localhost,127.0.0.1
CSRF_TRUSTED_ORIGINS=http://localhost
CORS_ALLOWED_ORIGINS=http://localhost:3000
DB_ENGINE=django.db.backends.postgresql
POSTGRES_DB=formaslov
POSTGRES_USER=formaslov
POSTGRES_PASSWORD=formaslov
DB_HOST=db
DB_PORT=5432
```

Точный набор можно адаптировать при Docker-задаче.

### 5.3. Рекомендуемые env-переменные frontend

```env
REACT_APP_API_URL=http://127.0.0.1:8000/api/v1/
```

## 6. Статика, media и Docker

### 6.1. Static files

Django static:

- `STATIC_URL = '/static/'`;
- текущая директория статических файлов: `backend/static/`.

Для Docker/deploy нужно добавить `STATIC_ROOT`, например:

```python
STATIC_ROOT = BASE_DIR / 'collected_static'
```

И выполнять:

```bash
python manage.py collectstatic --noinput
```

### 6.2. Media files

Сейчас загруженные `.txt` файлы не сохраняются как файлы. Их содержимое читается и сохраняется в `TextDocument.content`. Поэтому `MEDIA_ROOT` пока не обязателен.

Если в будущем появятся реальные файловые загрузки, добавить:

- `MEDIA_URL`;
- `MEDIA_ROOT`;
- media volume в Docker Compose;
- ограничения размера и типа файлов.

### 6.3. Не коммитить build/runtime артефакты

В репозитории не должно быть:

```text
db.sqlite3
node_modules/
frontend/build/
__pycache__/
*.pyc
.DS_Store
__MACOSX/
.env
```

## 7. Тесты и проверки

Минимальные проверки backend:

```bash
cd backend
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py test
```

Минимальные проверки frontend:

```bash
cd frontend
npm test -- --watchAll=false
npm run build
```

Если тестов пока мало или они отсутствуют, при изменении критичной логики нужно добавить минимальные тесты.

Особенно важные тесты:

- пользователь видит только свои документы;
- пользователь не может получить чужой документ;
- пользователь не может создать аннотацию к чужому документу;
- `start/end` валидируются;
- chunks корректно возвращают `chunk_start` и `chunk_end`;
- `.txt` upload принимает UTF-8 и отклоняет неподходящие файлы;
- JWT login/refresh работает с frontend.

## 8. Git style

Коммиты лучше делать маленькими и тематическими.

Примеры:

```text
docs: add architecture and api guide
fix: validate annotation ownership
fix: move django settings to environment variables
infra: add docker compose setup
test: cover document access permissions
refactor: extract frontend color helper
```

Не смешивать в одном коммите:

- Docker;
- permissions;
- frontend UI;
- README;
- schema changes;
- форматирование.

## 9. Что не делать без отдельной задачи

- Не переписывать проект на другой стек.
- Не заменять DRF ViewSets на function-based views без причины.
- Не удалять JWT/Djoser без отдельного решения.
- Не менять модель пользователя радикально без миграционного плана.
- Не переводить метки из глобальных в пользовательские без обновления API, frontend и миграций.
- Не менять формат export JSON без обновления документации.
- Не удалять старые templates, если задача не про очистку legacy-файлов. Сначала проверить, используются ли они.
- Не менять chunking algorithm без тестов offsets.

## 10. Приоритет качества для портфолио

Для портфолио важнее показать:

1. Чистую структуру.
2. Безопасную работу с пользовательскими данными.
3. Понятный README и документацию.
4. Воспроизводимый запуск через Docker.
5. Минимальные тесты критичной логики.
6. Актуальный API contract.

Не стоит добавлять много новых фич, пока не закрыты базовые инженерные слабые места.
