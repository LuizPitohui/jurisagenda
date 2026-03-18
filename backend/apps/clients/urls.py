from django.urls import path
from .views import ClientAnonymizeView, ClientDetailView, ClientListCreateView

urlpatterns = [
    path("", ClientListCreateView.as_view(), name="client-list-create"),
    path("<uuid:pk>/", ClientDetailView.as_view(), name="client-detail"),
    path("<uuid:pk>/anonymize/", ClientAnonymizeView.as_view(), name="client-anonymize"),
]
