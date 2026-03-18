from django.contrib import admin
from .models import TVCallLog


@admin.register(TVCallLog)
class TVCallLogAdmin(admin.ModelAdmin):
    list_display = ["tv_code", "event_type", "priority", "status", "called_at", "confirmed_at"]
    list_filter = ["status", "priority", "event_type"]
    search_fields = ["tv_code"]
    readonly_fields = ["id", "tv_code", "event_type", "priority", "called_at", "confirmed_at"]
    ordering = ["-called_at"]

    def has_add_permission(self, request):
        return False
