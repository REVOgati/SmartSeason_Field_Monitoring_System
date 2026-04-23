import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import AuthProvider from './context/AuthContext'
import './index.css'
import App from './App.jsx'

/*
  Provider order matters: BrowserRouter must wrap AuthProvider because
  AuthProvider (or components it renders) may call useNavigate() internally.
  useNavigate() requires a Router ancestor — so Router goes on the outside.

  Reading the tree from outside in:
  StrictMode       → dev-only double-invocation checks (no runtime effect)
  BrowserRouter    → provides URL context (window.location + history API)
  AuthProvider     → provides auth state (user, login, logout, isAuthenticated)
  App              → the actual route tree
*/
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
