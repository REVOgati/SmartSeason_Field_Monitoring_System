from rest_framework import serializers
from .models import FieldReport
from users.serializers import UserPublicSerializer
from fields.serializers import FieldSerializer
from fields.models import Field


class FieldReportSerializer(serializers.ModelSerializer):
    """
    Used for: all FieldReport CRUD endpoints under /api/reports/

    Two concerns this serializer handles:
    1. READ  — return a rich nested object so the frontend has everything it needs
               without making additional API calls.
    2. WRITE — accept only the minimum fields from the agent; server-side logic
               injects the agent FK and validates field ownership.

    Read/write split pattern (same as FieldSerializer in fields/):
    - 'field'  (read) → nested FieldSerializer object    — full detail for display
    - 'field_id' (write) → PrimaryKeyRelatedField         — agent sends just a PK
    - 'agent'  (read) → nested UserPublicSerializer object
    - agent is set automatically in perform_create() — agent never sends their own PK
    """

    # --- READ fields (nested objects, output only) ---

    field = FieldSerializer(read_only=True)
    # On GET responses, 'field' is expanded to a full Field JSON object, e.g.:
    # "field": { "id": 3, "name": "Alpha Farm", "crop_type": "Maize", ... }
    # This is read_only because we use field_id for writes (see below).

    agent = UserPublicSerializer(read_only=True)
    # On GET responses, 'agent' is expanded to { "id": 5, "email": "...", ... }
    # Never writable — the agent is always set from request.user in the view.

    # --- WRITE fields (flat PKs, input only) ---

    field_id = serializers.PrimaryKeyRelatedField(
        source='field',
        # 'source=field' tells DRF that field_id maps to the 'field' model attribute.
        # When validated_data is built, it will contain {'field': <Field instance>}
        # which is exactly what FieldReport.objects.create() expects.
        queryset=Field.objects.all(),
        # Class-level placeholder: DRF requires a non-None queryset at definition time.
        # __init__ below replaces this with a user-scoped queryset on every request,
        # narrowing it to only the fields assigned to the current agent.
        write_only=True,
        # write_only=True: accepted on POST/PATCH but never included in GET responses.
        # The nested 'field' object already covers the read side.
    )

    class Meta:
        model  = FieldReport
        fields = [
            'id',
            'field',       # read (nested)
            'field_id',    # write (PK)
            'agent',       # read (nested, auto-set)
            'report_date',
            'crop_health',
            'soil_moisture',
            'pest_observed',
            'notes',
            'photo',
            'submitted_at',
        ]
        read_only_fields = ['id', 'agent', 'submitted_at']
        # id         — DB-assigned, never user-supplied
        # agent      — set from request.user in perform_create(); agents cannot
        #              submit reports on behalf of other agents
        # submitted_at — auto_now_add, tamper-proof audit timestamp

    def __init__(self, *args, **kwargs):
        """
        Dynamically scope the field_id queryset to only fields assigned to
        the current agent (request.user).

        Why __init__ and not a class-level queryset on field_id?
        A class-level queryset is evaluated ONCE when the module loads —
        at that point there is no request and no user.
        __init__ runs on every request, so request.user is available.

        Security guarantee:
        If an agent tries to submit a report for a field that isn't theirs
        (e.g. by guessing a field PK), DRF will reject the input with a
        validation error: "Invalid pk — object does not exist."
        The queryset filter is the enforcement mechanism.

        This mirrors the same pattern used in FieldSerializer for agent assignment.
        """
        super().__init__(*args, **kwargs)

        request = self.context.get('request')
        if request and hasattr(request, 'user') and request.user.is_authenticated:
            # Scope to fields assigned to this specific agent.
            # agent_user.assigned_fields is the reverse FK defined on Field.assigned_agent.
            self.fields['field_id'].queryset = request.user.assigned_fields.all()
        else:
            # Fallback: empty queryset — no field is valid without an authenticated user.
            # In practice this path is never reached because the view requires auth.
            self.fields['field_id'].queryset = Field.objects.none()
