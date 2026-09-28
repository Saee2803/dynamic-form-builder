# Dynamic Form Builder & Public Registration Portal

A React/Vite and FastAPI application for building forms, publishing public registration URLs, validating submissions, generating PDFs, and reviewing submissions in an authenticated admin workspace.

## Stack

- Frontend: React, JavaScript, Vite, Tailwind CSS.
- Backend: Python, FastAPI, Pydantic, SQLAlchemy.
- Database: MySQL with Alembic migrations.
- PDF: ReportLab.
- Admin sessions: PBKDF2-SHA256 password hashes and signed HttpOnly cookies.

## Requirements

- Python 3.11 or later.
- Node.js 18 or later and npm.
- MySQL 8 or later.

## Setup

Create a MySQL database, then configure the backend environment:

```sql
CREATE DATABASE dynamic_form_builder CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

From `backend/`, create the environment and install dependencies:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Set `DATABASE_URL` and `FRONTEND_URL` in `backend/.env`. Configure `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, and `ADMIN_SECRET_KEY`; generate a password hash with `python -m app.auth` and a signing key with `python -c "import secrets; print(secrets.token_urlsafe(48))"`. Keep `.env` private. Use `ADMIN_COOKIE_SECURE=true` behind HTTPS.

Apply migrations from `backend/`:

```powershell
python -m alembic upgrade head
```

This applies forward-only migrations and preserves existing records. Existing submissions receive a null form snapshot and remain readable using the current form configuration; new submissions save their form name, description, and JSON configuration snapshot.

Run FastAPI from `backend/` and Vite from `frontend/` in separate terminals:

```powershell
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

```powershell
npm install
npm run dev -- --host 127.0.0.1
```

Open `http://127.0.0.1:5173`. Vite proxies `/api` to `http://localhost:8000`. Set `VITE_BACKEND_URL` to change the proxy target or `VITE_API_BASE_URL` to change the frontend API base. FastAPI Swagger UI is at `http://127.0.0.1:8000/docs`; health check: `GET /health`.

## Form Configuration Example

Form fields are saved in the `forms.form_config` JSON column. Public forms render the active fields from this configuration.

```json
{
  "fields": [
    {
      "id": "field_1",
      "name": "email_address",
      "label": "Email address",
      "type": "email",
      "placeholder": "name@example.com",
      "required": true,
      "defaultValue": "",
      "helpText": "We will use this for registration updates.",
      "options": [],
      "validation": { "maxLength": 254 },
      "order": 1,
      "active": true
    },
    {
      "id": "field_2",
      "name": "interests",
      "label": "Areas of interest",
      "type": "multiselect",
      "required": false,
      "options": [
        { "label": "Design", "value": "design" },
        { "label": "Engineering", "value": "engineering" }
      ],
      "validation": {},
      "order": 2,
      "active": true
    }
  ]
}
```

Supported types include text, textarea, number, email, mobile, date, radio, select, multiselect, checkbox, heading, paragraph, and file. File inputs currently render but file storage/upload is not implemented; submitted file values are rejected/ignored by the backend.

## Admin and Participant Workflow

Sign in at `/admin/login`. The admin can create and edit forms, reorder/configure fields, preview the form, search/filter the forms list, publish/deactivate, and view submission lists/details and PDFs. Publish a form to enable its unique `/forms/{slug}` public URL. Participants submit the database-backed form and receive a confirmation with submitted values and a PDF download. Submission timestamps are stored by the backend as UTC and displayed in `Asia/Kolkata` in the frontend.

## API Reference

Admin form endpoints require the admin session cookie:

- `POST /api/forms`
- `GET /api/forms`
- `GET /api/forms/{form_id}`
- `PUT /api/forms/{form_id}`
- `DELETE /api/forms/{form_id}`
- `POST /api/forms/{form_id}/publish`
- `POST /api/forms/{form_id}/deactivate`
- `GET /api/forms/{form_id}/submissions`
- `GET /api/forms/{form_id}/submissions/{submission_id}`
- `GET /api/forms/{form_id}/submissions/{submission_id}/pdf`

Public endpoints:

- `GET /api/public/forms/{slug}`
- `POST /api/public/forms/{slug}/submit`
- `GET /api/public/forms/{slug}/submissions/{submission_id}/pdf`

Authentication endpoints are `POST /api/auth/login`, `GET /api/auth/session`, and `POST /api/auth/logout`. Only published forms are available through public form and submission endpoints. FastAPI OpenAPI documentation is available at `/docs` and `/openapi.json`.

## Database Tables

`forms` stores its name, description, unique slug, complete JSON configuration, status, creator, and timestamps. `form_submissions` stores the form reference, JSON submission values, optional submitter, timestamp, status, and nullable JSON `form_snapshot`. The snapshot migration does not delete or rewrite existing submissions.

## Tests

From `backend/`:

```powershell
python -m compileall -q app tests alembic
python -m unittest discover -s tests
```

From `frontend/`:

```powershell
npm run lint
npm run build
```

## Security Notes

- All `/api/forms` routes require a valid admin session. No default admin credentials are provided.
- CORS permits only the configured `FRONTEND_URL`.
- Database access uses SQLAlchemy ORM queries.
- Form labels, help text, and submitted values are rendered as text; PDF text is escaped before ReportLab paragraph rendering.
- Public forms and their submissions are intentionally unauthenticated.
- Configure HTTPS and secure cookies for production. Rate limiting, multi-admin roles, and file storage are not implemented.