import { Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ProtectedRoute from './routes/ProtectedRoute'
import CoordinatorDashboard from './pages/CoordinatorDashboard'
import CoordinatorReportsPage from './pages/CoordinatorReportsPage'
import CoordinatorFieldDetailPage from './pages/CoordinatorFieldDetailPage'
import AgentDashboard from './pages/AgentDashboard'
import AgentFieldDetailPage from './pages/AgentFieldDetailPage'
import SubmitReportPage from './pages/SubmitReportPage'

/*
  App.jsx — Root route tree.

  Routes:
    /                     -> redirects to /login
    /login                -> LoginPage (public)
    /register             -> RegisterPage (public)
    /coordinator          -> CoordinatorDashboard (protected, coordinator only)
    /coordinator/reports  -> CoordinatorReportsPage (protected, coordinator only)
    /agent                -> AgentDashboard (protected, field_agent only)
    /agent/submit         -> SubmitReportPage (protected, field_agent only)
*/

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />

      <Route path="/login"    element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route
        path="/coordinator"
        element={
          <ProtectedRoute requiredRole="coordinator">
            <CoordinatorDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/coordinator/reports"
        element={
          <ProtectedRoute requiredRole="coordinator">
            <CoordinatorReportsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/coordinator/field/:id"
        element={
          <ProtectedRoute requiredRole="coordinator">
            <CoordinatorFieldDetailPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/agent"
        element={
          <ProtectedRoute requiredRole="field_agent">
            <AgentDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/agent/submit"
        element={
          <ProtectedRoute requiredRole="field_agent">
            <SubmitReportPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/agent/field/:id"
        element={
          <ProtectedRoute requiredRole="field_agent">
            <AgentFieldDetailPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/dashboard"
        element={<Navigate to="/coordinator" replace />}
      />
      {/* Legacy redirect: old /dashboard → /coordinator */}

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
