"""
JurisAgenda - Local/Development Settings
"""
from .base import *  # noqa: F401, F403

DEBUG = True

ALLOWED_HOSTS = ["*"]

# Django Debug Toolbar (opcional em dev)
INSTALLED_APPS += ["django_extensions"]  # type: ignore[name-defined]  # noqa: F405

# Email backend simples para dev
EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"

# CORS liberado em dev
CORS_ALLOW_ALL_ORIGINS = True

# Desliga rate limiting em dev
RATELIMIT_ENABLE = False

# Ajustes para funcionamento via Proxy Next.js (port 3000)
# Evita erro 500 no POST sem barra (APPEND_SLASH tenta redirecionar e perde dados)
APPEND_SLASH = False

# Permite que o Django aceite o Origin do Next.js no CSRF
CSRF_TRUSTED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
