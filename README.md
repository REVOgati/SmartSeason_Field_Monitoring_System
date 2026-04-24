# SmartSeason Field Monitoring System

A web-based platform that helps agricultural coordinators manage their farm fields and track crop progress through a dedicated team of field agents. Coordinators set up fields and assign agents; agents visit those fields, submit monitoring reports, and record real-world crop dates back to the coordinator.

---

## What Problem Does It Solve?

Managing multiple farm fields across different locations is difficult when information is scattered across phone calls, WhatsApp messages, or paper notes. SmartSeason centralises this: every field, every assigned agent, every monitoring report, and the full crop lifecycle timeline lives in one place that both coordinators and agents can access from any browser.

---

## User Roles

There are three types of users in the system:

### Superuser (Technical Administrator)
The system administrator who manages accounts behind the scenes. They have access to the Django Admin panel and are responsible for approving new coordinator and field agent registrations before those users can log in.

This ensures, even if the registration/login url is leaked, only approved accounts can work as coordinators and field agents for the company

### Coordinator (Operational Manager)
A coordinator manages a portfolio of farm fields and leads a team of field agents.

**What a coordinator can do:**
- Create, edit, and deactivate farm fields
- Set expected crop milestone dates for each field (Farm Preparation, Planting, Emergence, Ready for Market, Harvest)
- Browse a pool of approved field agents and add them to their team
- Assign agents from their team to specific fields
- Drop an agent from their team (the agent's historical work is never deleted)
- View all monitoring reports submitted for their fields
- See the actual dates that agents recorded for each crop milestone
- View the current stage and computed health status of each field

### Field Agent (On-the-Ground Monitor)
A field agent is physically present at the assigned farms. They report back regularly on what they are observing.

**What a field agent can do:**
- View the fields they have been assigned to
- Submit periodic monitoring reports (crop health, soil moisture, pest observations, notes, photo)
- Record the actual dates when crop milestones happened (e.g., the date the crop actually emerged)
- Advance the field's stage as each milestone is completed, recording the realized date at the same time

---

## Core Features

### Account Verification
All accounts (both coordinators and field agents) are created in an inactive state. A superuser must approve each account in the admin panel before that person can log in. This prevents unauthorised access.

### Coordinator Isolation
Each coordinator has a completely private view of the system. Coordinator A cannot see Coordinator B's fields, agents, or reports — even if they both use the same system.

### Agent Team Management
Approved field agents start in an unassigned pool visible to all coordinators. A coordinator picks the agents they want and adds them to their own team. From that point on, only that coordinator can assign those agents to fields. An agent belongs to at most one coordinator at a time.

### Crop Timeline Tracking
Every field has a timeline of **five crop phases**: **Farm Preparation → Planting → Emergence → Ready → Harvest**. The coordinator records the dates they expect each phase to happen. The assigned agent records the dates each phase actually happened. Both sets of dates are visible side by side so progress and delays are immediately clear.

### Field Stage Tracking
Every field has a `current_stage` that reflects where it is in its lifecycle. There are six possible stages: **Not Started → Farm Prepped → Planted → Growing → Ready → Harvested**. The field agent advances the stage directly from the field detail page using a visual step-by-step indicator. Advancing a stage and recording its realized date are done in a single action.

### Field Status
Every field automatically receives a computed status based on its current stage and how close it is to its next deadline. This status is displayed as a colour-coded badge throughout the system. See the [Field Status Logic](#field-status-logic) section below for a full explanation.

### Field Monitoring Reports
Field agents submit structured reports for each of their assigned fields. Each report captures:
- Date of the visit
- Crop health rating (Excellent / Good / Fair / Poor)
- Soil moisture percentage
- Whether pests were observed
- Free-text notes
- Optional photo

Coordinators can browse, filter, and review all reports across their fields from a single Reports page.

---

## User Experience Flow

### Coordinator Flow
1. Register an account → wait for superuser approval → log in.
2. Create farm fields with name, location, crop type, and size.
3. Set expected crop milestone dates for each field (Farm Prep through Harvest).
4. Browse the agent pool and add the agents needed to their team.
5. Assign team agents to specific fields.
6. View the field detail page to monitor the current stage, field status, crop timeline progress, and submitted reports.
7. Drop agents who are no longer part of the operation — all their historical reports are preserved.

### Field Agent Flow
1. Register an account → wait for superuser approval → log in.
2. See the fields that have been assigned by their coordinator on the dashboard.
3. Open a field’s detail page to review the expected crop dates set by the coordinator.
4. As each crop milestone is completed, advance the stage and record the realized date.
5. Submit regular monitoring reports capturing observations from the field.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend API | Django 5.2 + Django REST Framework |
| Authentication | JWT (SimpleJWT) — access + refresh token pair |
| Database | PostgreSQL (Supabase in production, local PostgreSQL in development) |
| Image storage | Pillow (local, via Django's media file handling) - Media is not part of MVP but skeleton is included for future versions |
| Frontend | React 19 + Vite 8 |
| Routing | React Router DOM 7 |
| HTTP client | Axios with automatic token refresh |
| Styling | Inline JS styles — no CSS framework |
| Backend hosting | Heroku (Eco dyno) |
| Frontend hosting | Vercel |

---

## How the Frontend and Backend Connect

The frontend (React) and backend (Django) are completely separate applications that communicate over HTTP.

```
Browser (React SPA)
        │
        │  HTTP requests with JWT bearer token
        │  e.g. GET http://localhost:8000/api/fields/
        ▼
Django REST Framework API
        │
        │  PostgreSQL queries
        ▼
PostgreSQL Database
```

1. **Login** — the React app sends the user's credentials to `POST /api/auth/login/`. Django validates them and returns an `access` token and a `refresh` token.
2. **Every subsequent request** — the React app attaches the access token in the `Authorization` header. Django validates the token and returns the requested data.
3. **Token expiry** — when the access token expires, the React app automatically requests a new one using the refresh token, without any interruption to the user.
4. **Role-based routing** — the role field inside the JWT (coordinator or field_agent) tells the React app which dashboard and pages to show. The backend independently enforces the same role rules on every API request, so the frontend and backend permissions are never out of sync.
5. **CORS** — Django is configured to accept requests from `http://localhost:5173` (the Vite dev server) and the production Vercel URL so there are no cross-origin errors in either environment.

---

## Project Structure

```
SmartSeason_Field_Monitoring_System/
├── backend/              # Django project — see backend/README.md
│   ├── config/           # Settings and root URL configuration
│   ├── users/            # User model, auth, roles, team management
│   ├── fields/           # Farm field records, crop timeline, stage, status
│   ├── monitoring/       # Field monitoring reports
│   └── requirements.txt
│
├── frontend/             # React + Vite SPA — see frontend/README.md
│   └── src/
│       ├── api/          # All backend API calls
│       ├── utils/        # fieldStatus.js — stage labels, status config, compute function
│       ├── context/      # Auth state (global)
│       ├── routes/       # Protected route guards
│       ├── components/   # Reusable UI building blocks
│       └── pages/        # Full application pages
│
└── guidefiles/           # Project definition and build schedule reference
```

For detailed technical information:
- Backend setup, models, endpoints, and permissions → [backend/README.md](backend/README.md)
- Frontend setup, routes, components, and API layer → [frontend/README.md](frontend/README.md)

---

## Quick Start (Local Development)

### Prerequisites
- Python 3.11+
- Node.js 18+
- PostgreSQL (local instance)

### Backend
```bash
cd backend
python -m venv myvenv
myvenv\Scripts\activate       # Windows — use source myvenv/bin/activate on Mac/Linux
pip install -r requirements.txt
# Create a .env file — see backend/README.md for required variables
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` in your browser. The backend must be running at `http://localhost:8000`.

---

## Production Deployment

The system is deployed across three services:

| Service | Provider | URL |
|---|---|---|
| Frontend | Vercel | https://smart-season-field-monitoring-system.vercel.app |
| Backend API | Heroku (Eco dyno) | https://smartseason-api-8ebd1870ef49.herokuapp.com/api/ |
| Django Admin | Heroku | https://smartseason-api-8ebd1870ef49.herokuapp.com/admin/ |
| Database | Supabase (PostgreSQL) | Supabase project dashboard |

### Architecture

```
Browser (Vercel — React SPA)
        │
        │  HTTPS requests with JWT bearer token
        │  VITE_API_URL = https://smartseason-api-8ebd1870ef49.herokuapp.com/api/
        ▼
Heroku Eco Dyno (Gunicorn + Django)
        │
        │  SSL connection (port 5432, session pooler)
        ▼
Supabase PostgreSQL
```

### Design Decisions

**Monorepo with git subtree for Heroku**
The repository keeps `backend/` and `frontend/` together in one GitHub repo. Heroku requires the app to be at the repository root, so a `git subtree push --prefix backend heroku main` is used to push only the `backend/` folder to Heroku on each deploy. This keeps the codebase in one place without needing a separate repo.

**Supabase Session Pooler instead of Direct Connection**
Heroku Eco dynos use IPv4 for outbound connections. Supabase's direct database connection resolves to an IPv6 address, which Heroku cannot reach. The Supabase **session-mode pooler** (`aws-0-eu-west-1.pooler.supabase.com:5432`) resolves to IPv4 and is fully compatible with Django's connection behaviour (persistent connections, SET statements, prepared statements).

**WhiteNoise for static files**
Django's built-in static file serving is disabled in production. WhiteNoise serves compressed static files (gzip + brotli) directly from the `staticfiles/` directory built by `collectstatic`. This avoids the need for a separate CDN or S3 bucket for admin panel assets.

**Idempotent superuser via `ensure_superuser` management command**
The Procfile `release` phase runs `python manage.py migrate && python manage.py ensure_superuser` on every deploy. `ensure_superuser` creates the admin account from environment variables only if no superuser exists yet — safe to run repeatedly, no duplicates created.

**Environment variable isolation**
All secrets (secret key, database password, superuser credentials) are stored only in Heroku Config Vars and the local `.env` file. The `.env` file is in `.gitignore` and never committed. `settings.py` contains no hardcoded secrets.

### Deploying Code Changes

After committing your changes:

```bash
git push origin main                           # updates GitHub + triggers Vercel redeploy
git subtree push --prefix backend heroku main  # deploys backend/ to Heroku
```

Vercel watches the `frontend/` folder on the `main` branch and redeploys automatically on every push to GitHub.

### Heroku Environment Variables

| Variable | Purpose |
|---|---|
| `SECRET_KEY` | Django secret key |
| `DEBUG` | `False` in production |
| `DATABASE_URL` | Supabase session pooler connection string |
| `FRONTEND_URL` | Vercel frontend URL (for CORS) |
| `HEROKU_APP_NAME` | App name (optional, kept for reference) |
| `DJANGO_SUPERUSER_EMAIL` | Admin account email |
| `DJANGO_SUPERUSER_PASSWORD` | Admin account password |
| `DJANGO_SUPERUSER_FULLNAME` | Admin display name |

### Assumptions

- **One coordinator per agent** — a field agent belongs to at most one coordinator at a time. This keeps the data model simple and access rules unambiguous. If multi-coordinator support is ever needed, the `coordinator` FK on `User` would need to become a many-to-many.
- **Verification is manual** — account approval is done by the superuser through Django Admin. There is no self-service email verification flow. This is intentional for a controlled agricultural operations environment where all staff are known in advance.
- **No file storage service** — uploaded report photos are stored on the local filesystem via Django's `MEDIA_ROOT`. In production on Heroku, the dyno filesystem is ephemeral and photos will be lost on restart. For a future production-grade setup, media uploads should be moved to an object storage service such as AWS S3 or Cloudinary.
- **Eco dyno sleeping** — Heroku Eco dynos sleep after 30 minutes of inactivity. The first request after sleep takes a few seconds while the dyno wakes up. This is acceptable for a monitoring system that is not expected to have 24/7 continuous traffic.

---

## Development Status

All planned features from the project definition are complete:

| Feature | Status |
|---|---|
| Custom user model with roles and verification | ✅ |
| JWT authentication (login, refresh, profile) | ✅ |
| Coordinator isolation (private field/agent/report views) | ✅ |
| Agent pool and team management | ✅ |
| Farm field CRUD | ✅ |
| Crop timeline (expected + realized dates, 5 phases) | ✅ |
| Field stage tracking (6 stages, agent-advanced) | ✅ |
| Field status (computed from stage + schedule) | ✅ |
| Field monitoring report submission | ✅ |
| Coordinator reports view with filtering | ✅ |
| Coordinator field detail page | ✅ |
| Agent field detail page | ✅ |
| Role-based route protection | ✅ |
| Django Admin with full management UI | ✅ |

---

## Field Status Logic

Every field in SmartSeason has a **status** that is computed automatically — it is never entered manually and never stored in the database. Instead, it is recalculated on every request based on two pieces of data already on the field: the **current stage** and the **next expected date** for that stage.

The goal is to give coordinators and agents an at-a-glance signal about whether a field is progressing on schedule or falling behind.

### The Five Statuses

| Status | Badge Colour | Meaning |
|---|---|---|
| **Inactive** | Grey | The field has not been started yet — no work has begun |
| **Active** | Green | Work is in progress and the next milestone is on schedule |
| **At Risk** | Amber | The next milestone deadline has passed by 1 to 7 days |
| **Danger** | Red | The next milestone deadline has passed by more than 7 days |
| **Completed** | Blue | The field has been fully harvested |

### How It Is Computed

The logic works in three steps:

**Step 1 — Check the stage endpoints.**
If the stage is `not_started`, the field has not been touched yet — status is `inactive`.
If the stage is `harvested`, the full cycle is done — status is `completed`.

**Step 2 — Look up the next deadline.**
For every active stage, there is a "next" expected date that acts as the upcoming deadline:

| Current Stage | Next Deadline Being Watched |
|---|---|
| Farm Prepped | Expected Planting Date |
| Planted | Expected Emergence Date |
| Growing | Expected Ready Date |
| Ready | Expected Harvest Date |

If the coordinator has not set that expected date yet, there is no deadline to be late against — status defaults to `active`.

**Step 3 — Compare today against the deadline.**
```
diff = today − next expected date  (in days)

diff ≤ 0  →  on schedule or future  →  active
diff 1–7  →  slightly overdue       →  at_risk
diff > 7  →  significantly overdue  →  danger
```

### Why This Approach

- **No extra storage** — the status is derived, not persisted. It is always fresh and impossible to go stale.
- **Role separation** — only agents can change the stage; only coordinators can change expected dates. The status is the product of both roles' inputs combined.
- **Single source of truth** — the computation function lives in one place (`backend/fields/models.py` as a `@property` and mirrored in `frontend/src/utils/fieldStatus.js`). Every page that shows a badge calls the same function.
- **Graceful defaults** — missing dates never cause errors; the logic defaults to `active` so a field with no deadlines set is never shown as at risk.
