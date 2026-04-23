import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { registerUser } from '../api/authApi'

/*
  RegisterPage.jsx — Account registration form.

  Who uses this page:
  - A new coordinator who needs to create an account to manage fields.
  - A new field agent who needs an account to submit reports.

  What it does:
  1. Collects: email, full name, role (dropdown), password, confirm password
  2. POSTs to /api/auth/register/ via registerUser()
  3. On success: shows a "pending verification" confirmation (no redirect to dashboard —
     the backend creates the account with is_verified=False, so login would fail)
  4. On error: flattens DRF validation errors into a red banner

  Why no AuthContext here?
  Registration is not the same as login. registerUser() does NOT return tokens —
  it just creates the account. The user still needs a superuser to verify them
  before they can log in. So we never touch AuthContext during registration.

  Styling: green/white palette via inline styles (same design tokens as LoginPage).
*/

const EMPTY_FORM = { email: '', full_name: '', role: 'field_agent', password: '', password2: '' }

export default function RegisterPage() {
  const [form,    setForm]    = useState(EMPTY_FORM)
  const [error,   setError]   = useState(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const navigate = useNavigate()

  function handleChange(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
    /*
      Controlled inputs: every keypress updates the matching field in `form`.
      The `name` attribute on each <input>/<select> must match a key in EMPTY_FORM.
    */
  }

  async function handleSubmit(e) {
    e.preventDefault()

    // Client-side password match check before hitting the network.
    if (form.password !== form.password2) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      await registerUser(form)
      /*
        registerUser() POSTs to /api/auth/register/.
        On success (201) it returns { "message": "..." } — we don't need the value.
        We just flip the success flag and show the confirmation banner instead.
      */
      setSuccess(true)

    } catch (err) {
      /*
        DRF validation errors look like:
          { "email": ["user with this email already exists."] }
          { "password2": ["Passwords do not match."] }
          { "role": ["\"superuser\" is not a valid choice."] }
        We flatten them into one readable string.
      */
      const body = err?.response?.data
      const msg  = typeof body === 'string'
        ? body
        : Object.values(body || {}).flat().join(' ') || 'Registration failed. Please try again.'
      setError(msg)

    } finally {
      setLoading(false)
    }
  }

  // ── Success state — shown instead of the form after a successful registration ──
  if (success) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.logoMark}>🌿</div>
          <h1 style={styles.title}>SmartSeason</h1>

          <div style={styles.successBox}>
            <p style={styles.successTitle}>Account created!</p>
            <p style={styles.successMsg}>
              Your account is pending verification by an administrator.
              You will be able to log in once your account has been approved.
            </p>
          </div>

          <p style={styles.loginPrompt}>
            Already verified?{' '}
            <Link to="/login" style={styles.link}>Sign in here</Link>
          </p>
        </div>
      </div>
    )
  }

  // ── Registration form ──────────────────────────────────────────────────────
  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logoMark}>🌿</div>
        <h1 style={styles.title}>SmartSeason</h1>
        <p style={styles.subtitle}>Create your account</p>

        {error && (
          <div style={styles.error} role="alert">{error}</div>
        )}

        <form onSubmit={handleSubmit} style={styles.form}>

          <label style={styles.label} htmlFor="email">Email *</label>
          <input
            id="email"
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            style={styles.input}
            required
            autoComplete="email"
            placeholder="you@example.com"
          />

          <label style={styles.label} htmlFor="full_name">Full Name *</label>
          <input
            id="full_name"
            name="full_name"
            type="text"
            value={form.full_name}
            onChange={handleChange}
            style={styles.input}
            required
            placeholder="Jane Njeri"
          />

          <label style={styles.label} htmlFor="role">Role *</label>
          <select
            id="role"
            name="role"
            value={form.role}
            onChange={handleChange}
            style={styles.select}
          >
            <option value="field_agent">Field Agent</option>
            <option value="coordinator">Coordinator</option>
          </select>
          {/*
            Two options only — "superuser" is blocked at the backend.
            Default is "field_agent" because agents will register more often
            than coordinators (many agents per coordinator in most scenarios).
          */}

          <label style={styles.label} htmlFor="password">Password *</label>
          <input
            id="password"
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            style={styles.input}
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="Minimum 8 characters"
          />

          <label style={styles.label} htmlFor="password2">Confirm Password *</label>
          <input
            id="password2"
            name="password2"
            type="password"
            value={form.password2}
            onChange={handleChange}
            style={styles.input}
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="Repeat your password"
          />

          <button
            type="submit"
            disabled={loading}
            style={{ ...styles.button, opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'Creating account…' : 'Create Account'}
          </button>

        </form>

        <p style={styles.loginPrompt}>
          Already have an account?{' '}
          <Link to="/login" style={styles.link}>Sign in</Link>
        </p>

      </div>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F5E9',
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    padding: '2rem 1rem',
    boxSizing: 'border-box',
  },
  card: {
    backgroundColor: '#FFFFFF',
    padding: '2.5rem',
    borderRadius: '14px',
    boxShadow: '0 6px 32px rgba(27, 94, 32, 0.14)',
    width: '100%',
    maxWidth: '440px',
  },
  logoMark: {
    textAlign: 'center',
    fontSize: '2.2rem',
    marginBottom: '0.25rem',
  },
  title: {
    margin: '0 0 4px',
    fontSize: '1.7rem',
    fontWeight: '800',
    color: '#1B5E20',
    textAlign: 'center',
  },
  subtitle: {
    margin: '0 0 1.5rem',
    fontSize: '0.875rem',
    color: '#4A6741',
    textAlign: 'center',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  label: {
    fontWeight: '600',
    fontSize: '0.85rem',
    color: '#2E7D32',
    marginTop: '0.2rem',
  },
  input: {
    padding: '10px 12px',
    border: '1.5px solid #C8E6C9',
    borderRadius: '8px',
    fontSize: '0.95rem',
    outline: 'none',
    backgroundColor: '#F9FBF9',
    color: '#1B2E1B',
    width: '100%',
    boxSizing: 'border-box',
  },
  select: {
    padding: '10px 12px',
    border: '1.5px solid #C8E6C9',
    borderRadius: '8px',
    fontSize: '0.95rem',
    outline: 'none',
    backgroundColor: '#F9FBF9',
    color: '#1B2E1B',
    width: '100%',
    boxSizing: 'border-box',
    cursor: 'pointer',
  },
  button: {
    marginTop: '10px',
    padding: '12px',
    backgroundColor: '#2E7D32',
    color: '#FFFFFF',
    border: 'none',
    borderRadius: '8px',
    fontSize: '1rem',
    fontWeight: '700',
    cursor: 'pointer',
    letterSpacing: '0.3px',
    width: '100%',
  },
  error: {
    color: '#C62828',
    backgroundColor: '#FFEBEE',
    border: '1px solid #FFCDD2',
    borderRadius: '8px',
    padding: '10px 12px',
    fontSize: '0.875rem',
    marginBottom: '0.5rem',
  },
  successBox: {
    backgroundColor: '#E8F5E9',
    border: '1px solid #A5D6A7',
    borderRadius: '10px',
    padding: '1.25rem',
    marginBottom: '1.25rem',
    textAlign: 'center',
  },
  successTitle: {
    margin: '0 0 0.5rem',
    fontWeight: '700',
    fontSize: '1.05rem',
    color: '#1B5E20',
  },
  successMsg: {
    margin: 0,
    fontSize: '0.875rem',
    color: '#4A6741',
    lineHeight: 1.6,
  },
  loginPrompt: {
    marginTop: '1.25rem',
    textAlign: 'center',
    fontSize: '0.875rem',
    color: '#5A7A5A',
  },
  link: {
    color: '#2E7D32',
    fontWeight: '700',
    textDecoration: 'none',
  },
}
