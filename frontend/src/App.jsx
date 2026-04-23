import { Routes, Route } from 'react-router-dom'

/*
  App.jsx — Root route tree.

  All page-level <Route> entries live here. App.jsx's only responsibility
  is declaring which component renders at which URL path. No logic, no state.

  Routes and pages will be added session by session:
    Session 15 → LoginPage  at /login
    Session 16 → Coordinator dashboard at /dashboard
    Session 17 → Agent dashboard at /agent
    etc.

  Why <Routes> here and <BrowserRouter> in main.jsx?
  BrowserRouter supplies the URL context (window.location).
  Routes reads that context and matches the current URL to its children.
  They are intentionally separate — context provider vs. consumer.
*/

function App() {
  return (
    <Routes>
      {/*
        Routes will be added here from Session 15 onwards.
        Each <Route> maps a URL path to a page component, e.g.:
          <Route path="/login"     element={<LoginPage />} />
          <Route path="/dashboard" element={<CoordinatorDashboard />} />
      */}
      <Route
        path="*"
        element={
          <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
            <h1>SmartSeason</h1>
            <p>Frontend scaffold ready. Pages coming in Session 15.</p>
          </div>
        }
      />
    </Routes>
  )
}

export default App
