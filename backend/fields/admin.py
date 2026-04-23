from django.contrib import admin
from .models import Field


@admin.register(Field)
class FieldAdmin(admin.ModelAdmin):
    """
    Admin configuration for the Field model.
    """

    list_display = ['name', 'crop_type', 'coordinator', 'agent_status', 'location', 'size_in_acres', 'is_active']
    # agent_status is a computed column defined as a method below

    list_filter = ['is_active']
    # Removed crop_type from list_filter since it is now free text — filtering
    # by free text produces too many filter options to be useful in the sidebar

    search_fields = ['name', 'location', 'crop_type', 'coordinator__email', 'assigned_agent__email']
    # Double underscore traverses the ForeignKey relationship to search related fields

    readonly_fields = ['created_at', 'updated_at']

    list_per_page = 25
    # How many records to show per page in the admin list. Default is 100.

    date_hierarchy = 'created_at'
    # Adds a date drill-down bar at the top of the list — click year → month → day
    # to filter records by creation date. Useful for tracking when fields were added.

    fieldsets = (
        ('Field Info', {
            'fields': ('name', 'location', 'size_in_acres', 'crop_type', 'is_active')
        }),
        ('Assignment', {
            'fields': ('coordinator', 'assigned_agent'),
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
        }),
    )

    @admin.display(description='Agent Status')
    def agent_status(self, obj):
        """
        Computed column showing whether a field has an agent assigned.
        obj is the specific Field row being rendered in the list.
        Returns the agent's name if assigned, or 'Unassigned' if not.
        This is read-only display — it does not store anything in the database.
        """
        if obj.assigned_agent:
            return obj.assigned_agent.full_name
        return 'Unassigned'

    def save_model(self, request, obj, form, change):
        """
        Custom save logic for Field records saved from the admin panel.
        When a superuser assigns an agent to a field, we verify that
        the chosen user actually has the field_agent role before saving.
        This is a safety guard on top of the limit_choices_to filter.
        """
        if obj.assigned_agent and obj.assigned_agent.role != 'field_agent':
            # Reset the invalid assignment rather than silently saving wrong data
            obj.assigned_agent = None
        super().save_model(request, obj, form, change)

    @admin.action(description='Deactivate selected fields')
    def deactivate_fields(self, request, queryset):
        """
        Bulk deactivate fields. Deactivated fields are archived —
        their historical monitoring data is preserved but they no longer
        appear as active in coordinator dashboards.
        """
        queryset.update(is_active=False)

    @admin.action(description='Activate selected fields')
    def activate_fields(self, request, queryset):
        queryset.update(is_active=True)

    actions = ['deactivate_fields', 'activate_fields']

    def get_queryset(self, request):
        """
        Override the default admin queryset to use select_related.
        Without this, loading the Fields list page triggers N+1 queries —
        one extra query per field to fetch its coordinator and assigned_agent.
        select_related fetches everything in a single SQL JOIN query.
        """
        return super().get_queryset(request).select_related(
            'coordinator',
            'assigned_agent'
        )

