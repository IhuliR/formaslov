# Formaslov

Formaslov is an MVP web application for manual text annotation. Users can sign in with JWT, create or upload text documents, assign labels to selected ranges, and export annotations as JSON.

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

To override the API URL, create a local `.env` file based on [`.env.example`](.env.example). CRA reads `REACT_APP_API_URL` at build time.

## Main workflows

- JWT login and refresh
- Create a document or upload a UTF-8 `.txt` file
- Browse document chunks
- Create and delete labels and annotations
- Export annotations to JSON in the browser

API details and current limitations are documented in [`docs/API_GUIDE.md`](docs/API_GUIDE.md) and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Static demo

The tracked `demo/` directory contains a browser-only version that uses local JSON data and does not require the Django backend.

## License

MIT
