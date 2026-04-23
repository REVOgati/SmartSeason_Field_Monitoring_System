import { useContext } from 'react'
import { AuthContext } from '../context/AuthContext'

/*
  useAuth.js — Convenience hook for consuming AuthContext.

  Why write a custom hook instead of calling useContext(AuthContext) directly?
  ────────────────────────────────────────────────────────────────────────────
  1. Shorter import. Components write:
       import useAuth from '../hooks/useAuth'
       const { user, login, logout } = useAuth()
     Instead of:
       import { useContext } from 'react'
       import { AuthContext } from '../context/AuthContext'
       const { user, login, logout } = useContext(AuthContext)

  2. Encapsulates a safety check. If a component accidentally uses useAuth()
     outside of the AuthProvider tree, we throw a clear error immediately
     rather than silently getting null and debugging a confusing crash later.

  3. Single point of change. If we ever switch from React Context to a
     different state management solution, we only update this one file —
     none of the components that call useAuth() need to change.

  This is a standard React pattern for custom hooks:
  - Function name starts with 'use' (required for React to treat it as a hook)
  - Calls built-in hooks internally (useContext)
  - Returns a value that components use
*/

export default function useAuth() {
  const context = useContext(AuthContext)

  if (context === null) {
    throw new Error(
      'useAuth() was called outside of <AuthProvider>. ' +
      'Make sure AuthProvider wraps your component tree in main.jsx.'
    )
  }

  return context
  /*
    Returns the full contextValue object from AuthProvider:
    {
      user,            ← decoded JWT payload (or null if logged out)
      authTokens,      ← { access, refresh } (or null)
      login,           ← async (email, password) => void
      logout,          ← () => void
      isAuthenticated, ← boolean
    }

    Components destructure what they need:
    const { user, logout } = useAuth()
    const { isAuthenticated } = useAuth()
    const { login } = useAuth()
  */
}
