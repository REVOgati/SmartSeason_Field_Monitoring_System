import axios from 'axios'

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
  baseURL: 'http://127.0.0.1:8000/api/',
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
