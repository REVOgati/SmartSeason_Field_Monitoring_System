import useAuth from '../hooks/useAuth'

/*
  Navbar.jsx — Shared top navigation bar.

  Used by: CoordinatorDashboard, AgentDashboard (and any future authenticated page).

  Props:
    title  (string, optional) — page-specific subtitle shown after the brand name.
                                 e.g. "Coordinator Dashboard" or "My Reports"
                                 Omit it to show just "SmartSeason".

  What it does:
  - Shows the brand logo mark + app name on the left
  - Shows the current user's full name (or email fallback) on the right
  - Shows a "Log out" button that calls AuthContext.logout()

  Why as a shared component?
  Both dashboard pages have an identical nav bar. Duplicating the markup
  and styles in each page would mean two places to update if the design changes.
  A single Navbar component means one file owns the nav appearance.

  Why not accept logout as a prop?
  Navbar always does the same thing on logout — calling useAuth().logout().
  Passing it as a prop would add ceremony with no benefit here.
  If we ever need a "confirm before logout" flow, we update this one file.
*/
export default function Navbar({ title }) {
  const { user, logout } = useAuth()

  return (
    <nav style={styles.nav}>
      <span style={styles.brand}>
        🌿 SmartSeason
        {title && <span style={styles.pageTitle}> · {title}</span>}
      </span>

      <div style={styles.right}>
        <span style={styles.userName}>
          {user?.full_name || user?.email || ''}
        </span>
        <button style={styles.logoutBtn} onClick={logout}>
          Log out
        </button>
      </div>
    </nav>
  )
}

const styles = {
  nav: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1B5E20',
    padding: '0 2rem',
    height: '60px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.18)',
    position: 'sticky',
    top: 0,
    zIndex: 50,
    /*
      position: sticky + top: 0 keeps the nav visible when the user scrolls down
      a long list of fields or reports.
      zIndex: 50 ensures the nav sits above cards and modals that might
      overlap at the top of the viewport.
    */
  },
  brand: {
    color: '#FFFFFF',
    fontSize: '1.15rem',
    fontWeight: '800',
    letterSpacing: '0.3px',
  },
  pageTitle: {
    fontWeight: '500',
    color: '#C8E6C9',
    fontSize: '1rem',
  },
  right: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  userName: {
    color: '#C8E6C9',
    fontSize: '0.875rem',
  },
  logoutBtn: {
    padding: '0.38rem 1rem',
    backgroundColor: 'transparent',
    color: '#FFFFFF',
    border: '1.5px solid #A5D6A7',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: '600',
  },
}
