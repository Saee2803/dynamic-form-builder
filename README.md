# Dynamic Form Builder & Public Registration Portal

## Tech Stack

Frontend:
- React + Vite + Tailwind CSS

Backend:
- Python + FastAPI

Database:
- MySQL

## Project Structure

- `frontend/` – React app for the admin UI shell and eventual form experiences.
- `backend/` – FastAPI application, environment config, and database setup.
- MySQL 8+
- `.gitignore` – ignores generated files and environment variables.

## Prerequisites

Before running the project, make sure you have installed:

- Node.js 18+
- npm
- Python 3.11+
- MySQL 8+
- Git

## Setup

### 1. Frontend setup

```bash
cd frontend
npm install
npm run dev
```

### 2. Backend setup

```bash
cd backend
python -m venv .venv
# Windows PowerShell
.\.venv\Scripts\Activate.ps1
# macOS/Linux
# source .venv/bin/activate

pip install -r requirements.txt
```

### 3. Database setup

1. Install and start MySQL locally.
2. Create a MySQL database named `dynamic_form_builder`.
3. Copy `backend/.env.example` to `backend/.env` and update the values.
4. Run database initialization/migrations.

Example:

```bash
cd backend
python -m alembic upgrade head
```

### 4. Environment variables

Create `backend/.env` based on the example file with values such as:

```env
DATABASE_URL=mysql+pymysql://root:your_password@localhost:3306/dynamic_form_builder
FRONTEND_URL=http://localhost:5173
BACKEND_HOST=0.0.0.0
BACKEND_PORT=8000
```

## Running the Application

Start the backend:
```

## Phase 2 Scope

The admin workspace supports form creation, listing, editing, deletion, and field configuration. Form field configuration is stored as JSON in the existing `forms.form_config` column. This phase does not include public form rendering, publishing, submissions, or PDF generation.

The forms API is available under `/api/forms`:

- `POST /api/forms`
- `GET /api/forms`
- `GET /api/forms/{form_id}`
- `PUT /api/forms/{form_id}`
- `DELETE /api/forms/{form_id}`

The Vite development server proxies `/api` to `http://localhost:8000` by default. Set `VITE_BACKEND_URL` in the frontend environment to use a different local backend. For a deployed frontend, set `VITE_API_BASE_URL` to the API base path or URL.

