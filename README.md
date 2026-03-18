# JurisAgenda – Backend

Sistema Web de Agenda Jurídica – Backend em Python / Django.

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Framework | Python 3.12 + Django 5 + Django REST Framework |
| Banco de Dados | PostgreSQL 16 |
| ORM | Django ORM |
| WebSockets | Django Channels + Redis Channel Layer |
| Task Queue | Celery 5 + Celery Beat |
| Armazenamento | MinIO (S3-compatível) |
| Autenticação | JWT via djangorestframework-simplejwt |
| Docs API | OpenAPI 3 via drf-spectacular |
| Containers | Docker + Docker Compose |

## Início Rápido

```bash
# 1. Clone o repositório
git clone https://github.com/seu-org/jurisagenda.git
cd jurisagenda

# 2. Configure o ambiente
cp .env.example .env
# Edite .env com suas credenciais

# 3. Suba todos os serviços
docker compose up -d

# 4. Configure o projeto (superuser + MinIO + Celery Beat)
docker compose exec backend python manage.py setup_project

# 5. Acesse
# API:     http://localhost/api/v1/
# Swagger: http://localhost/api/docs/
# Admin:   http://localhost/admin/
# MinIO:   http://localhost:9001/
```

## Desenvolvimento Local (sem Docker)

```bash
cd backend

# Instalar dependências
pip install -r requirements/development.txt

# Configurar banco (PostgreSQL deve estar rodando)
python manage.py migrate

# Rodar servidor de desenvolvimento
python manage.py runserver

# Rodar Celery Worker (terminal separado)
celery -A core worker -l info

# Rodar Celery Beat (terminal separado)
celery -A core beat -l info --scheduler django_celery_beat.schedulers:DatabaseScheduler
```

## Testes

```bash
cd backend

# Todos os testes com cobertura
pytest tests/ -v

# Apenas testes rápidos (sem integração)
pytest tests/ -v -m "not slow and not integration"

# Relatório HTML de cobertura
pytest tests/ --cov=apps --cov-report=html
open htmlcov/index.html
```

## Estrutura do Projeto

```
backend/
├── core/                  # Configurações, middleware, celery, utils
│   ├── settings/
│   │   ├── base.py
│   │   ├── development.py
│   │   └── production.py
│   ├── services/
│   │   └── minio.py       # MinIO service layer
│   ├── asgi.py            # ASGI + Channels
│   ├── celery.py          # Celery app + Beat schedule
│   ├── middleware.py      # RequestID, AuditLog, JWTAuth WS
│   ├── permissions.py     # RBAC permissions
│   ├── exceptions.py      # Custom exception handler
│   └── pagination.py      # Standard pagination
├── apps/
│   ├── accounts/          # User model, auth, JWT
│   ├── clients/           # Client model, LGPD anonymization
│   ├── events/            # Event model (core), TV call dispatch
│   ├── followups/         # Follow-up, timeline, reschedule
│   ├── documents/         # MinIO document management
│   └── tv/                # WebSocket consumers, TV queue
├── tests/
│   ├── factories.py       # Factory Boy definitions
│   ├── test_events.py     # Events + TV LGPD tests (TC-001~008)
│   └── test_followups_documents.py
└── requirements/
    ├── base.txt
    ├── development.txt
    └── production.txt
```

## API Endpoints Principais

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/v1/auth/token/` | Login (JWT) |
| POST | `/api/v1/auth/token/refresh/` | Renovar token |
| POST | `/api/v1/auth/logout/` | Logout (blacklist) |
| GET/POST | `/api/v1/events/` | Listar / Criar eventos |
| GET | `/api/v1/events/calendar/` | Dados para calendário |
| POST | `/api/v1/events/{id}/tv-call/` | Disparar chamada TV |
| GET/POST | `/api/v1/followups/` | Follow-ups |
| POST | `/api/v1/followups/{id}/reschedule/` | Remarcar evento |
| POST | `/api/v1/documents/presigned-upload/` | URL upload MinIO |
| GET | `/api/v1/documents/{id}/download/` | URL download MinIO |
| GET | `/api/v1/tv/queue/` | Fila TV (público) |
| WS | `ws://host/ws/tv/` | Stream TV em tempo real |
| WS | `ws://host/ws/notifications/?token=...` | Notificações pessoais |
| GET | `/api/v1/health/` | Health check geral |
| GET | `/api/docs/` | Swagger UI |

## Conformidade LGPD

- Painel TV (`/api/v1/tv/`) **nunca** expõe dados pessoais – apenas códigos anônimos (ex.: `A-045`)
- Endpoint `DELETE /api/v1/clients/{id}/anonymize/` anonimiza dados sem excluir o registro
- Consentimento do cliente é rastreado com timestamp e versão da política
- Todos os endpoints mutantes são registrados no log de auditoria (`jurisagenda.audit`)
- Documentos armazenados em bucket MinIO privado com URLs pré-assinadas (TTL configurável)

## Licença

Proprietário – Uso interno.
