from django.urls import path
from .views import TVClearQueueView, TVHistoryView, TVQueueView, TVTTSView

urlpatterns = [
    path("queue/", TVQueueView.as_view(), name="tv-queue"),
    path("history/", TVHistoryView.as_view(), name="tv-history"),
    path("clear-queue/", TVClearQueueView.as_view(), name="tv-clear-queue"),
    path("tts/", TVTTSView.as_view(), name="tv-tts"),
]
