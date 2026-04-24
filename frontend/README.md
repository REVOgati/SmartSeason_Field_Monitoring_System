# SmartSeason Frontend

React 19 + Vite single-page application for the SmartSeason Field Monitoring System.

---

## Tech Stack

| Component | Version |
|---|---|
| React | 19 |
| Vite | 8 |
| React Router DOM | 7 |
| Axios | 1.15 |
| jwt-decode | 4 |
| recharts | 3.8 (installed, charts suspended pending data) |

---

## Project Structure

```
frontend/src/
├── api/                        # All API communication (Axios calls)
│   ├── axiosInstance.js        # Axios base instance with JWT interceptors
│   ├── authApi.js              # register, login, refreshToken, getMe, patchMe
│   ├── fieldsApi.js            # getFields, createField, patchField, deleteField,
│   │                           # getFieldById, getFieldDetail, patchRealizedDates,
│   │                           # getMyAssignedFields
│   ├── agentsApi.js            # getAgentPool, getMyTeam, assignAgent, dropAgent
│   └── reportsApi.js           # getFieldReports, submitReport
│
├── utils/
│   └── fieldStatus.js          # Stage labels, status config, computeFieldStatus()
│
├── context/
│   └── AuthContext.jsx         # Global auth state (user, tokens, login, logout)
│
├── routes/
│   └── ProtectedRoute.jsx      # Guards routes by authentication + role
│
├── components/
│   ├── Navbar.jsx              # Top navigation bar (role-aware)
│   ├── PageLayout.jsx          # Standard page wrapper with consistent padding/max-width
│   ├── StatCard.jsx            # Reusable summary stat tile
│   ├── FormModal.jsx           # Generic modal wrapper for inline forms
│   ├── DateInput.jsx           # Native date input with calendar icon trigger
│   └── sharedStyles.js         # Shared inline style tokens (colours, input, label, etc.)
│
└── pages/
    ├── LoginPage.jsx           # Email + password login form
    ├── RegisterPage.jsx        # Registration form with role selection
    ├── CoordinatorDashboard.jsx        # Coordinator home: field grid + agent panels
    ├── CoordinatorFieldDetailPage.jsx  # Single field: edit details, expected dates,
    │                                   # manage agent, view realized dates + reports
    │                                   # Read-only current stage display
    ├── CoordinatorReportsPage.jsx      # All reports for coordinator's fields (filterable)
    ├── AgentDashboard.jsx              # Agent home: assigned fields + recent reports
    ├── AgentFieldDetailPage.jsx        # Single field: info + stage stepper +
    │                                   # crop timeline + my reports
    └── SubmitReportPage.jsx            # Report submission form for agents
```

---

## Pages & Routes

| Route | Page | Access |
|---|---|---|
| `/login` | LoginPage | Public |
| `/register` | RegisterPage | Public |
| `/coordinator` | CoordinatorDashboard | Coordinator only |
| `/coordinator/reports` | CoordinatorReportsPage | Coordinator only |
| `/coordinator/field/:id` | CoordinatorFieldDetailPage | Coordinator only |
| `/agent` | AgentDashboard | Field Agent only |
| `/agent/submit` | SubmitReportPage | Field Agent only |
| `/agent/field/:id` | AgentFieldDetailPage | Field Agent only |

Route protection is handled by `ProtectedRoute` which reads the decoded JWT from `AuthContext` and redirects unauthenticated users to `/login` and wrong-role users to their own dashboard.

---

## Authentication Flow

1. Login calls `POST /api/auth/login/` → receives `access` and `refresh` tokens.
2. Tokens are stored in `localStorage` and decoded with `jwt-decode` to extract `role`, `email`, `full_name`.
3. `AuthContext` exposes `user` (decoded payload) and `tokens` throughout the app.
4. `axiosInstance` attaches `Authorization: Bearer <access>` to every request automatically via an interceptor.
5. A response interceptor catches 401 errors, calls `POST /api/auth/refresh/` to get a new access token, and retries the original request transparently.
6. On logout, tokens are cleared from `localStorage` and the user is redirected to `/login`.

