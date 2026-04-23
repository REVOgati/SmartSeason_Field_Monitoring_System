from django.urls import path
from .views import RegisterView, MeView

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    # POST /api/auth/register/ → create a new account
    # .as_view() converts our class-based view into a callable that Django's URL
    # router can call. Every class-based view (APIView subclass) requires this.

    path('me/', MeView.as_view(), name='me'),
    # GET  /api/auth/me/ → read own profile
    # PATCH /api/auth/me/ → update own profile
]
