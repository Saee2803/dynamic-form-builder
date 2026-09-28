# Dynamic Form Builder & Public Registration Portal

## Project Overview

Dynamic Form Builder is a single-admin web application for creating configurable forms, publishing public registration URLs, collecting validated responses, and reviewing submissions with generated PDF receipts. Form definitions and submissions are persisted in MySQL as JSON-backed records.

## Main Features

- Create, edit, delete, search, and filter forms in the admin workspace.
- Add, edit, delete, and reorder fields; configure labels, names, placeholders, defaults, help text, options, required state, activation, and validation limits.
- Preview a form before publishing; publish, deactivate, and copy its unique public URL.
- Render public forms dynamically from the published database configuration.
- Validate participant input in the browser and again in the backend.
- Show submitted values and a PDF download in the confirmation dialog.
- Review submissions in the admin workspace, including details and PDF downloads.
- Preserve the submitted form configuration snapshot for submissions created after the snapshot migration.

## Technology Stack

- Frontend: React, JavaScript, Vite, Tailwind CSS.
- Backend: Python, FastAPI, Pydantic, SQLAlchemy.
- Database: MySQL with Alembic migrations.
- PDF generation: ReportLab.
- Admin authentication: PBKDF2-SHA256 password hashes and signed, HttpOnly cookies.

## Architecture and Data Flow

The React frontend calls FastAPI through `/api`; the Vite development server proxies that path to the backend. FastAPI routers validate requests with Pydantic and use SQLAlchemy to read and write MySQL records.

Admin flow: sign in, create or edit a form, save its JSON configuration, preview it, then publish it. Publishing exposes the form at `/forms/{slug}`. Deactivation removes public access without deleting the form.

Participant flow: open the public URL, fetch the published form configuration, render its active fields, validate values, and submit them to the public API. The backend validates again, stores response data and a form snapshot, then returns a submission reference and timestamp. The frontend displays confirmation and requests a PDF for that submission ID.

Admin submission flow: fetch the form's submissions, open a selected submission's details, and request a PDF for that exact submission ID. Generating a PDF does not create or update a submission.

## Database Design

### `forms`

| Column | Purpose |
|---|---|
| `form_id` | Primary key. |
| `form_name` | Display name. |
| `form_description` | Optional description. |
| `form_slug` | Unique public URL segment. |
| `form_config` | Complete dynamic form definition stored as JSON. |
| `status` | Draft, published, or inactive state. |
| `created_by` | Optional admin username that created the form. |
| `created_at` | Creation timestamp. |
| `updated_at` | Last update timestamp. |

### `form_submissions`

| Column | Purpose |
|---|---|
| `submission_id` | Primary key and submission reference. |
| `form_id` | Foreign key to `forms.form_id`; one form can have many submissions. |
| `submission_data` | Participant responses stored as JSON. |
| `submitted_by` | Optional submitter identifier; public submissions may leave it null. |
| `submitted_at` | Submission timestamp, stored by the current application as a naive UTC datetime. |
| `status` | Submission status. |
| `form_snapshot` | Nullable JSON snapshot of the form name, description, and configuration at submission time. |

The `b78f2c4a91e` migration adds nullable `form_snapshot`. New submissions preserve their form configuration so edits to a form do not change the labels/options used to display those submissions. Rows created before that migration have no original snapshot; they remain readable using the current form configuration, but their historical configuration cannot be reconstructed. Deleting a form cascades to its submissions, so do not delete a form if its records must be retained.

## JSON Form Configuration

`forms.form_config` stores the form structure as JSON. Each field can define an ID, name, label, type, placeholder, required state, default value, help text, options, validation, display order, and active state. Public rendering uses this saved configuration; the sample below is illustrative only and is **not hardcoded into the application**.

