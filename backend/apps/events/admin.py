from django.contrib import admin
from .models import Event


@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = ["title", "event_type", "start_datetime", "status", "assigned_to", "tv_enabled", "tv_code"]
    list_filter = ["event_type", "status", "tv_enabled"]
    search_fields = ["title", "process_number", "tv_code", "client__full_name"]
    raw_id_fields = ["client", "assigned_to"]
    readonly_fields = ["id", "tv_code", "created_at", "updated_at"]
    ordering = ["-start_datetime"]

    fieldsets = (
        ("Informações Gerais", {
            "fields": ("id", "title", "event_type", "status", "notes", "color_tag")
        }),
        ("Data e Local", {
            "fields": ("start_datetime", "end_datetime", "location", "video_link", "due_date")
        }),
        ("Partes", {
            "fields": ("client", "process_number", "assigned_to", "supplier_name")
        }),
        ("Painel TV", {
            "fields": ("tv_enabled", "tv_priority", "tv_code", "tv_call_confirmed")
        }),
        ("Auditoria", {
            "fields": ("created_at", "updated_at"),
            "classes": ("collapse",)
        }),
    )