---

## API Layer

All backend communication lives in `src/api/`. No fetch calls exist outside this folder.

`axiosInstance.js` sets `baseURL` to `http://localhost:8000` and handles:
- Injecting the access token on every request
- Silently refreshing the access token on 401 and retrying
- Redirecting to `/login` if the refresh token is also expired

Each API file groups functions by resource:

```js
// Example — fieldsApi.js
getFields()                          // GET /api/fields/
createField(data)                    // POST /api/fields/
patchField(id, data)                 // PATCH /api/fields/{id}/
deleteField(id)                      // DELETE /api/fields/{id}/
getFieldById(id)                     // GET /api/fields/{id}/           (coordinator)
getFieldDetail(id)                   // GET /api/fields/{id}/agent-detail/  (agent)
patchRealizedDates(id, data)         // PATCH /api/fields/{id}/realized-dates/
                                     // Accepts realized dates AND/OR current_stage
getMyAssignedFields()                // GET /api/fields/my-assigned/
```

---

## Field Stage and Field Status

### `src/utils/fieldStatus.js`
A centralised utility module that owns all stage/status constants and the status computation function. Every page that needs to display a stage label or a status badge imports from here — there is no duplication of these values across the codebase.

**Exports:**

| Export | Type | Purpose |
|---|---|---|
| `STAGE_LABELS` | object | Maps each stage key to its human-readable label |
| `STAGE_REALIZED_DATE_KEY` | object | Maps each stage to the realized date field it records |
| `STATUS_CONFIG` | object | Maps each status key to `{ label, bg, color, border }` for badge rendering |
| `computeFieldStatus(field)` | function | Derives a status string from a field object |

**Stage order and labels:**

| Stage Key | Display Label |
|---|---|
| `not_started` | Not Started |
| `farm_prepped` | Farm Prepped |
| `planted` | Planted |
| `growing` | Growing |
| `ready` | Ready |
| `harvested` | Harvested |

**Status values and badge colours:**

| Status | Background | Text colour | Meaning |
|---|---|---|---|
| `inactive` | Light grey | Grey | Stage is `not_started` |
| `active` | Light green | Dark green | On schedule or no deadline set |
| `at_risk` | Light amber | Deep orange | 1–7 days past the next expected date |
| `danger` | Light red | Dark red | More than 7 days past the next expected date |
| `completed` | Light blue | Dark blue | Stage is `harvested` |

### Page Integration

**`AgentFieldDetailPage.jsx`**
- Imports `STAGE_LABELS`, `STAGE_REALIZED_DATE_KEY`, `STATUS_CONFIG`, `computeFieldStatus`.
- Displays a **6-step visual stepper** showing the field's progress through all stages. Completed steps are filled green with a tick; the current step is highlighted with a border; future steps are grey.
- A `<select>` lets the agent choose the stage to advance to.
- A `DateInput` appears (conditionally, hidden for `not_started`) for the agent to record the realized date of that stage.
- On save, the payload is `{ current_stage, [realizedDateKey]: date }` sent to `PATCH /api/fields/{id}/realized-dates/`. This means advancing the stage and recording its date is a single atomic API call.
- The header badge is replaced by a computed status badge.

**`CoordinatorFieldDetailPage.jsx`**
- Imports `computeFieldStatus`, `STATUS_CONFIG`, `STAGE_LABELS`.
- Header badge replaced with computed status badge.
- Field Details panel displays a read-only **Current Stage** row showing the human-readable stage label.

**`CoordinatorDashboard.jsx`**
- Imports `computeFieldStatus`, `STATUS_CONFIG`.
- Each field card's status badge is replaced by the computed status badge.
- When a field is archived (`is_active = false`), a secondary small **Archived** label is shown below the status badge so the archive state is not lost.

