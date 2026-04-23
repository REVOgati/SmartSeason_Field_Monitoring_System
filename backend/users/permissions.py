from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsVerified(BasePermission):
    """
    Checks that the authenticated user has is_verified=True.

    This is technically redundant — our JWT LoginView already blocks unverified
    users from getting a token. If they have a token, they were verified at the
    time of login. However, a superuser could deactivate/unverify an account
    AFTER a token was issued (tokens last 60 minutes). This class catches that
    edge case: if is_verified is ever flipped to False mid-session, any endpoint
    protected with IsVerified will immediately start returning 403.

    This is the defence-in-depth principle: don't rely on a single gate.
    """
    message = 'Your account has not been verified by an administrator.'
    # message is the error string returned in the 403 response body.
    # DRF uses this if you set it on the permission class.

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.is_verified
        )


class IsCoordinator(BasePermission):
    """
    View-level: only coordinator-role users may access this endpoint.

    Used on FieldViewSet and all coordinator-specific endpoints.
    Field agents and superusers are blocked at view entry — they never
    reach get_queryset() or has_object_permission().

    Note: superusers manage data through Django Admin, not the API.
    The API is for operational use by coordinators and field agents.
    """
    message = 'Only coordinators can access this endpoint.'

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == 'coordinator'
        )


class IsFieldAgent(BasePermission):
    """
    View-level: only field_agent-role users may access this endpoint.

    Used on monitoring report submission endpoints (Session 13).
    Coordinators cannot submit field data reports — only agents can.
    """
    message = 'Only field agents can access this endpoint.'

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == 'field_agent'
        )


class IsCoordinatorOrFieldAgent(BasePermission):
    """
    View-level: either coordinators OR field agents may access.

    Used on shared endpoints where both roles are valid — for example,
    reading monitoring reports (coordinator reads all their field reports,
    agent reads their own submitted reports).

    This demonstrates the DRF permission composition pattern:
        permission_classes = [IsAuthenticated & (IsCoordinator | IsFieldAgent)]
    is equivalent to applying this single class. We use a single class here
    to keep the permission_classes list on views clean and readable.
    """
    message = 'Only coordinators or field agents can access this endpoint.'

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role in ('coordinator', 'field_agent')
        )


class IsFieldOwner(BasePermission):
    """
    Object-level: the requesting coordinator must own the field being accessed.

    has_object_permission() is called by DRF only on detail views:
    retrieve (GET /fields/{id}/), update (PUT/PATCH), destroy (DELETE).
    It is NOT called on list (GET /fields/) or create (POST /fields/).

    `obj` here is the Field instance retrieved by get_object().
    We check that obj.coordinator == request.user. If not, DRF returns 403.

    Why is this needed if get_queryset() already filters to the coordinator's fields?
    get_queryset() filters the LIST. If two coordinators both have field id=5
    (impossible in a single DB but conceptually: if the queryset filter is somehow
    bypassed), has_object_permission() is the safety net. More practically, it
    makes the permission logic self-documenting and testable as a standalone unit.
    """
    message = 'You do not have permission to access this field.'

    def has_permission(self, request, view):
        # Object-level permissions still require view-level authentication.
        # This check is minimal — IsCoordinator already enforces coordinator role.
        # We just confirm the user is authenticated before object lookup runs.
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        # obj is the Field instance. obj.coordinator is the owning User.
        return obj.coordinator == request.user


class IsAssignedAgent(BasePermission):
    """
    Object-level: the requesting field agent must be assigned to the field
    they are trying to interact with.

    Used on monitoring endpoints — an agent can only submit reports for
    fields where field.assigned_agent == request.user.
    They cannot submit reports for fields they are not assigned to,
    even if those fields belong to their same coordinator's team.

    obj is the Field instance.
    """
    message = 'You are not assigned to this field.'

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        return obj.assigned_agent == request.user