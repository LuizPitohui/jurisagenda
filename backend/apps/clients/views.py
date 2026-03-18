from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsAdminOrLawyerOrSecretary

from .models import Client
from .serializers import ClientCreateSerializer, ClientSerializer
from .services import ClientService


class ClientListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAdminOrLawyerOrSecretary]
    filterset_fields = ["consent_given"]
    search_fields = ["full_name", "email", "cpf_cnpj", "code"]

    def get_queryset(self):
        return Client.objects.select_related("created_by").order_by("full_name")

    def get_serializer_class(self):
        if self.request.method == "POST":
            return ClientCreateSerializer
        return ClientSerializer


class ClientDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAdminOrLawyerOrSecretary]
    queryset = Client.objects.all()
    serializer_class = ClientSerializer


class ClientAnonymizeView(APIView):
    """DELETE /api/v1/clients/{id}/ — Anonimização LGPD."""
    permission_classes = [IsAdminOrLawyerOrSecretary]

    def delete(self, request, pk):
        client = generics.get_object_or_404(Client, pk=pk)
        ClientService.anonymize_client(client, requested_by=request.user)
        return Response({"detail": "Cliente anonimizado com sucesso."}, status=status.HTTP_200_OK)