**`AgentDashboard.jsx`**
- Imports `computeFieldStatus`, `STATUS_CONFIG`.
- Field chips in the assigned fields section display the computed status badge instead of the old `is_active`-based badge.

---

## Key Components

### `AuthContext`
Provides `user`, `tokens`, `login(tokens)`, `logout()` to all pages. Reads stored tokens on mount to restore session without requiring re-login.

### `ProtectedRoute`
Wraps any route that requires authentication. Checks `user` from context; if absent, redirects to `/login`. Accepts an optional `allowedRoles` prop to enforce role-based access.

### `DateInput`
A thin wrapper around `<input type="date">` that adds a 📅 button. Clicking the button calls the browser's native `showPicker()` API for full year/month/day navigation without any external date picker library.

### `sharedStyles.js`
A plain JS object exporting common inline style tokens — input, label, form, submit button, modal, etc. — so every page uses consistent typography, colours, and spacing without a CSS framework.

---

## Environment

The API base URL is controlled by the `VITE_API_URL` environment variable:

```js
baseURL: import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api/'
```

- **Local development** — `VITE_API_URL` is not set; the fallback `http://127.0.0.1:8000/api/` is used automatically. No `.env` file needed for local development.
- **Production (Vercel)** — `VITE_API_URL` is set to the Heroku backend URL in Vercel's Environment Variables dashboard.

CORS is configured in the Django backend to allow both `http://localhost:5173` (dev) and the production Vercel URL.

---

## Production Deployment (Vercel)

### Live URL

https://smart-season-field-monitoring-system.vercel.app

### Vercel Configuration

`vercel.json` in the `frontend/` root configures SPA routing so that direct URL access to any route (e.g. `/coordinator/field/3`) does not return a 404:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

Without this, refreshing the browser on any non-root route would return a Vercel 404 because there is no physical file at that path.

### Vercel Environment Variables

| Variable | Value |
|---|---|
| `VITE_API_URL` | `https://smartseason-api-8ebd1870ef49.herokuapp.com/api/` |

Set this in Vercel dashboard → Project → Settings → Environment Variables for all environments (Production, Preview, Development).

### Vercel Project Settings

| Setting | Value |
|---|---|
| Root directory | `frontend` |
| Framework preset | Vite |
| Build command | `npm run build` (auto-detected) |
| Output directory | `dist` (auto-detected) |

Vercel watches the `main` branch on GitHub and redeploys automatically on every `git push origin main`.

### Design Decisions

**No CSS framework — inline styles only**
All styles are written as inline JS objects. This avoids build-time CSS processing, eliminates class name collisions, and keeps component styles co-located with their markup. `sharedStyles.js` exports common tokens (colours, input styles, label styles) so design consistency is maintained without a framework.

**No global state library**
`AuthContext` (React Context + `useReducer`) handles the only piece of truly global state: the authenticated user and tokens. All other state is local to each page component. This keeps the architecture simple and avoids unnecessary re-renders.

**Axios interceptors for transparent token refresh**
Rather than checking token expiry in every component, the response interceptor in `axiosInstance.js` catches 401 responses, refreshes the token silently, and retries the original request. Components are completely unaware that token refresh exists.

**`computeFieldStatus` runs on the frontend**
Field status is computed both in the Django model (`@property`) and mirrored in `src/utils/fieldStatus.js`. The frontend recomputes it from the field data already in memory — no extra API call needed to get the status badge. The backend version ensures the status is also correct when accessed via the API directly.

---

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Start the development server (backend must be running first)
npm run dev
```

The app will be available at `http://localhost:5173`.

```bash
# Production build
npm run build
```

---

## Styling Approach

The entire UI uses inline styles via plain JS objects — no CSS framework, no Tailwind, no CSS modules. This keeps the bundle lean and makes every style decision explicit. Shared tokens are defined once in `sharedStyles.js` and spread into component styles as needed. The colour palette is green-based, reflecting the agricultural domain.

## Vite Plugin

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
