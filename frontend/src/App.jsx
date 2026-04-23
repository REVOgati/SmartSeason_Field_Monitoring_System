import { Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import ProtectedRoute from './routes/ProtectedRoute'
import CoordinatorDashboard from './pages/CoordinatorDashboard'

/*
  App.jsx — Root route tree.

  All page-level <Route> entries live here. App.jsx's only responsibility
  is declaring which component renders at which URL path. No logic, no state.

  Current routes (Session 16):
    /             → redirects to /login
    /login        → LoginPage (public)
    /dashboard    → CoordinatorDashboard (protected, coordinator only) ✅ Session 16
    /agent        → AgentDashboard (protected, field_agent only) — placeholder, Session 17
    *             → 404 fallback

  Why <Routes> here and <BrowserRouter> in main.jsx?
  BrowserRouter supplies the URL context (window.location).
  Routes reads that context and matches the current URL to its children.
  They are intentionally separate — context provider vs. consumer.
*/

// Placeholder — full AgentDashboard page built in Session 17
function AgentDashboard() {
  return <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}><h2>Agent Dashboard</h2><p>Coming in Session 17.</p></div>
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      {/* Redirect root to /login. Once logged in, LoginPage redirects to the
          correct dashboard, so authenticated users effectively skip /login. */}

      <Route path="/login" element={<LoginPage />} />
      {/* Public route — no ProtectedRoute wrapper needed. */}

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute requiredRole="coordinator">
            <CoordinatorDashboard />
          </ProtectedRoute>
        }
      />
      {/* Coordinator-only. ProtectedRoute redirects agents to /agent
          and unauthenticated users to /login. */}

      <Route
        path="/agent"
        element={
          <ProtectedRoute requiredRole="field_agent">
            <AgentDashboard />
          </ProtectedRoute>
        }
      />
      {/* Field-agent-only. Mirrors the coordinator pattern above. */}

      <Route
        path="*"
        element={
          <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
            <h2>404 — Page not found</h2>
            <a href="/login">Go to login</a>
          </div>
        }
      />
    </Routes>
  )
}
