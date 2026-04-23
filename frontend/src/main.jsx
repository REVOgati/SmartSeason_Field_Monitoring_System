import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'

/*
  Why BrowserRouter here (in main.jsx) instead of inside App.jsx?

  BrowserRouter provides the routing context — every component that needs
  to read the current URL, navigate, or render a <Link> must be a descendant
  of a Router. By wrapping at the very root we guarantee that ALL components
  in the tree have access to the router context without exception.

  If we put BrowserRouter inside App.jsx it would still work, but placing it
  here makes the intent explicit: the WHOLE application is a routed app.

  StrictMode stays as the outermost wrapper — it only affects development
  behaviour (double-invoking effects to catch bugs) and has zero runtime cost
  in production.
*/
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
