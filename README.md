# Formaslov

Formaslov is an MVP web application for manual text annotation. Users can
register or sign in with JWT, create or upload text documents, assign labels
to selected ranges, and export annotations as JSON.

## Stack

- Django, Django REST Framework, Djoser, Simple JWT
- React (Create React App), Axios
- SQLite for local development

## Repository structure

```text
backend/   Django project and applications
frontend/  React application
docs/      Architecture, API, style, and maintainer guides
demo/      Static browser-only demo
```

## Local setup

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

The API is available at `http://127.0.0.1:8000/api/v1/`.

### Frontend

```bash
cd frontend
npm install
npm start
```

The interface is available at `http://localhost:3000`.

To override frontend values, create `frontend/.env` using the relevant
`REACT_APP_*` lines from [`.env.example`](.env.example). CRA reads them at
build time.

## User flow

Public routes:

- `/` — landing page with a short product explanation
- `/demo` — static read-only product demo; no account or API data required
- `/login` — JWT login
- `/register` — account registration through Djoser

Protected routes:

- `/documents` — the current user's documents
- `/documents/:id` — document annotation workspace
- `/labels` — label management
- `/account` — current username and password change form

Registration uses `POST /api/v1/users/`. After registration, the user is sent
to `/login`. Login uses `POST /api/v1/jwt/create/`. Logout removes the access
and refresh tokens from browser storage and returns to `/`. The frontend loads
the signed-in username from `GET /api/v1/users/me/`. Password changes use
`POST /api/v1/users/set_password/` and keep the current JWT session active.

## Main workflows

- Public landing and read-only demo
- Registration, JWT login, and refresh
- Create a document from manual content or a UTF-8 `.txt` file
- Browse document chunks
- Create and delete labels and annotations
- Export annotations to JSON in the browser

The document form accepts either manual content or a `.txt` file. When both
are provided, the file content takes priority. If the title is empty, the
uploaded file name without the `.txt` extension is used.

API details and current limitations are documented in [`docs/API_GUIDE.md`](docs/API_GUIDE.md) and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

User documents, labels, and annotations require JWT authentication and are
filtered by the current account. Anonymous users cannot read or mutate these
resources through the API.

## Read-only demo

The `Попробовать демо` action opens `/demo`. The page uses static data from
`frontend/src/data/demoDocument.js`, does not request JWT tokens, and does not
send data to the backend. Its JSON export is generated and downloaded entirely
in the browser.

There is no shared public demo-account flow and no frontend demo credentials.
To upload texts, manage labels, create annotations, or work with personal
documents, a user must register or sign in.

Anonymous visitors see registration and login actions on `/demo`. Signed-in
users keep the same read-only demo content, but the header shows workspace and
account navigation and the page links back to their documents.

## Optional local sample data

The backend retains `seed_demo_data` as a development/admin utility. It is not
used by `/demo` and should not be exposed as a shared public account. To create
or reset local sample records:

```bash
cd backend
python manage.py seed_demo_data
```

Optional environment variables:

```env
DEMO_USERNAME=demo
DEMO_PASSWORD=demo
```

The project does not auto-load the root `.env.example`; export these backend
values in the shell before running the command.

## Standalone static demo

The tracked `demo/` directory also contains a standalone browser-only artifact.
The React application route `/demo` is the canonical in-app demo flow.

## License

MIT
