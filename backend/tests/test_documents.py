"""
tests/test_documents.py

TC-005: Download de documento deve retornar redirect 302 com URL pré-assinada válida.
TC-006: Upload acima de 50MB deve retornar 400 com mensagem de erro descritiva.
"""
import pytest
from unittest.mock import MagicMock, patch

from .conftest import EventDocumentFactory, EventFactory


@pytest.mark.django_db
class TestDocumentUploadValidation:

    def test_tc006_file_above_50mb_returns_400(self, authenticated_client, sample_event):
        """TC-006: Arquivo > 50MB → 400 com mensagem descritiva."""
        fifty_one_mb = 51 * 1024 * 1024

        response = authenticated_client.post(
            "/api/v1/documents/presigned-upload/",
            {
                "event_id": str(sample_event.id),
                "file_name": "arquivo_gigante.pdf",
                "content_type": "application/pdf",
                "file_size": fifty_one_mb,
            },
            format="json",
        )

        assert response.status_code == 400, (
            f"Esperado 400 para arquivo >50MB, obteve {response.status_code}"
        )
        error_text = str(response.json()).lower()
        # Mensagem deve ser descritiva (spec seção 8.2.1 TC-006)
        assert any(word in error_text for word in ["50mb", "50", "tamanho", "excede", "máximo"]), (
            f"Mensagem de erro não é descritiva: {response.json()}"
        )

    def test_file_exactly_50mb_is_allowed_at_service_level(self, lawyer_user, sample_event):
        """Arquivo exatamente 50MB deve passar na validação de tamanho."""
        from documents.services import DocumentService
        from unittest.mock import patch, MagicMock

        fifty_mb = 50 * 1024 * 1024

        with patch("documents.services._get_s3_client") as mock_s3:
            mock_client = MagicMock()
            mock_s3.return_value = mock_client
            mock_client.generate_presigned_url.return_value = "https://minio/presigned"

            result = DocumentService.generate_presigned_upload_url(
                event_id=str(sample_event.id),
                file_name="arquivo_limite.pdf",
                content_type="application/pdf",
                file_size=fifty_mb,
                uploaded_by=lawyer_user,
            )

        assert "upload_url" in result

    def test_disallowed_content_type_returns_400(self, authenticated_client, sample_event):
        """Tipo MIME não permitido → 400."""
        response = authenticated_client.post(
            "/api/v1/documents/presigned-upload/",
            {
                "event_id": str(sample_event.id),
                "file_name": "malware.exe",
                "content_type": "application/x-msdownload",
                "file_size": 1024,
            },
            format="json",
        )
        assert response.status_code == 400
        assert "content_type" in str(response.json()).lower() or "tipo" in str(response.json()).lower()

    def test_allowed_content_types_accepted(self, lawyer_user, sample_event):
        """Todos os tipos permitidos devem passar na validação."""
        from documents.models import EventDocument

        allowed = [
            "application/pdf",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/msword",
            "image/png",
            "image/jpeg",
            "text/plain",
        ]
        for ct in allowed:
            assert EventDocument.is_allowed_content_type(ct), (
                f"Tipo '{ct}' deveria ser permitido mas foi rejeitado"
            )


@pytest.mark.django_db
class TestDocumentDownload:

    def test_tc005_download_returns_302_redirect(self, authenticated_client, lawyer_user, sample_event):
        """TC-005: GET /api/v1/documents/{id}/download/ → 302 com URL pré-assinada."""
        doc = EventDocumentFactory(event=sample_event, uploaded_by=lawyer_user)

        with patch("documents.services._get_s3_client") as mock_s3:
            mock_client = MagicMock()
            mock_s3.return_value = mock_client
            mock_client.generate_presigned_url.return_value = (
                "https://minio:9000/jurisagenda-docs/events/test/file.pdf?X-Amz-Signature=abc"
            )

            response = authenticated_client.get(
                f"/api/v1/documents/{doc.id}/download/",
                follow=False,
            )

        assert response.status_code == 302, (
            f"Esperado 302, obteve {response.status_code}"
        )
        location = response.get("Location", "")
        assert location, "Header Location deve estar presente no redirect 302"

    def test_deleted_document_returns_404(self, authenticated_client, lawyer_user, sample_event):
        """Documento soft-deleted → 404."""
        doc = EventDocumentFactory(event=sample_event, uploaded_by=lawyer_user, is_deleted=True)
        response = authenticated_client.get(f"/api/v1/documents/{doc.id}/download/")
        assert response.status_code == 404

    def test_document_list_filtered_by_event(self, authenticated_client, lawyer_user, sample_event):
        """GET /api/v1/documents/?event_id=X retorna apenas docs do evento X."""
        other_event = EventFactory(assigned_to=lawyer_user)
        doc1 = EventDocumentFactory(event=sample_event, uploaded_by=lawyer_user)
        doc2 = EventDocumentFactory(event=other_event, uploaded_by=lawyer_user)

        response = authenticated_client.get(
            f"/api/v1/documents/",
            {"event_id": str(sample_event.id)},
        )
        assert response.status_code == 200
        ids = [d["id"] for d in response.json()["results"]]
        assert str(doc1.id) in ids
        assert str(doc2.id) not in ids

    def test_delete_document_soft_deletes(self, authenticated_client, lawyer_user, sample_event):
        """DELETE /api/v1/documents/{id}/ → soft delete (is_deleted=True)."""
        from documents.models import EventDocument
        doc = EventDocumentFactory(event=sample_event, uploaded_by=lawyer_user)

        with patch("documents.services._get_s3_client") as mock_s3:
            mock_client = MagicMock()
            mock_s3.return_value = mock_client
            mock_client.delete_object.return_value = {}

            response = authenticated_client.delete(f"/api/v1/documents/{doc.id}/")

        assert response.status_code == 204
        doc.refresh_from_db()
        assert doc.is_deleted is True
        assert EventDocument.objects.filter(id=doc.id).exists()  # registro permanece no banco


@pytest.mark.django_db
class TestDocumentModel:

    def test_file_size_mb_property(self):
        """file_size_mb deve calcular corretamente."""
        doc = EventDocumentFactory.build(file_size=2 * 1024 * 1024)
        assert doc.file_size_mb == 2.0

    def test_extension_property(self):
        """extension deve derivar do content_type."""
        doc = EventDocumentFactory.build(content_type="application/pdf")
        assert doc.extension == "pdf"

        doc_img = EventDocumentFactory.build(content_type="image/jpeg")
        assert doc_img.extension == "jpg"
