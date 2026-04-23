import { Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ProtectedRoute from './routes/ProtectedRoute'
import CoordinatorDashboard from './pages/CoordinatorDashboard'
import AgentDashboard from './pages/AgentDashboard'
import SubmitReportPage from './pages/SubmitReportPage'

/*
  App.jsx — Root route tree.

  All page-level <Route> entries live here. App.jsx's only responsibility
  is declaring which component renders at which URL path. No logic, no state.

  Routes:
    /             -> redirects to /login
    /login        -> LoginPage (public)
    /register     -> RegisterPage (public)
    /dashboard    -> CoordinatorDashboard (protected, coordinator only)
    /agent        -> AgentDashboard (protected, field_agent only)
    /agent/submit -> SubmitReportPage (protected, field_agent only)
*/

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      {/* Redirect root to /login. Once logged in, LoginPage redirects to the
          correct dashboard, so authenticated users effectively skip /login. */}

      <Route path="/login" element={<LoginPage />} />
      {/* Public route — no ProtectedRoute wrapper needed. */}

      <Route path="/register" element={<RegisterPage />} />
      {/* Public route — new users register here. Account starts unverified;
          admin must approve before the user can log in. */}

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
        path="/agent/submit"
        element={
          <ProtectedRoute requiredRole="field_agent">
            <SubmitReportPage />
          </ProtectedRoute>
        }
      />
      {/* Nested under /agent/ to signal this is an agent-only page. */}

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
