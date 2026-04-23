from django.db import models
from django.conf import settings


class Field(models.Model):
    """
    Represents a farm field in the SmartSeason system.

    Ownership structure:
    - A coordinator (ForeignKey) owns/manages this field.
      Many fields can belong to one coordinator (one-to-many).
    - A field agent (ForeignKey, nullable) is assigned to monitor this field.
      Each field has exactly one responsible agent.
      One agent can be assigned to multiple fields across the system.

    Field name and crop type are free text — no predefined choices —
    because the system must accommodate any crop or custom naming.
    """

    name = models.CharField(
        max_length=255,
        # Free text — coordinators enter any field name they choose
    )

    location = models.CharField(
        max_length=255,
        # Physical location of the field e.g. "Nakuru, Kenya" or GPS description
    )

    size_in_acres = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        # max_digits=8, decimal_places=2 supports sizes up to 999999.99 acres
        null=True
    )

    crop_type = models.CharField(
        max_length=100,
        # Free text — coordinators enter the actual crop e.g. "Maize", "French Beans"
        # No fixed choices because crop variety is open-ended in the field
    )

    coordinator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        # We reference AUTH_USER_MODEL (string) instead of importing User directly.
        # This avoids circular imports and keeps the reference flexible.
        on_delete=models.PROTECT,
        # PROTECT: if someone tries to delete a coordinator who still owns fields,
        # Django refuses the deletion. Prevents accidental data loss.
        # CASCADE would silently delete all their fields — too dangerous.
        related_name='coordinated_fields',
        # related_name lets us go backwards: coordinator_user.coordinated_fields.all()
        # returns all fields owned by that coordinator.
        limit_choices_to={'role': 'coordinator'},
        # In the admin panel, only users with role=coordinator appear in the dropdown.
        # This does not enforce at DB level — serializer handles that later.
    )

    assigned_agent = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        # Each field has exactly ONE responsible field agent.
        # A ForeignKey here (not ManyToManyField) enforces this one-agent-per-field rule.
        on_delete=models.SET_NULL,
        # SET_NULL: if the agent account is deleted, the field remains but assigned_agent
        # becomes null. The coordinator can then reassign a new agent.
        null=True,
        blank=True,
        # null=True: allows the database column to store NULL (no agent yet)
        # blank=True: makes the field optional in forms and admin
        # A coordinator can create a field first and assign an agent later.
        related_name='assigned_fields',
        # agent_user.assigned_fields.all() returns all fields assigned to that agent
        limit_choices_to={'role': 'field_agent'},
        # Only field_agent role users appear in the admin dropdown for this field
    )

    is_active = models.BooleanField(
        default=True,
        # Active fields are being monitored. Inactive fields are archived.
        # We deactivate rather than delete to preserve historical monitoring data.
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
        # auto_now_add: set once when the record is first created. Never changes again.
    )

    updated_at = models.DateTimeField(
        auto_now=True,
        # auto_now: updated every time the record is saved, whether on creation or edit.
    )

    class Meta:
        verbose_name        = 'Field'
        verbose_name_plural = 'Fields'
        ordering            = ['-created_at']
        # Default ordering: newest fields appear first in all queries

    def __str__(self):
        agent_name = self.assigned_agent.full_name if self.assigned_agent else 'Unassigned'
        return f"{self.name} | {self.crop_type} | Agent: {agent_name}"
