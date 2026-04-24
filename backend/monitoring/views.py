from rest_framework import viewsets, filters, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from .models import FieldReport
from .serializers import FieldReportSerializer
from users.permissions import IsFieldAgent


class FieldReportViewSet(viewsets.ModelViewSet):
    """
    Handles all CRUD operations for FieldReport records.

    Auto-generated URL actions (wired by the Router in urls.py):
      GET    /api/reports/          → list()   — all reports visible to the user
      POST   /api/reports/          → create() — field agent submits a new report
      GET    /api/reports/{id}/     → retrieve()
      PUT    /api/reports/{id}/     → update()  (full)
      PATCH  /api/reports/{id}/     → partial_update()
      DELETE /api/reports/{id}/     → destroy()

    Two-role access model:
    ──────────────────────
    Field agents — can CREATE and view their own submitted reports.
    Coordinators — can READ (list + retrieve) reports for their own fields.
                   Cannot create, edit, or delete reports.

    Both roles use the same ViewSet but get_queryset() scopes what they can see,
    and get_permissions() adds the appropriate extra permission per HTTP method.

    Why one ViewSet instead of separate ones for each role?
    The queryset scoping handles isolation. Having one ViewSet keeps the URL
    structure flat (/api/reports/ for everyone) and avoids duplicating DRF boilerplate.
    The permission logic inside the ViewSet is the access control layer.
    """
    serializer_class = FieldReportSerializer
    permission_classes = [IsAuthenticated]
    # Base permission: any authenticated user can reach this ViewSet.
    # get_permissions() below adds role-specific restrictions per action.

    # --- Filtering, searching, ordering ---
    filter_backends  = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['crop_health', 'pest_observed', 'report_date', 'field']
    # GET /api/reports/?crop_health=poor
    # GET /api/reports/?pest_observed=true
    # GET /api/reports/?report_date=2026-04-15
    # GET /api/reports/?field=<pk>   ← used by FieldDetailPanel in CoordinatorDashboard

    search_fields    = ['notes', 'field__name', 'agent__full_name']
    # GET /api/reports/?search=nakuru

    ordering_fields  = ['report_date', 'submitted_at', 'crop_health']
    ordering         = ['-submitted_at']
    # Default: most recently submitted reports first.

    def get_queryset(self):
        """
        Scope the queryset to what the current user is allowed to see.

        Field agent:
            Sees only reports they personally submitted.
            submitted_reports is the related_name on FieldReport.agent.

        Coordinator:
            Sees all reports for their own fields.
            field__coordinator=request.user follows the FK chain:
            FieldReport → Field → coordinator
            This means a coordinator cannot see reports for another
            coordinator's fields even if they know the report ID.

        select_related pre-fetches field and agent in the same SQL query
        so the nested serializer doesn't cause N+1 queries.
        """
        user = self.request.user

        if user.role == 'field_agent':
            return (
                FieldReport.objects
                .filter(agent=user)
                .select_related('field', 'agent')
            )

        if user.role == 'coordinator':
            return (
                FieldReport.objects
                .filter(field__coordinator=user)
                .select_related('field', 'agent')
            )

        # Superusers (role='superuser') can see everything.
        # They use Django Admin for management, not this API,
        # but returning all records here avoids a confusing empty list
        # if they do call the endpoint.
        return FieldReport.objects.select_related('field', 'agent').all()

    def get_permissions(self):
        """
        Apply different permission stacks depending on the action.

        Why get_permissions() instead of a single permission_classes list?
        We need role-based access that differs per HTTP method:
        - Only field agents can CREATE (POST) reports.
        - Coordinators can only READ (GET) reports.
        - No one can edit or delete reports through the API
          (data integrity: monitoring records are immutable once submitted).

        get_permissions() runs before the view logic and returns a list of
        instantiated permission objects. Returning different lists per action
        gives us method-level access control without building two ViewSets.
        """
        if self.action == 'create':
            # POST /api/reports/ — only verified field agents
            return [IsAuthenticated(), IsFieldAgent()]

        # list() and retrieve() — both coordinators and field agents can read
        return [IsAuthenticated()]

    def update(self, request, *args, **kwargs):
        """PUT /api/reports/{id}/ — disabled. Reports are immutable once submitted."""
        return Response(
            {'detail': 'Monitoring reports cannot be edited once submitted.'},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    def partial_update(self, request, *args, **kwargs):
        """PATCH /api/reports/{id}/ — disabled. Reports are immutable once submitted."""
        return Response(
            {'detail': 'Monitoring reports cannot be edited once submitted.'},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    def destroy(self, request, *args, **kwargs):
        """DELETE /api/reports/{id}/ — disabled. Reports are immutable once submitted."""
        return Response(
            {'detail': 'Monitoring reports cannot be deleted.'},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    def perform_create(self, serializer):
        """
        Called by create() after serializer validation, just before saving.

        We inject agent=request.user here so agents cannot submit reports
        on behalf of other agents. The agent FK is never accepted from the
        request body — it is always derived from the authenticated user.

        The field FK comes from field_id in the validated data, already
        scoped to the agent's assigned fields by the serializer's __init__.
        """
        serializer.save(agent=self.request.user)
