# SmartSeason Backend

Django 5.2 + Django REST Framework API powering the SmartSeason Field Monitoring System.

---

## Tech Stack

| Component | Version |
|---|---|
| Python | 3.11 |
| Django | 5.2 |
| Django REST Framework | 3.17 |
| SimpleJWT | 5.5 |
| django-cors-headers | 4.9 |
| django-filter | 25.2 |
| PostgreSQL | via psycopg2-binary |
| Pillow | 12.2 (image uploads) |
| python-decouple | 3.8 (env config) |
| gunicorn | 25.3 (production WSGI server) |
| whitenoise | 6.12 (static file serving) |
| dj-database-url | 3.1.2 (DATABASE_URL parsing) |

---

## Project Structure

```
backend/
├── config/               # Project settings, root URL table, WSGI/ASGI
│   ├── settings.py
│   └── urls.py
├── users/                # Custom user model, auth, roles, team management
│   ├── models.py         # User model with role + coordinator FK
│   ├── serializers.py    # Register, Login, Profile, PublicUser serializers
│   ├── views.py          # RegisterView, LoginView, MeView, AgentPool, Assign, Drop
│   ├── permissions.py    # IsCoordinator, IsFieldAgent, IsFieldOwner
│   ├── signals.py        # Auto set is_active=True when is_verified=True
│   ├── urls.py           # /api/auth/ routes
│   ├── agent_urls.py     # /api/agents/ routes
│   └── management/
│       └── commands/
│           └── ensure_superuser.py  # Idempotent superuser creation for Heroku release phase
├── fields/               # Farm field records and crop timeline
│   ├── models.py         # Field model with 10 crop timeline date fields,
│   │                     # current_stage CharField, and field_status property
│   ├── serializers.py    # FieldSerializer + AgentRealizedDatesSerializer
│   ├── views.py          # FieldViewSet with agent-detail and realized-dates actions
│   └── urls.py
├── monitoring/           # Field monitoring reports submitted by agents
│   ├── models.py         # FieldReport model
│   ├── serializers.py
│   ├── views.py          # FieldReportViewSet (scoped to user role)
│   └── urls.py
├── Procfile              # Heroku process declarations (release + web)
├── runtime.txt           # Pins Python 3.11 for Heroku (deprecated, use .python-version)
├── manage.py
├── requirements.txt
└── .env                  # Not committed — see Environment Variables section
```

---

## Apps

### `users`
Handles all user identity, authentication, and team management.

- **Custom User model** — email-based login, role field (`coordinator` / `field_agent`), `is_verified` flag, `coordinator` FK for team grouping, profile photo.
- **Verification** — accounts are created inactive (`is_active=False`, `is_verified=False`). A superuser approves them in Django Admin; a signal auto-activates the account on approval.
- **Managers** — `User.verified`, `User.coordinators`, `User.field_agents`, `User.field_agents.for_coordinator(coord)`.
- **JWT auth** — login returns access + refresh tokens with role, email, and full\_name embedded in the payload.
- **Team management** — coordinators pick agents from an unassigned pool; dropping an agent returns them to the pool and clears their field assignments while preserving all historical reports.

### `fields`
Manages farm field records.

- Full CRUD restricted to coordinators; each coordinator sees only their own fields.
- Object-level permission (`IsFieldOwner`) prevents direct URL access to another coordinator's fields.

#### Crop Timeline — Date Fields
The `Field` model carries **10 `DateField` columns** tracking five crop lifecycle phases. Each phase has an expected date (set by the coordinator) and a realized date (recorded by the assigned agent):

| Phase | Expected Date Field | Realized Date Field |
|---|---|---|
| Farm Preparation | `expected_farm_prep_date` | `realized_farm_prep_date` |
| Planting | `expected_planting_date` | `realized_planting_date` |
| Emergence (Growth Visibility) | `expected_emergence_date` | `realized_emergence_date` |
| Ready for Market | `expected_ready_date` | `realized_ready_date` |
| Harvest | `expected_harvest_date` | `realized_harvest_date` |

All date fields are `null=True, blank=True, default=None` so that they can be filled in incrementally over the field's lifecycle.

#### Field Stage — `current_stage`
The `Field` model has a `current_stage` `CharField` that tracks which lifecycle stage the field is currently at. It uses the following fixed choices:

```python
STAGE_CHOICES = [
    ('not_started', 'Not Started'),
    ('farm_prepped', 'Farm Prepped'),
    ('planted',     'Planted'),
    ('growing',     'Growing'),
    ('ready',       'Ready'),
    ('harvested',   'Harvested'),
]
```

