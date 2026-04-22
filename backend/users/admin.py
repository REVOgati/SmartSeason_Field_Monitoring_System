from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User

@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ['email', 'full_name', 'role', 'is_verified', 'is_active', 'date_joined']
    list_filter = ['role', 'is_verified', 'is_active']
    search_fields = ['email', 'full_name']
    ordering = ['-date_joined']
    readonly_fields = ['date_joined', 'last_login']

    fieldsets = (
        ('Login Info', {'fields': ('email', 'password')}),
        ('Personal', {'fields': ('full_name', 'profile_photo')}),
        ('Role & Access', {'fields': ('role', 'is_verified', 'is_active', 'is_staff', 'is_superuser')}),
        ('Permissions', {'fields': ('groups', 'user_permissions')}),
        ('Dates', {'fields': ('date_joined', 'last_login')}),
    )

    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'full_name', 'role', 'password1', 'password2'),
        }),
    )

    @admin.action(description='Approve selected accounts (set verified + active)')
    def approve_accounts(self, request, queryset):
        queryset.update(is_verified=True, is_active=True)

    actions = ['approve_accounts']
