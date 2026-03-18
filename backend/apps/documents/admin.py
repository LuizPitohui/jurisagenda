from django.contrib import admin
from .models import EventDocument


@admin.register(EventDocument)
class EventDocumentAdmin(admin.ModelAdmin):
    list_display = ["file_name", "event", "content_type", "file_size_mb", "uploaded_by", "created_at", "is_deleted"]
    list_filter = ["content_type", "is_deleted"]
    search_fields = ["file_name", "event__title", "uploaded_by__email"]
    readonly_fields = ["id", "minio_key", "created_at", "updated_at"]
    raw_id_fields = ["event", "uploaded_by"]

    def has_add_permission(self, request):
        return False
