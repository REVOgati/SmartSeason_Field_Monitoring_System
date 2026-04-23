from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from .models import Field
from .serializers import FieldSerializer
from users.permissions import IsCoordinator, IsFieldOwner


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
