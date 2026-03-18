"""
tv/serializers.py
TC-004: NUNCA incluir campos com dados pessoais nos serializers desta app.
"""
from rest_framework import serializers
from .models import TVCallLog


class TVCallLogSerializer(serializers.ModelSerializer):
    """
    Serializer seguro (LGPD): apenas código anônimo e tipo de evento.
    Campos ausentes propositalmente: client_name, process_number, cpf_cnpj.
    """

    class Meta:
        model = TVCallLog
        fields = [
            "id", "tv_code", "event_type", "priority",
            "status", "called_at", "confirmed_at",
        ]
        # Nenhum campo de dados pessoais — por design