```json
{
  "fields": [
    {
      "id": "full_name",
      "name": "full_name",
      "label": "Full name",
      "type": "text",
      "placeholder": "Enter your name",
      "required": true,
      "defaultValue": "",
      "helpText": "Use your preferred name.",
      "options": [],
      "validation": { "minLength": 2, "maxLength": 100 },
      "order": 1,
      "active": true
    },
    {
      "id": "email",
      "name": "email",
      "label": "Email address",
      "type": "email",
      "placeholder": "name@example.com",
      "required": true,
      "defaultValue": "",
      "options": [],
      "validation": { "maxLength": 254 },
      "order": 2,
      "active": true
    },
    {
      "id": "age",
      "name": "age",
      "label": "Age",
      "type": "number",
      "required": true,
      "defaultValue": "",
      "options": [],
      "validation": { "min": 18, "max": 120 },
      "order": 3,
      "active": true
    },
    {
      "id": "attendance",
      "name": "attendance",
      "label": "Attendance preference",
      "type": "radio",
      "required": true,
      "options": [
        { "label": "In person", "value": "in_person" },
        { "label": "Remote", "value": "remote" }
      ],
      "validation": {},
      "order": 4,
      "active": true
    },
    {
      "id": "country",
      "name": "country",
      "label": "Country",
      "type": "select",
      "required": true,
      "options": [
        { "label": "India", "value": "india" },
        { "label": "Other", "value": "other" }
      ],
      "validation": {},
      "order": 5,
      "active": true
    },
    {
      "id": "interests",
      "name": "interests",
      "label": "Areas of interest",
      "type": "multiselect",
      "required": false,
      "options": [
        { "label": "Design", "value": "design" },
        { "label": "Engineering", "value": "engineering" }
      ],
      "validation": {},
      "order": 6,
      "active": true
    },
    {
      "id": "terms",
      "name": "terms",
      "label": "Terms & Conditions",
      "type": "checkbox",
      "required": true,
      "options": [
        { "label": "I agree to the Terms & Conditions", "value": "agree" }
      ],
      "validation": {},
      "order": 7,
      "active": true
    },
    {
      "id": "start_date",
      "name": "start_date",
      "label": "Preferred start date",
      "type": "date",
      "required": false,
      "defaultValue": "",
      "options": [],
      "validation": {},
      "order": 8,
      "active": true
    }
  ]
}
```

Supported field types also include `textarea`, `mobile`, `heading`, `paragraph`, and `file`. A checkbox with options stores selected option values; a checkbox without options represents a boolean choice.

## Admin and Public Workflows

Open `/admin/login` to access the protected workspace. From the Forms page, create or open a form, configure/reorder fields, save, and preview it. The listing provides search and status filters, publish/deactivate, copy public URL, and submission navigation. Submission details and PDFs are available at `/admin/forms/{form_id}/submissions`.

Participants use the published `/forms/{slug}` URL. The public page fetches its configuration from the backend, renders active fields, displays validation errors, and submits the response. On success, a dialog shows the submitted values, submission reference, local display time, and PDF download.

## API Reference

All `/api/forms` endpoints require the admin session cookie.

| Method and path | Purpose | Access |
|---|---|---|
| `POST /api/forms` | Create a draft form and save its JSON configuration. | Admin |
| `GET /api/forms` | List forms for the admin workspace. | Admin |
| `GET /api/forms/{form_id}` | Read a form for editing. | Admin |
| `PUT /api/forms/{form_id}` | Update form name, description, or configuration. | Admin |
| `DELETE /api/forms/{form_id}` | Delete a form (also deletes associated submissions through the FK cascade). | Admin |
| `POST /api/forms/{form_id}/publish` | Publish a form and return its slug. | Admin |
| `POST /api/forms/{form_id}/deactivate` | Make a form unavailable publicly. | Admin |
| `GET /api/forms/{form_id}/submissions` | List submissions with summaries. | Admin |
| `GET /api/forms/{form_id}/submissions/{submission_id}` | Read submission details and its snapshot when present. | Admin |
| `GET /api/forms/{form_id}/submissions/{submission_id}/pdf` | Download a selected submission's PDF. | Admin |
| `GET /api/public/forms/{slug}` | Fetch a published form configuration. | Public |
| `POST /api/public/forms/{slug}/submit` | Validate and save a submission to a published form. | Public |
| `GET /api/public/forms/{slug}/submissions/{submission_id}/pdf` | Download a selected submission's PDF while its form is published. | Public |
| `POST /api/auth/login` | Verify configured admin credentials and issue the session cookie. | Public login route |
| `GET /api/auth/session` | Check the current admin session. | Admin |
| `POST /api/auth/logout` | Clear the current admin session cookie. | Admin |
| `GET /health` | Return service health. | Public |

FastAPI exposes `GET /openapi.json` and Swagger UI at `/docs` when the backend is running.

## Authentication and Security

Admin credentials are configured through environment variables; there are no default credentials. Passwords are verified against a PBKDF2-SHA256 hash. Successful login creates an expiring HMAC-signed session in an HttpOnly, SameSite=Strict cookie. Configure `ADMIN_COOKIE_SECURE=true` when serving over HTTPS. All form-management routes require this session; published public form and submission routes intentionally do not.

CORS permits the configured frontend origin. Database queries use SQLAlchemy ORM. React renders configured labels and participant values as text rather than executing HTML; PDF paragraph text is escaped before ReportLab rendering. Do not place secrets in source control.

## Validation

The frontend provides required-field and type/range/option checks for participant input. The backend repeats validation before storing data: required values, email format, numeric values and min/max, dates, mobile number format, string min/max length, and allowed select/radio/multiselect/checkbox options. Unknown submitted field names are rejected. Inactive and display-only fields do not accept participant values.

## PDF Generation and Timestamps

ReportLab generates PDFs from the selected submission and its saved form snapshot when available. The document contains the form title, submission ID, submission time, field labels, and submitted values, with margins and flowable layout for long content/page breaks. The selected submission ID is used for download; PDF generation does not create a submission.