```bash
cd backend
# activate virtual environment if needed
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Start the frontend:

```bash
cd frontend
npm run dev -- --host 0.0.0.0
```

## Health Check

The backend exposes a health check endpoint:

```http
GET /health
```

Example response:

```json
{
  # Dynamic Form Builder & Public Registration Portal

  A React and FastAPI application for designing forms, publishing public registration pages, collecting validated submissions, generating PDFs, and reviewing submissions in a protected admin workspace.

  ## Features

  - Admin-authenticated form management, publishing, and deactivation.
  - Config-driven public fields with client- and server-side validation.
  - Anonymous submissions stored in the existing `form_submissions` table.
  - Submission confirmation and server-generated PDF downloads.
  - Admin submission search, status/date filters, details, and PDF download.
  - MySQL persistence managed with SQLAlchemy and Alembic.

  ## Stack

  - Frontend: React, JavaScript, Vite, Tailwind CSS.
  - Backend: Python, FastAPI, SQLAlchemy, Pydantic.
  - Database: MySQL.
  - PDF: ReportLab.
  - Admin sessions: PBKDF2-SHA256 password hashes and signed, HttpOnly cookies.

  ## Project Structure

  ```text
  backend/
    app/
      database/       Settings and SQLAlchemy session
      models/         Forms and submissions
      routers/        Auth, forms, public forms, health
      schemas/        Request and response models
      services/       Submission validation and PDF generation
    alembic/          Database migrations
    tests/            Backend unit tests
  frontend/
    src/
      components/     Form builder and public field components
      pages/          Admin, public form, login, and submissions views
      services/       Centralized API client
  ```

  ## Prerequisites

  - Python 3.11 or later.
  - Node.js 18 or later and npm.
  - MySQL 8 or later.

  ## Configure the Environment

  Create a local backend environment file. It is ignored by Git:

  ```powershell
  cd backend
  Copy-Item .env.example .env
  ```

  Set `DATABASE_URL` to the existing MySQL database and keep `FRONTEND_URL` aligned with the browser origin used for development. Do not put plaintext passwords in the environment file.

  Generate an admin password hash. The command prompts for the password twice and prints only the PBKDF2 hash:

  ```powershell
  python -m app.auth
  ```

  Paste that result into `ADMIN_PASSWORD_HASH`. Set `ADMIN_USERNAME`, then generate a separate random signing key:

  ```powershell
  python -c "import secrets; print(secrets.token_urlsafe(48))"
  ```

  Paste the output into `ADMIN_SECRET_KEY`. Use a key of at least 32 characters. Keep `ADMIN_COOKIE_SECURE=false` for local HTTP development; set it to `true` behind HTTPS. The default session lifetime is eight hours and can be changed with `ADMIN_SESSION_TTL_SECONDS`.

  The available settings are listed in [`backend/.env.example`](backend/.env.example). Never commit `backend/.env`, database credentials, password hashes, or signing keys.

  ## Database Setup

  Create the database if it does not already exist:

  ```sql
  CREATE DATABASE dynamic_form_builder CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  ```

  Install backend dependencies, inspect the current migration, and apply pending migrations:

  ```powershell
  cd backend
  python -m venv .venv
  .\.venv\Scripts\Activate.ps1
  python -m pip install -r requirements.txt
  python -m alembic current
  python -m alembic upgrade head
  python -m alembic history
  ```

  Migrations are forward-only; these commands do not reset data. The application uses the existing `forms` and `form_submissions` tables. Admin authentication is environment-backed and does not add database tables.

  ## Run the Application

  Start FastAPI from `backend/`:

  ```powershell
  uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
  ```

  In another terminal, start Vite:

  ```powershell
  cd frontend
  npm install
  npm run dev -- --host 127.0.0.1
  ```

  Open `http://127.0.0.1:5173`. Vite proxies `/api` to `http://localhost:8000` by default. Set `VITE_BACKEND_URL` to change the proxy target, or `VITE_API_BASE_URL` to change the API base path. Keep CORS `FRONTEND_URL` exact when the browser calls FastAPI directly.

  Health check: `GET /health`.

  ## Admin Login and Authorization

  The admin workspace and all `/api/forms` endpoints require a valid admin session. Sign in at `/admin/login`; the session is an expiring HMAC-signed, HttpOnly, SameSite=Strict cookie. Passwords are verified against a PBKDF2-SHA256 hash. Public form, submission, and public PDF endpoints remain public as intended. CORS allows only the configured frontend origin.

  An unauthenticated admin API request returns `401`. If admin settings are missing, login fails closed with `503` and the admin UI explains which environment settings need configuration. No default credentials are provided.

  ## Demo Flow

  1. Sign in, then create or edit a form from the Forms page.
  2. Configure fields, save, and publish the form.
  3. Open its public URL and submit valid values.
  4. Review the confirmation, submitted values, and PDF download.
  5. Return to Forms, open Submissions, filter or view a submission, and download its PDF.
  6. Deactivate and republish the form to verify its public availability changes.

  Submissions pages are available at `/admin/forms/{form_id}/submissions`. Forms with no records show “No submissions yet.” Details and PDF access verify form ownership.

  ## API Reference

  FastAPI Swagger UI: `http://127.0.0.1:8000/docs`.

  Admin form endpoints (session required):

  - `GET /api/forms`
  - `POST /api/forms`
  - `GET /api/forms/{form_id}`
  - `PUT /api/forms/{form_id}`
  - `DELETE /api/forms/{form_id}`
  - `POST /api/forms/{form_id}/publish`
  - `POST /api/forms/{form_id}/deactivate`
  - `GET /api/forms/{form_id}/submissions`
  - `GET /api/forms/{form_id}/submissions/{submission_id}`
  - `GET /api/forms/{form_id}/submissions/{submission_id}/pdf`

  Admin authentication:

  - `POST /api/auth/login`
  - `GET /api/auth/session`
  - `POST /api/auth/logout`

  Public endpoints:

  - `GET /api/public/forms/{slug}`
  - `POST /api/public/forms/{slug}/submit`
  - `GET /api/public/forms/{slug}/submissions/{submission_id}/pdf`

  Unknown forms/submissions and cross-form submission requests return `404`. Invalid submission data returns a client error without creating a row.

  ## Testing

  Backend, from `backend/`:

  ```powershell
  python -m compileall -q app tests
  python -m unittest discover -s tests
  python -m alembic current
  ```

  Frontend, from `frontend/`:

  ```powershell
  npm run lint
  npm run build
  ```

  ## Security and Limitations

  - Admin credentials and the signing key must be configured locally; there is no default admin account, password reset, multi-user management, or rate limiting.
  - Stateless signed sessions are valid until expiry; logout clears the browser cookie but cannot revoke a copied token early.
  - Set secure cookies and HTTPS in production. The development configuration uses HTTP and a non-secure cookie.
  - File fields render publicly but file storage and uploads are not implemented.
  - No authentication is required for the intentionally public form and submission flows.
  - The admin UI is a single-administrator workspace; roles, email notifications, analytics, and advanced reporting are out of scope.

