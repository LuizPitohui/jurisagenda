"""documents/views.py — Thin Views."""
from django.shortcuts import redirect
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsAdminOrLawyerOrSecretary
from events.models import Event

from .models import EventDocument
from .serializers import (
    DocumentRegisterSerializer,
    EventDocumentSerializer,
    PresignedUploadRequestSerializer,
    PresignedUploadResponseSerializer,
)
from .services import DocumentService


class PresignedUploadView(APIView):
    """POST /api/v1/documents/presigned-upload/"""
    permission_classes = [IsAdminOrLawyerOrSecretary]

    def post(self, request):
        serializer = PresignedUploadRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        result = DocumentService.generate_presigned_upload_url(
            event_id=str(data["event_id"]),
            file_name=data["file_name"],
            content_type=data["content_type"],
            file_size=data["file_size"],
            uploaded_by=request.user,
        )
        return Response(PresignedUploadResponseSerializer(result).data)


class DocumentRegisterView(APIView):
    """
    POST /api/v1/documents/register/
    Chamado após upload direto ao MinIO para registrar metadados no banco.
    """
    permission_classes = [IsAdminOrLawyerOrSecretary]

    def post(self, request):
        serializer = DocumentRegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        event = generics.get_object_or_404(Event, pk=data["event_id"])
        doc = DocumentService.register_document(
            event=event,
            file_name=data["file_name"],
            minio_key=data["minio_key"],
            content_type=data["content_type"],
            file_size=data["file_size"],
            uploaded_by=request.user,
        )
        return Response(EventDocumentSerializer(doc).data, status=status.HTTP_201_CREATED)


class DocumentDownloadView(APIView):
    """
    GET /api/v1/documents/{id}/download/
    TC-005: retorna redirect 302 para URL pré-assinada de download (TTL 1h).
    """
    permission_classes = [IsAdminOrLawyerOrSecretary]

    def get(self, request, pk):
        doc = generics.get_object_or_404(EventDocument, pk=pk, is_deleted=False)
        url = DocumentService.generate_presigned_download_url(doc, requested_by=request.user)
        return redirect(url)


class DocumentListView(generics.ListAPIView):
    """GET /api/v1/documents/?event_id=<uuid>"""
    permission_classes = [IsAdminOrLawyerOrSecretary]
    serializer_class = EventDocumentSerializer

    def get_queryset(self):
        event_id = self.request.query_params.get("event_id")
        qs = EventDocument.objects.filter(is_deleted=False).select_related(
            "event", "uploaded_by"
        )
        if event_id:
            qs = qs.filter(event_id=event_id)
        return qs


class DocumentDeleteView(APIView):
    """DELETE /api/v1/documents/{id}/ — Remove referência DB e objeto MinIO."""
    permission_classes = [IsAdminOrLawyerOrSecretary]

    def delete(self, request, pk):
        doc = generics.get_object_or_404(EventDocument, pk=pk, is_deleted=False)
        DocumentService.delete_document(doc, deleted_by=request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)