- **Default** is `not_started`.
- **Advanced by the field agent** via the `PATCH /api/fields/{id}/realized-dates/` endpoint — agents include `current_stage` in the same payload as realized date fields.
- **Read-only for coordinators** — `current_stage` is in `FieldSerializer.read_only_fields`; coordinators observe it but cannot overwrite it.

#### Field Status — `field_status` property
`field_status` is a computed `@property` on the `Field` model — it is never stored in the database. It is recalculated on every read and exposed by `FieldSerializer` as a `SerializerMethodField`.

The property returns one of five string values: `inactive`, `active`, `at_risk`, `danger`, `completed`.

Computation logic:
1. If `current_stage == 'not_started'` → `inactive`
2. If `current_stage == 'harvested'` → `completed`
3. Otherwise, look up the **next expected date** for the current stage:
   - `farm_prepped` → checks `expected_planting_date`
   - `planted` → checks `expected_emergence_date`
   - `growing` → checks `expected_ready_date`
   - `ready` → checks `expected_harvest_date`
4. If that expected date is not set → `active`
5. Calculate `diff = today − expected_date` in days:
   - `diff > 7` → `danger`
   - `diff >= 1` → `at_risk`
   - `diff <= 0` (on schedule or future) → `active`

#### Serializer Changes
- **`FieldSerializer`** — adds `field_status = SerializerMethodField()` and exposes both `current_stage` and `field_status` in `Meta.fields`. Both are listed in `read_only_fields` so coordinators cannot alter them through the main PATCH endpoint.
- **`AgentRealizedDatesSerializer`** — adds `current_stage` as a writable field, allowing agents to advance the stage in the same request as recording a realized date.

Custom actions:
- `GET /api/fields/{id}/agent-detail/` — agent-scoped field view (403 if not assigned)
- `PATCH /api/fields/{id}/realized-dates/` — agent updates realized dates **and/or** advances `current_stage`

### `monitoring`
Stores periodic field reports submitted by agents.

- `FieldReport` model: field FK, agent FK, report\_date, crop\_health, soil\_moisture, pest\_observed, notes, photo.
- Agents see only their own reports; coordinators see all reports for their fields.
- Supports filtering (`?field=`, `?crop_health=`, `?pest_observed=`) and ordering (`?ordering=-submitted_at`).

---

## API Endpoints

### Auth — `/api/auth/`

| Method | URL | Description | Auth |
|---|---|---|---|
| POST | `/api/auth/register/` | Create account (inactive by default) | Public |
| POST | `/api/auth/login/` | Returns access + refresh JWT tokens | Public |
| POST | `/api/auth/refresh/` | Exchange refresh token for a new access token | Public |
| GET | `/api/auth/me/` | Read own profile | Bearer token |
| PATCH | `/api/auth/me/` | Update own profile | Bearer token |

### Agent Team — `/api/agents/`

| Method | URL | Description | Auth |
|---|---|---|---|
| GET | `/api/agents/pool/` | List all unassigned verified agents | Coordinator |
| GET | `/api/agents/my-team/` | List agents on the coordinator's team | Coordinator |
| POST | `/api/agents/{id}/assign/` | Add agent to team | Coordinator |
| POST | `/api/agents/{id}/drop/` | Release agent back to pool | Coordinator |

### Fields — `/api/fields/`

| Method | URL | Description | Auth |
|---|---|---|---|
| GET | `/api/fields/` | List coordinator's fields | Coordinator |
| POST | `/api/fields/` | Create a field | Coordinator |
| GET | `/api/fields/{id}/` | Field detail | Coordinator |
| PATCH | `/api/fields/{id}/` | Update field info / expected dates | Coordinator |
| DELETE | `/api/fields/{id}/` | Delete field | Coordinator |
| GET | `/api/fields/my-assigned/` | Agent's assigned fields | Field Agent |
| GET | `/api/fields/{id}/agent-detail/` | Full field detail for assigned agent | Field Agent |
| PATCH | `/api/fields/{id}/realized-dates/` | Save realized crop dates and/or advance stage | Field Agent |

### Reports — `/api/reports/`

| Method | URL | Description | Auth |
|---|---|---|---|
| GET | `/api/reports/` | List reports (scoped to role) | Coordinator / Field Agent |
| POST | `/api/reports/` | Submit a field report | Field Agent |
| GET | `/api/reports/{id}/` | Single report | Coordinator / Field Agent |

---

## Permissions

| Class | Applied To | Rule |
|---|---|---|
| `IsCoordinator` | FieldViewSet, agent endpoints | `role == 'coordinator'` |
| `IsFieldAgent` | `my-assigned`, `agent-detail`, `realized-dates`, submit report | `role == 'field_agent'` |
| `IsFieldOwner` | `retrieve`, `update`, `destroy` on FieldViewSet | `field.coordinator == request.user` |

