import axios from 'axios'
import { jwtDecode } from 'jwt-decode'

/*
  axiosInstance.js — The single configured Axios client for the whole app.

  Why a shared instance instead of calling axios.get/post directly everywhere?
  ────────────────────────────────────────────────────────────────────────────
  1. Single source of truth for the base URL.
     If the backend URL ever changes, we update it in one place here —
     not scattered across dozens of component files.

  2. Interceptors attach once and apply everywhere.
     The request interceptor below reads the access token from localStorage
     and injects the Authorization header automatically on every API call.
     Without this, every component would need to manually pass the token.

  3. Consistent error handling.
     A response interceptor (added in Session 17) will intercept 401 errors
     and trigger a silent refresh, completely invisible to component code.

  How to use this in any component or API function:
    import axiosInstance from '../api/axiosInstance'
    const response = await axiosInstance.get('/fields/')
    const response = await axiosInstance.post('/auth/login/', { email, password })
    — The base URL, headers, and auth are all handled for you.
*/

const axiosInstance = axios.create({
  // In production (Vercel) set VITE_API_URL to the Heroku backend URL,
  // e.g. https://smartseason-api.herokuapp.com/api/
  // In local development the fallback keeps things working without any .env file.
  baseURL: import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api/',
  /*
    baseURL: every request made through axiosInstance gets this prefix.
    axiosInstance.get('/fields/')  →  GET http://127.0.0.1:8000/api/fields/
    axiosInstance.post('/auth/login/')  →  POST http://127.0.0.1:8000/api/auth/login/

    In production this will be replaced with the deployed API domain via
    an environment variable (import.meta.env.VITE_API_URL).
    We hardcode the dev URL here for now to keep things simple.
  */
})

/*
  REQUEST INTERCEPTOR — runs before every outgoing request.

  use(onFulfilled, onRejected)
  - onFulfilled(config): receives the Axios request config object.
    We add the Authorization header here if a token exists.
    Must always return config (or a modified version of it).
  - onRejected: we pass it through unchanged with Promise.reject.

  Why localStorage for the token?
  The access token needs to survive page refreshes (sessionStorage would lose it).
  The refresh token (longer-lived) is also stored there for Session 17.
  Alternatives like httpOnly cookies are more secure against XSS but require
  backend CORS+cookie configuration — we'll consider that for production hardening.
*/
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token')
    /*
      localStorage.getItem() returns null if the key doesn't exist.
      The if-check means unauthenticated requests (register, login)
      go through without an Authorization header — exactly what we want
      because those endpoints are open (AllowAny on the backend).
    */
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`
      /*
        The backend expects:  Authorization: Bearer eyJhbGci...
        'Bearer' is the OAuth2 standard prefix that SimpleJWT is configured
        to accept (AUTH_HEADER_TYPES = ('Bearer',) in settings.py).
      */
    }
    return config
  },
  (error) => Promise.reject(error)
)

export default axiosInstance

/*
  RESPONSE INTERCEPTOR — runs after every response comes back from the server.

  The problem it solves:
  ──────────────────────
  Access tokens expire after 60 minutes (configured in settings.py).
  Without this interceptor, the user would get a cryptic 401 error mid-session
  and be forced to log in again even though they have a valid refresh token.

  How it works (the "silent refresh" pattern):
  ─────────────────────────────────────────────
  1. A request fails with HTTP 401 (Unauthorized).
  2. We check if a refresh token exists in localStorage.
  3. We POST the refresh token to /auth/refresh/ to get a new access token.
  4. We store the new access token.
  5. We RETRY the original failed request with the new token — transparent to the caller.

  Edge cases handled:
  ───────────────────
  - No refresh token → reject immediately (let the 401 propagate; caller shows login).
  - Refresh token itself is expired → the /auth/refresh/ call returns 401 →
    we clear localStorage and hard-redirect to /login.
  - _retry flag on the original config: prevents infinite loops where a retry
    itself returns 401 (e.g., if a new access token is immediately invalid).
    Without this, the interceptor would retry endlessly.

  Why a raw axios call for the refresh request?
  ──────────────────────────────────────────────
  We deliberately use plain `axios.post` (not `axiosInstance.post`) for the
  refresh request. Using axiosInstance would run this very interceptor again
  on the refresh response, causing infinite recursion if the refresh also fails.
  The raw axios call bypasses all interceptors — safe and intentional.
*/
axiosInstance.interceptors.response.use(
  // onFulfilled: pass successful responses straight through unchanged.
  (response) => response,

  async (error) => {
    const originalRequest = error.config

    // Only attempt a refresh if:
    //   1. The server returned 401 (token expired or invalid)
    //   2. We have not already retried this exact request (prevents loops)
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      // Mark THIS request as already retried so the interceptor won't
      // catch it again if the retried request also returns 401.

      const storedTokens = localStorage.getItem('authTokens')
      if (!storedTokens) {
        // No refresh token available — silently reject.
        // ProtectedRoute will redirect to /login on the next render.
        return Promise.reject(error)
      }

      const { refresh } = JSON.parse(storedTokens)

      // Check if refresh token itself is expired before even hitting the network.
      try {
        const decoded = jwtDecode(refresh)
        if (decoded.exp < Date.now() / 1000) {
          // Refresh token expired — clear everything and force re-login.
          localStorage.removeItem('authTokens')
          localStorage.removeItem('access_token')
          window.location.href = '/login'
          return Promise.reject(error)
        }
      } catch {
        // jwtDecode threw — the refresh token string is malformed. Clear and redirect.
        localStorage.removeItem('authTokens')
        localStorage.removeItem('access_token')
        window.location.href = '/login'
        return Promise.reject(error)
      }

      try {
        // POST the refresh token to get a new access token.
        // Raw axios.post — does NOT go through axiosInstance's interceptors.
        const refreshResponse = await axios.post(
          'http://127.0.0.1:8000/api/auth/refresh/',
          { refresh }
        )

        const newAccess = refreshResponse.data.access

        // Persist the new access token using the same keys AuthContext uses.
        const parsed = JSON.parse(storedTokens)
        parsed.access = newAccess
        localStorage.setItem('authTokens',   JSON.stringify(parsed))
        localStorage.setItem('access_token', newAccess)

        // Patch the failed request config with the fresh token and retry.
        originalRequest.headers['Authorization'] = `Bearer ${newAccess}`
        return axiosInstance(originalRequest)
        // axiosInstance(config) re-issues the request. The caller (component)
        // awaits this and receives the retried response — it never knew there
        // was a 401 and a silent refresh in between.

      } catch (refreshError) {
        // The refresh request itself failed (likely the refresh token expired).
        // Clear auth state and force the user back to the login page.
        localStorage.removeItem('authTokens')
        localStorage.removeItem('access_token')
        window.location.href = '/login'
        return Promise.reject(refreshError)
      }
    }

    // For every other error (400, 403, 404, 500…), reject as normal.
    // Individual callers handle these with their own catch blocks.
    return Promise.reject(error)
  }
)
