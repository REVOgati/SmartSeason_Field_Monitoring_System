from django.db import models
from django.conf import settings


class FieldReport(models.Model):
    """
    A monitoring report submitted by a field agent for one of their assigned fields.

    This is the core data record of the SmartSeason system.
    Every time an agent visits a field, they submit a FieldReport capturing the
    current state of the crop, soil, and any pest activity.

    Relationships:
    - field    → many reports can belong to one field (one field visited many times)
    - agent    → many reports can come from one agent (one agent visits many fields)

    Both FKs use SET_NULL so that if a field or user account is deactivated
    or deleted, the historical report record is preserved intact.
    We never delete monitoring data — it is the scientific record of the farm.
    """

    CROP_HEALTH_CHOICES = [
        ('excellent', 'Excellent'),
        ('good',      'Good'),
        ('fair',      'Fair'),
        ('poor',      'Poor'),
    ]
    # Four-level health scale — simple enough for agents to assess in the field,
    # granular enough to track meaningful degradation over time.
    # Stored as lowercase strings in the DB, displayed as Title Case in the admin.

    field = models.ForeignKey(
        'fields.Field',
        # String reference ('fields.Field') avoids circular imports at module load time.
        # Django resolves this string to the actual model class when it builds the app registry.
        on_delete=models.SET_NULL,
        # SET_NULL: if the Field record is deleted, the report remains with field=NULL.
        # We lose the link but keep the data — historical records must not silently vanish.
        null=True,
        related_name='reports',
        # field_instance.reports.all() → all reports ever submitted for this field.
        # Used by the coordinator dashboard to see the monitoring history of a field.
    )

    agent = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        # settings.AUTH_USER_MODEL resolves to 'users.User' — standard Django pattern
        # for referencing the custom User model safely from any app.
        on_delete=models.SET_NULL,
        # SET_NULL: if the agent account is deleted, the report is preserved.
        # The agent who submitted it may be gone, but the field data was real.
        null=True,
        related_name='submitted_reports',
        # agent_user.submitted_reports.all() → the personal work history of an agent.
    )

    report_date = models.DateField()
    # The calendar date the agent physically visited and observed the field.
    # Separate from submitted_at so reports can be backdated slightly
    # (e.g., agent visits Wednesday evening, submits report Thursday morning;
    # report_date=Wednesday, submitted_at=Thursday).

    crop_health = models.CharField(
        max_length=20,
        choices=CROP_HEALTH_CHOICES,
    )
    # CharField with choices: Django stores the short code ('excellent') in the DB
    # and validates that only valid choices can be saved.
    # The browsable API and admin both show the human-readable display name.

    soil_moisture = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        # Stores values like 73.45 — a percentage, so range is 0.00 to 100.00.
        # max_digits=5 supports 100.00 (5 significant digits total).
    )

    pest_observed = models.BooleanField(default=False)
    # Simple flag: True if any pest activity was seen, False otherwise.
    # A boolean is sufficient for triggering alerts;
    # the notes field captures what type of pest if True.

    notes = models.TextField(blank=True, default='')
    # Free-text observations from the agent.
    # blank=True: optional — not every visit has noteworthy observations.
    # default='': avoids NULLs in the text column (empty string is cleaner than NULL for text).

    photo = models.ImageField(
        upload_to='report_photos/',
        null=True,
        blank=True,
        # Optional: agents can attach a photo of the field condition.
        # upload_to='report_photos/' stores files under MEDIA_ROOT/report_photos/.
        # null=True: when no photo is uploaded, the DB column stores NULL (not an empty string).
        # ImageField requires Pillow (already installed) for format validation.
    )

    submitted_at = models.DateTimeField(auto_now_add=True)
    # Exact timestamp when the record was first saved to the database.
    # auto_now_add=True: set once on creation, never editable — tamper-proof audit trail.
    # Different from report_date which is the observation date (see above).

    class Meta:
        verbose_name        = 'Field Report'
        verbose_name_plural = 'Field Reports'
        ordering            = ['-submitted_at']
        # Default ordering: most recently submitted reports appear first in all queries
        # and in the Django Admin list view.

    def __str__(self):
        field_name = self.field.name if self.field else 'Unknown Field'
        agent_name = self.agent.full_name if self.agent else 'Unknown Agent'
        return f"{field_name} | {self.report_date} | {agent_name} | {self.crop_health}"