---

## Environment Variables

Create a `.env` file in the `backend/` directory:

```
SECRET_KEY=your-django-secret-key
DEBUG=True
DB_NAME=smartseason_db
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_HOST=localhost
DB_PORT=5432
```

---

## Setup

```bash
# 1. Create and activate virtual environment
python -m venv myvenv
myvenv\Scripts\activate        # Windows
source myvenv/bin/activate     # Mac/Linux

# 2. Install dependencies
pip install -r requirements.txt

# 3. Create your .env file (see above)

# 4. Create the PostgreSQL database
# (psql or pgAdmin — create a database matching DB_NAME in your .env)

# 5. Run migrations
python manage.py migrate

# 6. Create a superuser (the only way to approve accounts)
python manage.py createsuperuser

# 7. Start the development server
python manage.py runserver
```

The API will be available at `http://localhost:8000`.
Django Admin is at `http://localhost:8000/admin/`.

---

## Account Approval Flow

1. User registers via `POST /api/auth/register/` — account is created inactive.
2. Superuser opens Django Admin → Users → finds the pending account.
3. Superuser sets `is_verified = True` — a signal automatically sets `is_active = True`.
4. User can now log in via `POST /api/auth/login/`.

---

## Data Isolation

- Coordinator A **cannot** see Coordinator B's fields — `get_queryset()` filters by `coordinator=request.user` on every request.
- An agent's `agent-detail` endpoint returns 403 if the requesting agent is not the assigned agent for that field.
- Reports are scoped at query level: agents see only their own submissions; coordinators see only reports for their own fields.

---

## Production Deployment (Heroku + Supabase)

### Infrastructure

| Service | Provider | URL |
|---|---|---|
| Backend API | Heroku Eco dyno | https://smartseason-api-8ebd1870ef49.herokuapp.com/ |
| Database | Supabase PostgreSQL | Session pooler: `aws-0-eu-west-1.pooler.supabase.com:5432` |

### Procfile

The `Procfile` in `backend/` declares two process types:

```
release: python manage.py migrate && python manage.py ensure_superuser
web: gunicorn config.wsgi:application --bind 0.0.0.0:$PORT --workers 2
```

- **`release`** runs after every build, before traffic is served. It applies pending migrations and creates the superuser if none exists yet.
- **`web`** starts the Gunicorn WSGI server on the port Heroku assigns.

### `ensure_superuser` Management Command

Located at `users/management/commands/ensure_superuser.py`. Creates a superuser from environment variables only if no superuser exists yet. Safe to run on every deploy — it exits immediately if a superuser already exists.

Required environment variables for this command:
```
DJANGO_SUPERUSER_EMAIL
DJANGO_SUPERUSER_PASSWORD
DJANGO_SUPERUSER_FULLNAME
```

### Heroku Config Vars (full list)

| Variable | Description |
|---|---|
| `SECRET_KEY` | Django secret key (do not use the `django-insecure-` default) |
| `DEBUG` | `False` |
| `DATABASE_URL` | Supabase session pooler URI with `?sslmode=require` |
| `FRONTEND_URL` | Vercel frontend URL (added to `CORS_ALLOWED_ORIGINS`) |
| `HEROKU_APP_NAME` | Heroku app name (optional reference) |
| `DJANGO_SUPERUSER_EMAIL` | Admin login email |
| `DJANGO_SUPERUSER_PASSWORD` | Admin login password |
| `DJANGO_SUPERUSER_FULLNAME` | Admin display name |

### DATABASE_URL Format

Use the Supabase **session-mode pooler** URI (not the direct connection). Heroku Eco dynos connect via IPv4 only; the direct Supabase host resolves to IPv6 and is unreachable.

```
postgresql://postgres.<project-ref>:<password>@aws-0-eu-west-1.pooler.supabase.com:5432/postgres?sslmode=require
```

If the password contains special characters (e.g. `@`), URL-encode them: `@` → `%40`.

### Static Files

WhiteNoise serves compressed static files from `staticfiles/` (built by `collectstatic` during the Heroku build). No CDN or S3 is needed for admin panel assets.

### Deploying Code Changes

Because this is a monorepo (`backend/` and `frontend/` share one GitHub repo), `git push` alone does not update Heroku. Use git subtree to push only the `backend/` directory:

```bash
git push origin main                           # update GitHub
git subtree push --prefix backend heroku main  # deploy to Heroku
```

To set up the Heroku remote on a new machine:
```bash
heroku git:remote -a smartseason-api
```