Database timestamps remain naive UTC values. The frontend formats them in `Asia/Kolkata`; the PDF formatter treats naive values as UTC and displays them at UTC+05:30 in the same date/time style as the admin interface. PDF logo support is not implemented.

## Setup

Requirements: Python 3.11+, Node.js/npm, and MySQL 8+.

Create the database in a MySQL client:

```sql
CREATE DATABASE dynamic_form_builder CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

In PowerShell, install the backend dependencies and copy the example environment file:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
```

On macOS/Linux, activate with `source .venv/bin/activate` instead. Configure the environment variables listed below in `backend/.env`. Generate a password hash from `backend/` with `python -m app.auth`; the command prompts for a password and prints its hash. Generate an independent signing key with `python -c "import secrets; print(secrets.token_urlsafe(48))"`. Store both locally and never paste real values into documentation or commit `.env`.

Apply database migrations from `backend/`:

```powershell
python -m alembic current
python -m alembic upgrade head
```

These are forward migrations and do not reset the database. The current repository head is `b78f2c4a91e`, which adds the nullable submission snapshot.

## Environment Variables

The names below are defined in `backend/.env.example` and `backend/app/database/config.py`. Do not put their real values in this README.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | SQLAlchemy MySQL connection URL. |
| `FRONTEND_URL` | Allowed browser origin for CORS. |
| `BACKEND_HOST` | Backend host setting. |
| `BACKEND_PORT` | Backend port setting. |
| `ADMIN_USERNAME` | Configured admin username. |
| `ADMIN_PASSWORD_HASH` | PBKDF2-SHA256 hash used to verify the admin password. |
| `ADMIN_SECRET_KEY` | Signing key for admin sessions; use at least 32 characters. |
| `ADMIN_SESSION_TTL_SECONDS` | Session lifetime in seconds. |
| `ADMIN_COOKIE_SECURE` | Whether the session cookie is restricted to HTTPS. |
| `VITE_BACKEND_URL` | Optional Vite `/api` proxy target. |
| `VITE_API_BASE_URL` | Optional frontend API base path/URL; defaults to `/api`. |

`backend/.env` and frontend local environment files are ignored by Git. Refer to [backend/.env.example](backend/.env.example) for the variable names and placeholder format.

## Run the Application

Start the backend in one terminal from `backend/`:

```powershell
\.venv\Scripts\Activate.ps1
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Start the frontend in a second terminal from `frontend/`:

```powershell
npm install
npm run dev -- --host 127.0.0.1
```

Open the Vite URL printed in the terminal (default: `http://127.0.0.1:5173`). For a browser calling FastAPI directly, set `FRONTEND_URL` to that browser origin. API documentation is at `http://127.0.0.1:8000/docs`; raw OpenAPI is at `http://127.0.0.1:8000/openapi.json`.

## Tests and Latest Results

Run backend checks from `backend/`:

```powershell
python -m compileall -q app tests alembic
python -m unittest discover -s tests
```

Run frontend checks from `frontend/`:

```powershell
npm run lint
npm run build
```

Latest verified automated results: **10 backend tests passed**, backend compilation passed, frontend lint passed, and the frontend production build passed. The backend suite covers authentication hash/session behavior, submission validation, snapshot compatibility, the form/submission/PDF route-function workflow, and UTC-to-IST PDF timestamp formatting.

The completed functional verification also covered form Preview and Public Form rendering, required/email/age/mobile validation, a submission and admin listing/detail, PDF generation/download for the requested submission without creating another, publish/deactivate/republish behavior, public access being denied for inactive forms, and checkbox label/option rendering. Preview/Public checkbox verification showed one required field label and retained option text. Browser/API checks used a temporary test form and submission; only those test records were removed.

## Screenshots

The workspace includes these UI screenshots:

- [Admin Forms Listing](docs/screenshots/01-admin-forms.png)
- [Form Builder](docs/screenshots/02-form-builder.png)
- [Validation Flow](05-validation.png)

No placeholder screenshots are included.

## Known Limitations

- File fields can be configured/rendered, but file upload, validation, and storage are not implemented; file submissions are not supported.
- Submissions created before the snapshot migration have no original configuration snapshot and use the current form configuration when displayed.
- The application has one environment-configured admin identity; multi-admin roles and password reset are not implemented.
- Rate limiting and PDF logo support are not implemented.
- Deleting a form cascades to its submissions; use deactivation when records must be retained.

## Future Improvements

- Add managed file uploads with size/type validation and controlled storage.
- Add multi-admin accounts, roles, password recovery, and rate limiting.
- Add a supported way to retain original field labels/configuration for legacy submissions where source data is available.
- Add configurable PDF branding/logo support and richer reporting.

## AI Development Assistance

ChatGPT was used as a development assistant for requirement understanding, implementation guidance, debugging, and code review. The application was manually integrated and verified through tests, API checks, database checks, and browser testing.
