import { Navigate } from 'react-router-dom'
import useAuth from '../hooks/useAuth'

/*
  ProtectedRoute.jsx — A route guard component.

  Problem it solves:
  ──────────────────
  Without this, anyone who knows the URL '/dashboard' can type it in the browser
  and see the page even without logging in. The backend would reject their API
  calls with 401, but they would still see the page shell — confusing UX.

  Solution:
  ─────────
  Wrap any private route element in <ProtectedRoute>. If the user is not
  authenticated, they are immediately redirected to /login BEFORE the protected
  component even renders. The protected component never loads for unauthenticated users.

  Optional `requiredRole` prop:
  If provided, the guard also checks that the logged-in user has the right role.
  A field agent who somehow navigates to /dashboard gets redirected to /agent.
  A coordinator who navigates to /agent gets redirected to /dashboard.
  This is defence-in-depth — the backend enforces role permissions too, but
  catching it on the frontend gives a better user experience.

  Usage examples:
    // Any logged-in user can access:
    <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />

    // Coordinators only:
    <Route path="/dashboard" element={
      <ProtectedRoute requiredRole="coordinator"><CoordinatorDashboard /></ProtectedRoute>
    } />

    // Field agents only:
    <Route path="/agent" element={
      <ProtectedRoute requiredRole="field_agent"><AgentDashboard /></ProtectedRoute>
    } />
*/

export default function ProtectedRoute({ children, requiredRole }) {
  const { isAuthenticated, user } = useAuth()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
    /*
      <Navigate> is react-router-dom's declarative redirect component.
      Rendering it causes an immediate navigation to /login.
      replace={true}: replaces the current history entry so the user can't
      click Back to return to the protected page they were redirected from.
    */
  }

  if (requiredRole && user?.role !== requiredRole) {
    /*
      The user is logged in but has the wrong role for this route.
      Send them to their own correct dashboard instead of showing an error.
    */
    const correctPath = user?.role === 'coordinator' ? '/dashboard' : '/agent'
    return <Navigate to={correctPath} replace />
  }

  return children
  /*
    All checks passed: render the protected component normally.
    `children` is whatever was passed as the child of <ProtectedRoute> in App.jsx.
  */
}
