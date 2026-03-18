import logging

import boto3
import redis
from botocore.exceptions import BotoCoreError
from django.conf import settings
from django.db import connection
from django.http import JsonResponse

logger = logging.getLogger(__name__)


def health_check(request):
    return JsonResponse({"status": "ok"})


def health_check_db(request):
    try:
        connection.ensure_connection()
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        return JsonResponse({"db": "ok"})
    except Exception as e:
        logger.error("Health check DB failed: %s", e)
        return JsonResponse({"db": "error", "detail": str(e)}, status=503)


def health_check_redis(request):
    try:
        r = redis.from_url(settings.REDIS_URL)
        r.ping()
        return JsonResponse({"redis": "ok"})
    except Exception as e:
        logger.error("Health check Redis failed: %s", e)
        return JsonResponse({"redis": "error", "detail": str(e)}, status=503)


def health_check_minio(request):
    try:
        s3 = boto3.client(
            "s3",
            endpoint_url=f"{'https' if settings.MINIO_USE_SSL else 'http'}://{settings.MINIO_ENDPOINT}",
            aws_access_key_id=settings.MINIO_ACCESS_KEY,
            aws_secret_access_key=settings.MINIO_SECRET_KEY,
        )
        s3.head_bucket(Bucket=settings.MINIO_BUCKET)
        return JsonResponse({"minio": "ok"})
    except Exception as e:
        logger.error("Health check MinIO failed: %s", e)
        return JsonResponse({"minio": "error", "detail": str(e)}, status=503)
