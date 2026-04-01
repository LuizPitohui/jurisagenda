from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import EventViewSet
from .reports import EventReportsView

router = DefaultRouter()
router.register(r"", EventViewSet, basename="event")

# IMPORTANTE: reports/ deve vir ANTES do router para não ser capturado como {pk}
urlpatterns = [
    path("reports/", EventReportsView.as_view(), name="event-reports"),
] + [url for url in router.urls if not str(url.pattern).startswith('reports')]
