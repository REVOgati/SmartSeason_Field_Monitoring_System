from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import RegisterView, MeView, LoginView

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    # POST /api/auth/register/ → create a new account (no auth required)

    path('login/', LoginView.as_view(), name='login'),
    # POST /api/auth/login/ → returns access + refresh tokens
    # Uses our CustomTokenObtainPairSerializer which:
    #   - embeds role, full_name, email into the token payload
    #   - blocks login for unverified accounts

    path('refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    # POST /api/auth/refresh/ → exchange a valid refresh token for a new access token
    # Body: { "refresh": "eyJ..." }
    # Response: { "access": "eyJ...", "refresh": "eyJ..." }  (new pair, old refresh invalidated)
    # We use SimpleJWT's built-in TokenRefreshView directly — no customisation needed here.

    path('me/', MeView.as_view(), name='me'),
    # GET  /api/auth/me/  → read own profile (requires valid access token)
    # PATCH /api/auth/me/ → update own profile
]
