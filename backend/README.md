# SmartSeason Backend

Django 5.2 + Django REST Framework API powering the SmartSeason Field Monitoring System.

---

## Tech Stack

| Component | Version |
|---|---|
| Python | 3.x |
| Django | 5.2 |
| Django REST Framework | 3.17 |
| SimpleJWT | 5.5 |
| django-cors-headers | 4.9 |
| django-filter | 25.2 |
| PostgreSQL | via psycopg2-binary |
| Pillow | 12.2 (image uploads) |
| python-decouple | 3.8 (env config) |

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
│   └── agent_urls.py     # /api/agents/ routes
├── fields/               # Farm field records and crop timeline
│   ├── models.py         # Field model with 8 crop timeline date fields
│   ├── serializers.py    # FieldSerializer + AgentRealizedDatesSerializer
│   ├── views.py          # FieldViewSet with agent-detail and realized-dates actions
│   └── urls.py
├── monitoring/           # Field monitoring reports submitted by agents
│   ├── models.py         # FieldReport model
│   ├── serializers.py
│   ├── views.py          # FieldReportViewSet (scoped to user role)
│   └── urls.py
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
- **Crop timeline** — 8 `DateField` columns on the Field model tracking four phases (Planting, Emergence, Ready, Harvest) with an expected date (set by coordinator) and a realized date (set by the assigned agent).
- Custom actions:
  - `GET /api/fields/{id}/agent-detail/` — agent-scoped field view (403 if not assigned)
  - `PATCH /api/fields/{id}/realized-dates/` — agent updates their four realized dates

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
| PATCH | `/api/fields/{id}/realized-dates/` | Save realized crop dates | Field Agent |

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
