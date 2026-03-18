"""
JurisAgenda - Root URLconf
"""
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)

# Health checks
from core.health import health_check, health_check_db, health_check_redis, health_check_minio

urlpatterns = [
    # Admin
    path("admin/", admin.site.urls),

    # API v1
    path("api/v1/auth/", include("accounts.urls.auth")),
    path("api/v1/events/", include("events.urls")),
    path("api/v1/followups/", include("followups.urls")),
    path("api/v1/documents/", include("documents.urls")),
    path("api/v1/tv/", include("tv.urls")),
    path("api/v1/clients/", include("clients.urls")),

    # OpenAPI / Swagger
    path("api/v1/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/v1/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/v1/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),

    # Health checks
    path("api/v1/health/", health_check, name="health"),
    path("api/v1/health/db/", health_check_db, name="health-db"),
    path("api/v1/health/redis/", health_check_redis, name="health-redis"),
    path("api/v1/health/minio/", health_check_minio, name="health-minio"),
]
