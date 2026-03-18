from django.contrib import admin
from .models import EventFollowUp


@admin.register(EventFollowUp)
class EventFollowUpAdmin(admin.ModelAdmin):
    list_display = ["event", "outcome", "created_by", "created_at"]
    list_filter = ["outcome"]
    search_fields = ["event__title", "created_by__email"]
    readonly_fields = ["id", "timeline_log", "created_at", "updated_at"]
    raw_id_fields = ["event", "next_event", "created_by"]
