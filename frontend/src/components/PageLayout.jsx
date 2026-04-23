/*
  PageLayout.jsx — Wrapper that sets the green-tinted page background and
  centres the main content area with consistent max-width and padding.

  Used by: CoordinatorDashboard, AgentDashboard, and any future auth-only page.

  Props:
    children — any React content rendered inside the content area

  Layout structure:
    <div page background>         ← full-viewport height, green-50 bg
      {children}                  ← receives Navbar + main content
    </div>

  Why this exists:
  Without this, every page must repeat:
    backgroundColor: '#E8F5E9'
    minHeight: '100vh'
    fontFamily: 'Segoe UI...'
  One wrapper removes that repetition.

  The inner "main" container with maxWidth and padding is exposed via the
  exported `contentArea` style so pages can apply it themselves to the
  <main> element while still keeping semantic HTML.
*/
export default function PageLayout({ children }) {
  return (
    <div style={styles.page}>
      {children}
    </div>
  )
}

/* Shared content container style — import and apply to your <main> tag */
export const contentArea = {
  maxWidth: '1100px',
  margin: '0 auto',
  padding: '2rem 1.5rem',
}

const styles = {
  page: {
    minHeight: '100vh',
    backgroundColor: '#E8F5E9',
    fontFamily: "'Segoe UI', system-ui, sans-serif",
  },
}
