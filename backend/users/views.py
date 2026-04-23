from rest_framework.views import APIView
from rest_framework.generics import RetrieveUpdateAPIView, ListAPIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import User
from .serializers import (
    UserRegistrationSerializer,
    UserProfileSerializer,
    CustomTokenObtainPairSerializer,
    AgentPoolSerializer,
)
from .permissions import IsVerified, IsCoordinator


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
    - GET  → calls retrieve() → serializes self.get_object() → returns JSON
    - PUT  → full update (all fields required)
    - PATCH → partial update (only send the fields you want to change)
    We get all three HTTP methods for free by choosing this base class.

    Permissions: IsAuthenticated + IsVerified.
    IsVerified adds defence-in-depth — if a superuser flips is_verified=False
    on an account that still has a live token (tokens last 60 min), this
    immediately blocks the user from reading or editing their profile.
    """
    serializer_class   = UserProfileSerializer
    permission_classes = [IsAuthenticated, IsVerified]

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


class AgentPoolView(ListAPIView):
    """
    GET /api/agents/pool/

    Returns all verified, active field agents who are not yet assigned to any
    coordinator — i.e. their coordinator FK is NULL.

    These agents have completed registration and been approved by a superuser
    but are waiting to be picked up by a coordinator.

    Why ListAPIView here?
    ListAPIView is a GenericView that gives us a GET endpoint for free:
    it calls get_queryset(), paginates the result, and serializes it.
    No post(), put(), or delete() — coordinators browse, then call /assign/.

    Only coordinators can see this list. Field agents don't recruit each other.
    """
    serializer_class   = AgentPoolSerializer
    permission_classes = [IsAuthenticated, IsCoordinator]

    def get_queryset(self):
        """
        User.field_agents is the FieldAgentManager — already filters for
        is_verified=True and is_active=True. We add coordinator__isnull=True
        to get only pool agents (not yet assigned to anyone).
        """
        return User.field_agents.filter(coordinator__isnull=True)


class MyTeamView(ListAPIView):
    """
    GET /api/agents/my-team/

    Returns all verified, active field agents currently assigned to the
    requesting coordinator (their coordinator FK points to request.user).

    This is the coordinator's live roster — one place to see who is on their
    team and look up PKs for the /drop/ endpoint.
    """
    serializer_class   = AgentPoolSerializer
    permission_classes = [IsAuthenticated, IsCoordinator]

    def get_queryset(self):
        """
        FieldAgentManager.for_coordinator() is defined on the model manager
        and filters: role=field_agent, is_verified=True, is_active=True,
        coordinator=<given user>. One line, no repeated filter logic.
        """
        return User.field_agents.for_coordinator(self.request.user)


class AssignAgentView(APIView):
    """
    POST /api/agents/{pk}/assign/

    Pulls a single agent from the unassigned pool into this coordinator's team.
    No request body needed — the target agent is identified by the URL pk.

    Validation rules enforced here:
    - The pk must belong to a verified, active field agent (via FieldAgentManager)
    - The agent must currently be unassigned (coordinator__isnull=True)
      → if both conditions aren't met, 404 is returned
      → we use 404 (not 403) to avoid confirming that the agent exists but
        belongs to someone else — that would leak information

    On success: sets agent.coordinator = request.user and saves.
    """
    permission_classes = [IsAuthenticated, IsCoordinator]

    def post(self, request, pk):
        try:
            agent = User.field_agents.get(pk=pk, coordinator__isnull=True)
            # field_agents manager already restricts to verified+active field agents.
            # coordinator__isnull=True ensures the agent is in the pool (not taken).
        except User.DoesNotExist:
            return Response(
                {'detail': 'Agent not found in pool. They may not exist, may not be verified, or may already be assigned to a coordinator.'},
                status=status.HTTP_404_NOT_FOUND
            )

        agent.coordinator = request.user
        agent.save(update_fields=['coordinator'])
        # update_fields=['coordinator'] issues a targeted UPDATE statement:
        #   UPDATE users_user SET coordinator_id=X WHERE id=Y
        # This is more efficient than a full .save() which updates every column,
        # and avoids accidentally overwriting fields changed by a concurrent request.

        return Response(
            {'message': f'{agent.full_name} has been added to your team.'},
            status=status.HTTP_200_OK
        )


class DropAgentView(APIView):
    """
    POST /api/agents/{pk}/drop/

    Releases a field agent from this coordinator's team back to the unassigned pool.
    Also clears all field assignments for that agent so fields are not left in
    a state where assigned_agent points to someone no longer on the team.

    Why POST instead of DELETE?
    REST DELETE conventionally deletes a resource. Here we are not deleting
    the agent account — we are performing a state transition (assigned → pool).
    POST on a custom action URL is the standard DRF pattern for operations that
    don't map cleanly to CRUD.

    Business rule on field clearing:
    When an agent is dropped, Field.assigned_agent is set to NULL for every
    field they were assigned to. This preserves the field record and all its
    historical monitoring data — only the assignment link is cleared.
    The coordinator can reassign a new agent to those fields afterwards.
    """
    permission_classes = [IsAuthenticated, IsCoordinator]

    def post(self, request, pk):
        # Import Field here (inside the method) to avoid a potential circular
        # import at module level: users.views → fields.models → (fields imports users)
        from fields.models import Field

        try:
            agent = User.field_agents.for_coordinator(request.user).get(pk=pk)
            # for_coordinator(request.user) scopes the query to THIS coordinator's team.
            # .get(pk=pk) then finds the specific agent.
            # If the agent belongs to a different coordinator, DoesNotExist is raised
            # → 404, no information leaked about agents on other teams.
        except User.DoesNotExist:
            return Response(
                {'detail': 'Agent not found on your team.'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Clear all field assignments for this agent in a single UPDATE query.
        # .update() runs SQL directly without loading objects into memory —
        # more efficient than fetching each Field and calling .save() individually.
        cleared_count = Field.objects.filter(assigned_agent=agent).update(assigned_agent=None)

        agent.coordinator = None
        agent.save(update_fields=['coordinator'])

        return Response(
            {
                'message': f'{agent.full_name} has been released from your team.',
                'fields_cleared': cleared_count,
                # Tell the coordinator how many field assignments were wiped
                # so they know how many fields now need a new agent assigned.
            },
            status=status.HTTP_200_OK
        )
