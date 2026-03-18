import logging

from django.core.exceptions import PermissionDenied
from django.http import Http404
from rest_framework import exceptions, status
from rest_framework.response import Response
from rest_framework.views import exception_handler

logger = logging.getLogger(__name__)


def custom_exception_handler(exc, context):
    """
    Handler global de exceções da API.
    Padroniza todas as respostas de erro no formato:
    { "error": { "code": "...", "message": "...", "details": {...} } }
    """
    if isinstance(exc, Http404):
        exc = exceptions.NotFound()
    elif isinstance(exc, PermissionDenied):
        exc = exceptions.PermissionDenied()

    response = exception_handler(exc, context)

    if response is not None:
        error_payload = {
            "error": {
                "code": _get_error_code(exc),
                "message": _get_error_message(exc),
                "details": response.data if not isinstance(response.data, list) else {},
            }
        }
        response.data = error_payload

    if response is None:
        logger.exception(
            "Unhandled exception",
            extra={"exc": str(exc), "view": str(context.get("view"))},
        )
        return Response(
            {
                "error": {
                    "code": "internal_server_error",
                    "message": "Erro interno do servidor.",
                    "details": {},
                }
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    return response


def _get_error_code(exc) -> str:
    if hasattr(exc, "default_code"):
        return exc.default_code
    return "error"


def _get_error_message(exc) -> str:
    if hasattr(exc, "detail"):
        if isinstance(exc.detail, list):
            return str(exc.detail[0]) if exc.detail else "Erro desconhecido."
        if isinstance(exc.detail, dict):
            first_key = next(iter(exc.detail), None)
            if first_key:
                val = exc.detail[first_key]
                return f"{first_key}: {val[0]}" if isinstance(val, list) else str(val)
    return str(exc)
