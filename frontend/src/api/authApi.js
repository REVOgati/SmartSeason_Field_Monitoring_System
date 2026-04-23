import axiosInstance from './axiosInstance'

/*
  authApi.js — All API calls related to authentication.

  Why separate API functions instead of calling axiosInstance directly in components?
  ──────────────────────────────────────────────────────────────────────────────────
  Components should not know or care about URL strings, HTTP methods, or
  request body shapes. If the backend endpoint changes, we update it here
  in one place — not scattered across every component that calls it.

  Each function returns the full Axios response object so the caller
  (AuthContext) can read response.data and handle errors however it needs to.
*/

export async function loginUser(email, password) {
  /*
    POST /api/auth/login/
    Body: { email, password }
    Returns: { access: "eyJ...", refresh: "eyJ..." }

    axiosInstance has baseURL = 'http://127.0.0.1:8000/api/'
    so '/auth/login/' resolves to 'http://127.0.0.1:8000/api/auth/login/'

    We let any error (401 wrong credentials, 403 unverified) bubble up as an
    exception — the caller (AuthContext.login) wraps this in try/catch and
    decides how to surface the message to the UI.
  */
  const response = await axiosInstance.post('auth/login/', { email, password })
  return response.data
  // response.data = { access: "eyJ...", refresh: "eyJ..." }
}

export async function refreshAccessToken(refreshToken) {
  /*
    POST /api/auth/refresh/
    Body: { refresh: "eyJ..." }
    Returns: { access: "eyJ...", refresh: "eyJ..." }

    SimpleJWT's ROTATE_REFRESH_TOKENS=True means every refresh call
    returns a NEW refresh token alongside the new access token.
    The caller must store the new refresh token — the old one is now invalid.

    This function is called by the Axios response interceptor in Session 17
    when a 401 is received, completely transparently to the components.
  */
  const response = await axiosInstance.post('auth/refresh/', { refresh: refreshToken })
  return response.data
  // response.data = { access: "eyJ...", refresh: "eyJ..." }
}

export async function registerUser({ email, full_name, role, password, password2 }) {
  /*
    POST /api/auth/register/
    Body: { email, full_name, role, password, password2 }

    Accepted roles: "coordinator" | "field_agent"
    ("superuser" is blocked at the backend serializer level.)

    On success (201 Created): returns a plain message object, NOT the new user.
      { "message": "Account created. Awaiting verification." }

    The account is created with is_verified=False. The user cannot log in
    until a superuser approves them via the Django admin panel.

    On validation error (400): returns a structured error dict, e.g.:
      { "email": ["user with this email already exists."] }
      { "password2": ["Passwords do not match."] }
    The caller flattens these for display.
  */
  const response = await axiosInstance.post('auth/register/', {
    email, full_name, role, password, password2,
  })
  return response.data
}
