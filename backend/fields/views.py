from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend

from .models import Field
from .serializers import FieldSerializer, AgentRealizedDatesSerializer
from users.permissions import IsCoordinator, IsFieldAgent, IsFieldOwner


class FieldViewSet(viewsets.ModelViewSet):
    """
    Handles all five standard CRUD operations for Field records.

    Auto-generated URL actions (wired by the Router in urls.py):
      GET    /api/fields/         → list()    — all fields for this coordinator
      POST   /api/fields/         → create()  — create a new field
      GET    /api/fields/{id}/    → retrieve()— one field
      PUT    /api/fields/{id}/    → update()  — full update (all fields required)
      PATCH  /api/fields/{id}/    → partial_update() — update only sent fields
      DELETE /api/fields/{id}/    → destroy() — delete the field record

    Why ModelViewSet and not GenericView here?
    ModelViewSet = ListModelMixin + CreateModelMixin + RetrieveModelMixin
                   + UpdateModelMixin + DestroyModelMixin + GenericViewSet
    all combined into one class. We get all five CRUD actions for free.
    When a ViewSet is registered with a Router (see urls.py), the router
    figures out which action to call based on the HTTP method and the URL.

    Permission stack — three layers checked in order:
    1. IsAuthenticated  — must have a valid JWT token
    2. IsCoordinator    — must have role='coordinator'
    3. IsFieldOwner     — on detail views, field.coordinator must == request.user

    The first two are view-level (run on every request to any action).
    IsFieldOwner is object-level (only runs on retrieve/update/destroy).
    Together they enforce:
    - Field agents cannot use the fields API at all
    - Coordinator A cannot see, edit, or delete Coordinator B's fields
    """
    serializer_class   = FieldSerializer
    permission_classes = [IsAuthenticated, IsCoordinator, IsFieldOwner]

    # --- Filtering (DjangoFilterBackend) ---
    # Enables exact-match filtering via query parameters.
    # GET /api/fields/?is_active=true
    # GET /api/fields/?crop_type=Maize
    # GET /api/fields/?assigned_agent=5
    # GET /api/fields/?is_active=true&crop_type=Maize  ← multiple filters combine with AND
    filter_backends   = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    # We set filter_backends explicitly on the ViewSet rather than relying on the
    # global DEFAULT_FILTER_BACKENDS alone. This makes the intent visible in the
    # code and allows future ViewSets to opt into/out of specific backends.

    filterset_fields  = ['is_active', 'crop_type', 'assigned_agent']
    # DjangoFilterBackend uses these for exact-match filters.
    # assigned_agent accepts a user PK: ?assigned_agent=5
    # is_active accepts a boolean:      ?is_active=true  or  ?is_active=false

    # --- Free-text search (SearchFilter) ---
    # GET /api/fields/?search=nakuru
    # GET /api/fields/?search=french
    # SearchFilter runs SQL: WHERE name ILIKE '%nakuru%' OR location ILIKE '%nakuru%' etc.
    search_fields     = ['name', 'location', 'crop_type']
    # Searches across field name, location string, and crop type simultaneously.

    # --- Client-controlled ordering (OrderingFilter) ---
    # GET /api/fields/?ordering=name          ← A → Z by name
    # GET /api/fields/?ordering=-created_at   ← newest first (default)
    # GET /api/fields/?ordering=size_in_acres ← smallest fields first
    ordering_fields   = ['name', 'created_at', 'size_in_acres']
    # Only fields listed here are safe to order by (prevents ordering on hidden fields).
    ordering          = ['-created_at']
    # Default ordering when the client sends no ?ordering= parameter.
    # Matches the Meta.ordering on the model so behaviour is consistent.

    def get_queryset(self):
        """
        Called by list(), retrieve(), update(), destroy() — any action that
        needs to find records in the database.

        Returning Field.objects.all() here would let Coordinator A see
        Coordinator B's fields by calling GET /api/fields/3/ directly.
        Filtering by coordinator=request.user means:
        - list()    → returns only this coordinator's fields
        - retrieve()→ returns 404 (not 403) if the field belongs to someone else
                      (because it's not in the queryset at all — it simply doesn't exist
                      from this user's perspective, which leaks no information)

        select_related pre-fetches coordinator and assigned_agent in the same
        SQL query so the nested serializer doesn't cause N+1 queries.
        """
        return (
            Field.objects
            .filter(coordinator=self.request.user)
            .select_related('coordinator', 'assigned_agent')
        )

    def perform_create(self, serializer):
        """
        Called by create() after the serializer has validated the incoming data,
        just before saving to the database.

        perform_create(serializer) is the correct hook for injecting values
        that the user should NOT supply themselves — like who owns this record.
        Here we force coordinator=request.user regardless of anything in the
        request body. The coordinator cannot claim another user as owner.

        serializer.save(**kwargs) merges these kwargs into validated_data
        before calling serializer.create(validated_data).
        """
        serializer.save(coordinator=self.request.user)

    @action(
        detail=False,
        methods=['get'],
        url_path='my-assigned',
        permission_classes=[IsAuthenticated, IsFieldAgent],
    )
    def my_assigned(self, request):
        """
        GET /api/fields/my-assigned/

        Returns all fields whose assigned_agent FK points to the requesting user.
        Used by SubmitReportPage to populate the field dropdown — an agent can
        only submit a report for a field they are currently assigned to.

        Why @action instead of a separate view?
        It lives on the same router as the other FieldViewSet endpoints, so it
        inherits the base URL prefix (/api/fields/) without needing another
        url.py entry. The url_path='my-assigned' controls the URL segment that
        follows the prefix: GET /api/fields/my-assigned/

        Why separate permission_classes here?
        The ViewSet's class-level permission_classes=[IsCoordinator] would block
        field agents. @action lets us override that on a per-action basis —
        only this one action is agent-accessible; all others remain coordinator-only.
        """
        qs = (
            Field.objects
            .filter(assigned_agent=request.user)
            .select_related('coordinator', 'assigned_agent')
        )
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(
        detail=True,
        methods=['get'],
        url_path='agent-detail',
        permission_classes=[IsAuthenticated, IsFieldAgent],
    )
    def agent_detail(self, request, pk=None):
        """
        GET /api/fields/{id}/agent-detail/

        Returns the full field record (including all date fields) for a field
        that is assigned to the requesting agent.  403 is returned if the agent
        is not the assigned agent for this field — preventing agents from reading
        details of fields belonging to other agents.
        """
        # We can't use self.get_object() because get_queryset() filters by
        # coordinator=request.user, which would always 404 for agents.
        # Look up by pk from the unrestricted queryset instead.
        try:
            field = Field.objects.select_related('coordinator', 'assigned_agent').get(pk=pk)
        except Field.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        if field.assigned_agent != request.user:
            return Response(
                {'detail': 'You are not assigned to this field.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = FieldSerializer(field, context={'request': request})
        return Response(serializer.data)

    @action(
        detail=True,
        methods=['patch'],
        url_path='realized-dates',
        permission_classes=[IsAuthenticated, IsFieldAgent],
    )
    def update_realized_dates(self, request, pk=None):
        """
        PATCH /api/fields/{id}/realized-dates/

        Allows a field agent to record the actual (realized) dates for the crop
        lifecycle on their assigned field.  Accepts only the 4 realized date
        fields — all other field attributes are ignored, so agents cannot
        overwrite coordinator-controlled data through this endpoint.
        """
        try:
            field = Field.objects.get(pk=pk)
        except Field.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        if field.assigned_agent != request.user:
            return Response(
                {'detail': 'You are not assigned to this field.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = AgentRealizedDatesSerializer(field, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        # Return the full field record so the frontend can refresh its state
        return Response(FieldSerializer(field, context={'request': request}).data)
