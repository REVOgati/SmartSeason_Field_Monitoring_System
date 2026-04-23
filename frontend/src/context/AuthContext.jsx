import { createContext, useState, useEffect, useCallback } from 'react'
import { jwtDecode } from 'jwt-decode'
import { loginUser } from '../api/authApi'

/*
  AuthContext.jsx — Global authentication state for the entire application.

  What is React Context?
  ──────────────────────
  Context is React's built-in solution for "global" state — values that many
  components at different levels of the tree need to read without prop-drilling.

  Without context, to pass `user` from App.jsx down to a Navbar inside a Layout
  inside a Dashboard you would thread the prop through every intermediate component
  even if those intermediate components don't actually use it. That is prop-drilling.

  Context lets any component in the tree call useContext(AuthContext) and get the
  current value directly, regardless of how deeply nested it is.

  Structure of this file:
  ┌─────────────────────────────────────────────────────────────────────┐
  │  createContext()  → creates the context object (the "pipe")         │
  │  AuthProvider     → the component that holds state and fills the pipe│
  │  export default   → AuthProvider (wraps the app in main.jsx later)  │
  │  named export     → AuthContext (used by useAuth hook to read state) │
  └─────────────────────────────────────────────────────────────────────┘
*/

export const AuthContext = createContext(null)
/*
  createContext(null) creates an empty context.
  null is the default value used if a component tries to consume the context
  without being inside an AuthProvider — this should never happen in our app,
  but null makes it obvious something is wrong rather than silently failing.
*/


export default function AuthProvider({ children }) {
  /*
    AuthProvider is a regular React component whose only job is to:
    1. Own the auth state (tokens + decoded user info)
    2. Expose login() and logout() functions
    3. Wrap its children in <AuthContext.Provider value={...}>
       so all descendants can read that state

    `children` is every component rendered inside <AuthProvider> in main.jsx.
    The Provider's `value` prop is what useContext(AuthContext) returns.
  */

  const [authTokens, setAuthTokens] = useState(() => {
    /*
      Lazy initializer: the function passed to useState() runs only ONCE
      on the first render instead of on every render.

      We use this to rehydrate tokens from localStorage on page load.
      Without this, refreshing the browser would log the user out every time
      because useState(null) would reset the state.

      localStorage.getItem() returns null if the key doesn't exist,
      so JSON.parse(null) returns null — safe default for a logged-out state.
    */
    const stored = localStorage.getItem('authTokens')
    return stored ? JSON.parse(stored) : null
  })

  const [user, setUser] = useState(() => {
    /*
      Same lazy-init pattern: decode the stored access token on page load
      to reconstruct the user object (role, full_name, email, user_id).

      jwtDecode() reads the token's Base64 payload WITHOUT verifying the signature.
      We don't need to verify — the backend does that on every API call.
      Here we just need the claims to know who is logged in and what role they have.

      Decoded payload shape (from our CustomTokenObtainPairSerializer):
      {
        user_id:   3,
        role:      "coordinator",
        full_name: "Jane Coord",
        email:     "jane@example.com",
        exp:       1714000000,   ← expiry timestamp
        ...
      }
    */
    const stored = localStorage.getItem('authTokens')
    if (stored) {
      try {
        return jwtDecode(JSON.parse(stored).access)
      } catch {
        return null
      }
    }
    return null
  })

  const login = useCallback(async (email, password) => {
    /*
      login() is the function components call when the user submits the login form.
      It calls the API, stores the tokens, decodes the user, and updates state.

      useCallback(fn, []) memoizes the function — it is created once and its
      reference stays stable across renders. This matters because login is passed
      as a value in the context; without useCallback, every AuthProvider render
      would create a new function reference, which could cause unnecessary
      re-renders in any component that depends on it.

      Throws on failure — LoginPage.jsx catches this and shows an error message.
    */
    const data = await loginUser(email, password)
    // data = { access: "eyJ...", refresh: "eyJ..." }
    // loginUser() throws if the server returns 401/403, propagating to the caller.

    localStorage.setItem('authTokens', JSON.stringify(data))
    localStorage.setItem('access_token', data.access)
    /*
      We store two entries:
      - 'authTokens' → the full { access, refresh } object (used by this context
        and by the refresh interceptor in Session 17)
      - 'access_token' → just the access token string (read by axiosInstance's
        request interceptor on every API call)
    */

    const decoded = jwtDecode(data.access)
    setAuthTokens(data)
    setUser(decoded)
    // React re-renders any component that reads user or authTokens from context.
  }, [])

  const logout = useCallback(() => {
    /*
      logout() clears all stored auth data and resets state to null.
      The user is returned to the unauthenticated state.

      We do NOT call the backend's /auth/logout/ endpoint (SimpleJWT has one)
      because we are using ROTATE_REFRESH_TOKENS — the old refresh token is
      already invalidated the moment a new one is issued. For a stricter
      implementation, a token blacklist could be added to the backend later.
    */
    localStorage.removeItem('authTokens')
    localStorage.removeItem('access_token')
    setAuthTokens(null)
    setUser(null)
  }, [])

  useEffect(() => {
    /*
      Token expiry check on mount.
      If localStorage has a token but it has already expired (e.g. the user left
      the browser open for 60+ minutes without activity), log them out silently
      rather than leaving them with a stale token that will 401 on the first API call.

      exp is a Unix timestamp (seconds since epoch).
      Date.now() returns milliseconds, so we divide by 1000.
    */
    if (authTokens) {
      try {
        const decoded = jwtDecode(authTokens.access)
        if (decoded.exp < Date.now() / 1000) {
          logout()
        }
      } catch {
        logout()
      }
    }
  }, [])
  // Empty dependency array: runs once on mount only.
  // logout is stable (useCallback with []) so it's safe to omit from deps here.

  const contextValue = {
    user,
    /*
      user = decoded JWT payload or null.
      Components read: user.role, user.full_name, user.email, user.user_id
      to decide what to render (coordinator dashboard vs agent view).
    */
    authTokens,
    login,
    logout,
    isAuthenticated: !!user,
    /*
      isAuthenticated is a convenience boolean derived from user.
      !!user: null → false, object → true.
      Components can write: if (isAuthenticated) ... instead of if (user) ...
    */
  }

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
    /*
      Every component inside <AuthProvider> (i.e. the entire app) can now
      call useContext(AuthContext) and get contextValue.
      The useAuth() hook wraps this call to make it even more ergonomic.
    */
  )
}
