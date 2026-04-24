from rest_framework import serializers
from .models import Field
from users.serializers import UserPublicSerializer
from users.models import User


class FieldSerializer(serializers.ModelSerializer):
    """
    Used for: all Field CRUD endpoints — list, retrieve, create, update.

    This serializer demonstrates three important DRF techniques:
    1. Nested serializer — embeds coordinator's info as a sub-object in the output
    2. SerializerMethodField — adds a computed value that is not a model field
    3. source= — remapping a field name in the output without changing the model

    --- READING (GET) ---
    Output JSON looks like:
    {
        "id": 1,
        "name": "Alpha Farm",
        "location": "Nakuru, Kenya",
        "size_in_acres": "12.50",
        "crop_type": "Maize",
        "coordinator": {
            "id": 3,
            "email": "coord@example.com",
            "full_name": "Jane Coord",
            "role": "coordinator"
        },
        "assigned_agent": {
            "id": 7,
            "email": "agent@example.com",
            "full_name": "John Agent",
            "role": "field_agent"
        },
        "is_active": true,
        "created_at": "2026-04-01T09:00:00Z",
        "updated_at": "2026-04-20T14:30:00Z",
        "assigned_agent_id": 7
    }

    --- WRITING (POST / PATCH) ---
    On input, coordinator and assigned_agent are NOT in the writable fields.
    - coordinator is auto-set in the view (perform_create) to request.user
    - assigned_agent is set via a dedicated /assign-agent/ endpoint (Session 12)
    For updates (PATCH), only name/location/size_in_acres/crop_type/is_active change.
    """

    coordinator = UserPublicSerializer(read_only=True)
    # Nested serializer — instead of returning coordinator_id: 3
    # this returns the full coordinator sub-object shown above.
    # read_only=True: this nested representation is only for output.
    # When creating a field, the coordinator is set in the view — not entered by the user.
    # If read_only were False, DRF would expect a nested dict as input, which is messy.

    assigned_agent = UserPublicSerializer(read_only=True)
    # Same pattern for the agent — embedded sub-object on read, set separately on write.

    assigned_agent_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.none(),
        # queryset=none() as a safe default — overridden in __init__ below
        # This field accepts an agent ID on input: { "assigned_agent_id": 7 }
        # source='assigned_agent' tells DRF that this field maps to the model's
        # assigned_agent column, even though the input key is assigned_agent_id.
        source='assigned_agent',
        required=False,
        allow_null=True,
        write_only=True,
        # write_only=True: this field is accepted on input but NOT returned in output.
        # The output uses the nested assigned_agent object instead.
        # Having both is intentional: read = nested object, write = plain ID.
    )

    class Meta:
        model  = Field
        fields = [
            'id',
            'name',
            'location',
            'size_in_acres',
            'crop_type',
            'coordinator',       # read: nested coordinator object
            'assigned_agent',    # read: nested agent object
            'assigned_agent_id', # write: accepts an agent ID to assign
            'is_active',
            'created_at',
            'updated_at',
            # Coordinator-set expected dates
            'expected_farm_prep_date',
            'expected_planting_date',
            'expected_emergence_date',
            'expected_harvest_date',
            'expected_ready_date',
            # Agent-realized actual dates (read by all, written by agent via realized-dates action)
            'realized_farm_prep_date',
            'realized_planting_date',
            'realized_emergence_date',
            'realized_harvest_date',
            'realized_ready_date',
        ]
        read_only_fields = ['id', 'coordinator', 'created_at', 'updated_at']
        # id — assigned by the database
        # coordinator — set by the view, not by user input
        # created_at, updated_at — timestamps managed by auto_now/auto_now_add

    def __init__(self, *args, **kwargs):
        """
        __init__ runs every time the serializer is instantiated.
        We use it to dynamically set the queryset for assigned_agent_id.

        Why can't we just put the queryset directly as a class attribute?
        Because we need to access `self.context['request']` to know the
        current user, which is only available at request time — not at
        class definition time. Class attributes are evaluated once when the
        class is loaded, before any requests exist.

        self.context is a dictionary passed automatically by DRF when it
        creates a serializer from a view. It contains:
        - 'request': the current HTTP request (with request.user)
        - 'view':    the view instance
        - 'format':  the format suffix if any

        Here we restrict the valid choices for assigned_agent_id to only
        the coordinator's own verified team — enforcing team isolation.
        """
        super().__init__(*args, **kwargs)
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            self.fields['assigned_agent_id'].queryset = (
                User.field_agents.for_coordinator(request.user)
                # from Session 5's FieldAgentManager — returns verified agents
                # whose coordinator FK points to the requesting coordinator.
                # If someone passes an agent ID from a different team, DRF
                # will raise a validation error: "Invalid pk — object does not exist."
            )

    def validate_size_in_acres(self, value):  # noqa: D401
        """
        Field-level validator for size_in_acres.

        DRF calls this automatically when validating the size_in_acres field.
        `value` is the already type-validated number from the incoming JSON.

        A field of 0 or negative acres makes no physical sense.
        This catches user input errors before they reach the database.
        """
        if value is not None and value <= 0:
            raise serializers.ValidationError(
                "Field size must be a positive number."
            )
        return value


class AgentRealizedDatesSerializer(serializers.ModelSerializer):
    """
    Minimal serializer used exclusively by the `realized-dates` PATCH action.

    Accepts only the 4 realized date fields so that an agent cannot accidentally
    overwrite any coordinator-controlled data (name, location, expected dates, etc.)
    through this endpoint.

    All fields are optional (partial updates allowed) so that the agent can
    submit just one date at a time if they choose.
    """

    class Meta:
        model  = Field
        fields = [
            'realized_farm_prep_date',
            'realized_planting_date',
            'realized_emergence_date',
            'realized_harvest_date',
            'realized_ready_date',
        ]
