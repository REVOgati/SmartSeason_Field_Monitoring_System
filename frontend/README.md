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
    ├── CoordinatorReportsPage.jsx      # All reports for coordinator's fields (filterable)
    ├── AgentDashboard.jsx              # Agent home: assigned fields + recent reports
    ├── AgentFieldDetailPage.jsx        # Single field: info + crop timeline + my reports
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
getMyAssignedFields()                // GET /api/fields/my-assigned/
```

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

The API base URL is set in `axiosInstance.js`. For local development the backend runs on `http://localhost:8000` (Django dev server) and the frontend on `http://localhost:5173` (Vite dev server). CORS is configured in the backend to allow this origin.

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
