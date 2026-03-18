"""tv/routing.py — WebSocket URL patterns."""
from django.urls import path
from .consumers import TVPanelConsumer, UserNotificationConsumer

websocket_urlpatterns = [
    path("ws/tv/", TVPanelConsumer.as_asgi()),
    path("ws/notifications/", UserNotificationConsumer.as_asgi()),
]
