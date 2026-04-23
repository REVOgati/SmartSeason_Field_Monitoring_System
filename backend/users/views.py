from rest_framework.views import APIView
from rest_framework.generics import RetrieveUpdateAPIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.views import TokenObtainPairView

from .serializers import UserRegistrationSerializer, UserProfileSerializer, CustomTokenObtainPairSerializer


class RegisterView(APIView):
    """
    POST /api/auth/register/

    Creates a new user account. Open to anyone — no authentication required.
    The account is created with is_active=False and is_verified=False by default
    (set on the model), so the user cannot log in until a superuser approves them.

    Why APIView here instead of CreateAPIView (generic)?
    CreateAPIView.post() returns HTTP 201 with the full serializer.data by default.
    We want to return a custom message instead of the user object — both for
    better UX ("awaiting verification") and for security (no reason to echo back
    all the field values after registration).
    Overriding CreateAPIView's create() would work too, but using APIView is more
    explicit and easier to understand at this stage.

    permission_classes = [AllowAny]
    AllowAny overrides the DEFAULT_PERMISSION_CLASSES set in settings.py.
    Once we configure JWT in Session 8, the default will be IsAuthenticated,
    which would block unauthenticated users from even reaching this view.
    We override it here because registration must always be publicly accessible.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        """
        request.data is a dict-like object containing the parsed request body.
        For JSON requests, DRF automatically parses the JSON string into Python dicts.
        We pass it to the serializer as `data=` to trigger validation mode
        (as opposed to passing an instance, which would be read mode).
        """
        serializer = UserRegistrationSerializer(data=request.data)

        if serializer.is_valid():
            serializer.save()
            # serializer.save() calls our custom create() method in the serializer,
            # which calls User.objects.create_user() with a hashed password.
            # We deliberately do NOT return serializer.data here — no need to echo
            # the submitted fields back. A clear message is enough.
            return Response(
                {'message': 'Account created successfully. Awaiting admin verification before you can log in.'},
                status=status.HTTP_201_CREATED
                # status.HTTP_201_CREATED is 201 — the standard code for "resource created".
                # Always use DRF's status constants (not raw integers like 201) for readability.
            )

        # serializer.errors is a dictionary of field names to lists of error messages.
        # Example: {'email': ['Enter a valid email address.'], 'password2': ['Passwords do not match.']}
        # Returning it directly gives the frontend structured, field-level error messages.
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class MeView(RetrieveUpdateAPIView):
    """
    GET   /api/auth/me/  → returns the logged-in user's full profile
    PATCH /api/auth/me/  → updates full_name or profile_photo only

    Why RetrieveUpdateAPIView (generic) here instead of APIView?
    This endpoint has no custom logic beyond "get or update the current user".
    GenericViews are ideal for this — you declare what and DRF handles how.

    RetrieveUpdateAPIView gives us:
    - GET → calls retrieve() → serializes self.get_object() → returns JSON
    - PUT → full update (all fields required)
    - PATCH → partial update (only send the fields you want to change)
    We get all three HTTP methods for free by choosing this base class.

    permission_classes = [IsAuthenticated]
    Only a logged-in user can view or edit their own profile.
    After Session 8 this will be the global default, but we set it explicitly
    here as documentation of intent while we're still building the auth layer.
    """
    serializer_class   = UserProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        """
        get_object() is called by both retrieve() and update() internally.
        The normal implementation looks up an object by a URL pk parameter
        (e.g. /api/users/5/ → pk=5). We override it here to always return
        request.user instead — no URL parameter needed, no risk of accessing
        another user's profile by guessing their ID.

        This is the standard pattern for a "me" endpoint in DRF.
        """
        return self.request.user


class LoginView(TokenObtainPairView):
    """
    POST /api/auth/login/

    Accepts: { "email": "...", "password": "..." }
    Returns: { "access": "eyJ...", "refresh": "eyJ..." }

    Why subclass TokenObtainPairView instead of using it directly?
    TokenObtainPairView uses SimpleJWT's default TokenObtainPairSerializer
    which doesn't know about our custom claims or our verification gate.
    By pointing serializer_class at our CustomTokenObtainPairSerializer,
    we inject both behaviours while keeping all of SimpleJWT's credential
    checking, token minting, and response formatting intact.

    permission_classes = [AllowAny]
    Login must be public — the user has no token yet when they call this.
    """
    serializer_class   = CustomTokenObtainPairSerializer
    permission_classes = [AllowAny]
