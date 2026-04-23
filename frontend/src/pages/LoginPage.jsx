import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { jwtDecode } from 'jwt-decode'
import useAuth from '../hooks/useAuth'

/*
  LoginPage.jsx — The login form component.

  Responsibilities:
  1. Render email + password inputs
  2. Call AuthContext.login() on form submit
  3. Redirect to the correct dashboard based on the user's role
  4. Show a clear error message if login fails

  What this page does NOT do:
  - It does not call the API directly (that's authApi.js + AuthContext)
  - It does not store tokens (that's AuthContext)
  - It does not know which URL to redirect to by default (react-router handles that)

  This clean separation means: if the backend URL changes, LoginPage.jsx
  doesn't need to change. If the redirect logic changes, only this file changes.
*/

export default function LoginPage() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState(null)
  const [loading,  setLoading]  = useState(false)
  /*
    Local state — only relevant to this form:
    - email, password: controlled inputs (the form is the source of truth)
    - error: string message shown below the form on failure, null when hidden
    - loading: disables the button while the API call is in flight
      (prevents double-submits if the user clicks rapidly)
  */

  const { login, user } = useAuth()
  /*
    login() comes from AuthContext — it calls the API, stores tokens, decodes user.
    We destructure user here too, but we actually use the decoded user returned
    from login() via the updated context. See handleSubmit below.
  */

  const navigate = useNavigate()
  /*
    useNavigate() returns a function that programmatically changes the URL.
    navigate('/dashboard') is equivalent to clicking a link to /dashboard,
    but it happens in code based on logic (the user's role).
  */

  async function handleSubmit(e) {
    e.preventDefault()
    /*
      e.preventDefault() stops the browser's default form behaviour,
      which would be a full page reload with the form data in the URL.
      We handle the submit ourselves with fetch/axios instead.
    */

    setLoading(true)
    setError(null)
    // Clear any previous error before each attempt.

    try {
      await login(email, password)
      /*
        login() is async. After it resolves:
        - AuthContext state is updated (user is now the decoded token payload)
        - localStorage has the tokens
        - axiosInstance will attach the token on all future requests

        We don't need to read the return value of login() because AuthContext
        has already updated the shared `user` state. On the next render,
        `user` from useAuth() will be populated.

        But we need the role RIGHT NOW to decide where to navigate.
        Problem: `user` from useAuth() above still has the OLD value (null) during
        this render cycle — React state updates are asynchronous.
        Solution: decode the token from localStorage immediately after login() resolves.
      */

      // Read what AuthContext just stored in localStorage and decode it.
      const stored = localStorage.getItem('authTokens')
      const decoded = jwtDecode(JSON.parse(stored).access)

      // Role-based redirect: send each user type to their own dashboard.
      if (decoded.role === 'coordinator') {
        navigate('/dashboard', { replace: true })
      } else if (decoded.role === 'field_agent') {
        navigate('/agent', { replace: true })
      } else {
        navigate('/', { replace: true })
      }
      /*
        { replace: true } replaces the current history entry instead of pushing a new one.
        This prevents the user from clicking the browser Back button and returning
        to the login page after successfully logging in.
      */

    } catch (err) {
      /*
        Axios wraps HTTP errors in an Error object with a `response` property.
        err.response.data is the JSON body the backend returned, e.g.:
          { "detail": "No active account found with the given credentials" }
          { "detail": "Your account has not been verified yet..." }
        We show whatever message the backend sends, with a generic fallback.
      */
      const message =
        err?.response?.data?.detail ||
        'Login failed. Please check your credentials.'
      setError(message)
    } finally {
      setLoading(false)
      // Always re-enable the button whether the request succeeded or failed.
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>SmartSeason</h1>
        <p style={styles.subtitle}>Field Monitoring System</p>

        <form onSubmit={handleSubmit} style={styles.form}>

          <label style={styles.label} htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={styles.input}
            required
            autoComplete="email"
            /*
              type="email"  → browser validates basic email format before submit
              required      → browser blocks submit if the field is empty
              autoComplete  → browser can prefill from saved credentials
              controlled input: value={email} + onChange keeps React as the
              source of truth for the field value at all times.
            */
          />

          <label style={styles.label} htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={styles.input}
            required
            autoComplete="current-password"
          />

          {error && (
            <p style={styles.error} role="alert">
              {error}
            </p>
            /*
              role="alert" makes screen readers announce this message immediately
              when it appears — accessibility best practice for form errors.
              The {error && ...} pattern renders nothing when error is null.
            */
          )}

          <button
            type="submit"
            disabled={loading}
            style={{ ...styles.button, opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>

        </form>
      </div>
    </div>
  )
}

/*
  Inline styles — intentionally minimal for now.
  In Session 18 we will replace these with a proper CSS solution.
  Keeping styles here (co-located) means the component is self-contained
  and renders correctly without any external stylesheet.
*/
const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f4f8',
    fontFamily: 'sans-serif',
  },
  card: {
    backgroundColor: '#fff',
    padding: '2.5rem',
    borderRadius: '12px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.1)',
    width: '100%',
    maxWidth: '400px',
  },
  title: {
    margin: '0 0 4px',
    fontSize: '1.6rem',
    color: '#1a1a2e',
  },
  subtitle: {
    margin: '0 0 2rem',
    fontSize: '0.9rem',
    color: '#666',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  label: {
    fontWeight: '600',
    fontSize: '0.875rem',
    color: '#333',
  },
  input: {
    padding: '10px 12px',
    border: '1px solid #ccc',
    borderRadius: '6px',
    fontSize: '1rem',
    outline: 'none',
  },
  button: {
    marginTop: '8px',
    padding: '12px',
    backgroundColor: '#2d6a4f',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '1rem',
    fontWeight: '600',
    cursor: 'pointer',
  },
  error: {
    color: '#c0392b',
    backgroundColor: '#fdecea',
    border: '1px solid #f5c6cb',
    borderRadius: '6px',
    padding: '10px 12px',
    fontSize: '0.875rem',
    margin: '0',
  },
}
