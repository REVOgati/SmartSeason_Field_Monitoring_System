from django.contrib import admin
from .models import FieldReport


@admin.register(FieldReport)
class FieldReportAdmin(admin.ModelAdmin):
    """
    Admin configuration for FieldReport.

    List view shows the most useful columns for a superuser or coordinator
    reviewing submitted reports. All list columns are read-only records —
    reports are submitted via the API and should not be edited manually.

    search_fields enables the search box in the admin list view.
    date_hierarchy adds a drill-down date navigator above the list.
    """

    list_display = [
        'field',
        'agent',
        'report_date',
        'crop_health',
        'soil_moisture',
        'pest_observed',
        'submitted_at',
    ]
    # Columns shown in the admin list table.
    # 'field' and 'agent' call __str__() on those FK objects.

    list_filter = ['crop_health', 'pest_observed', 'report_date']
    # Sidebar filters: quickly narrow to all 'poor' health reports,
    # all reports where pests were observed, or reports from a specific date.

    search_fields = ['field__name', 'agent__full_name', 'notes']
    # Admin search box: finds reports by the field's name, the agent's name,
    # or text anywhere in the notes field.
    # Double-underscore follows the FK relationship: field__name means
    # FieldReport.field.name in SQL.

    date_hierarchy = 'report_date'
    # Adds a clickable year → month → day drill-down navigator above the list.
    # Useful for reviewing reports from a specific growing season.

    readonly_fields = ['submitted_at']
    # submitted_at is auto-set on creation and must never be edited.
    # Marking it readonly prevents accidental changes in the edit form.

    ordering = ['-submitted_at']
    # Show newest reports first in the admin list.
