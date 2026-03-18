from django.urls import path
from .views import (
    DocumentDeleteView,
    DocumentDownloadView,
    DocumentListView,
    DocumentRegisterView,
    PresignedUploadView,
)

urlpatterns = [
    path("", DocumentListView.as_view(), name="document-list"),
    path("presigned-upload/", PresignedUploadView.as_view(), name="document-presigned-upload"),
    path("register/", DocumentRegisterView.as_view(), name="document-register"),
    path("<uuid:pk>/download/", DocumentDownloadView.as_view(), name="document-download"),
    path("<uuid:pk>/", DocumentDeleteView.as_view(), name="document-delete"),
]
