from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User


class CoordinatedFieldsInline(admin.TabularInline):
    """
    Inline table inside a coordinator's page — shows fields they own.
    """
    model = None  # set dynamically below
    fk_name = 'coordinator'
    extra = 0
    readonly_fields = ['created_at', 'is_active']
    fields = ['name', 'crop_type', 'location', 'assigned_agent', 'is_active', 'created_at']
    can_delete = False
    show_change_link = True


class TeamAgentsInline(admin.TabularInline):
    """
    Inline table inside a coordinator's page — shows all field agents under them.
    Uses the coordinator FK on the User model (team_agents related_name).
    A coordinator sees their full team on one page alongside their fields.
    """
    model = User
    fk_name = 'coordinator'
    # fk_name specifies which FK on User points back to the coordinator.
    # This is necessary because User has multiple FKs to itself potentially.
    extra = 0
    fields = ['full_name', 'email', 'is_verified', 'is_active']
    readonly_fields = ['full_name', 'email', 'is_verified', 'is_active']
    # All read-only — agent details are managed on their own user page
    can_delete = False
    show_change_link = True
    verbose_name = 'Team Agent'
    verbose_name_plural = 'Team Agents'


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ['email', 'full_name', 'role', 'coordinator', 'is_verified', 'is_active', 'field_count', 'date_joined']
    # coordinator column shows which coordinator a field agent belongs to (null for others)
    # field_count is a computed column — defined as a method below
    list_filter = ['role', 'is_verified', 'is_active']
    search_fields = ['email', 'full_name']
    ordering = ['-date_joined']
    readonly_fields = ['date_joined', 'last_login']

    fieldsets = (
        ('Login Info',    {'fields': ('email', 'password')}),
        ('Personal',      {'fields': ('full_name', 'profile_photo')}),
        ('Role & Access', {'fields': ('role', 'is_verified', 'is_active', 'is_staff', 'is_superuser')}),
        ('Team Assignment', {
            'fields': ('coordinator',),
            # Only relevant for field_agent accounts.
            # This FK records which coordinator this agent belongs to.
            # Coordinators and superusers leave this as NULL.
            'classes': ('collapse',),  # collapsed by default — not relevant for all roles
        }),
        ('Permissions',   {'fields': ('groups', 'user_permissions')}),
        ('Dates',         {'fields': ('date_joined', 'last_login')}),
    )

    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'full_name', 'role', 'coordinator', 'password1', 'password2'),
        }),
    )

    def get_inlines(self, request, obj):
        """
        Show different inlines depending on the user's role:
        - Coordinator: shows CoordinatedFieldsInline (fields they own)
                       and TeamAgentsInline (agents under them)
        - Field agent: no inline (their fields are visible via the Fields admin)
        - Superuser: no inline
        obj is None when creating a brand new user — no inlines yet.
        """
        if obj and obj.role == 'coordinator':
            return [CoordinatedFieldsInline, TeamAgentsInline]
        return []

    @admin.display(description='Fields Owned')
    def field_count(self, obj):
        """
        Computed column in the user list.
        For coordinators: shows how many fields they own.
        For other roles: shows a dash.

        @admin.display sets the column header text to 'Fields Owned'.
        This method receives obj — the specific User row being rendered.
        """
        if obj.role == 'coordinator':
            return obj.coordinated_fields.count()
            # .count() is a single efficient COUNT(*) SQL query — does not load all records
        return '-'

    def save_model(self, request, obj, form, change):
        """
        Overrides the default save behaviour when a User is saved from the admin panel.

        Parameters:
          request — the HTTP request from the admin user performing the save
          obj     — the User instance being saved
          form    — the admin form with the submitted data
          change  — True if editing an existing record, False if creating a new one

        Use case here: whenever a superuser manually sets is_verified=True,
        we also force is_active=True at the same time, even if they forgot to tick it.
        This prevents the situation where a user is verified but still cannot log in.
        """
        if obj.is_verified and not obj.is_active:
            obj.is_active = True
            # Automatically activate if verified — keeps the two flags in sync
        super().save_model(request, obj, form, change)
        # super() calls the original Django save_model — must always call this
        # otherwise the record never actually gets saved to the database

    @admin.action(description='Approve selected accounts (set verified + active)')
    def approve_accounts(self, request, queryset):
        queryset.update(is_verified=True, is_active=True)

    @admin.action(description='Deactivate selected accounts')
    def deactivate_accounts(self, request, queryset):
        """
        Bulk deactivate accounts without deleting them.
        Useful for suspending access temporarily.
        """
        queryset.update(is_active=False)

    actions = ['approve_accounts', 'deactivate_accounts']


# Set the inline model here after both classes are defined to avoid the circular import
# We import Field here at the bottom — by this point users/models.py is fully loaded
from fields.models import Field
CoordinatedFieldsInline.model = Field

