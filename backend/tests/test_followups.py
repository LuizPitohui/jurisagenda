"""
tests/test_followups.py

TC-003: Follow-up com outcome=SUCCESS deve criar entrada na timeline
        com timestamp e actor.
"""
import pytest
from django.utils import timezone
from datetime import timedelta

from .conftest import EventFactory, PastEventFactory, FollowUpFactory


@pytest.mark.django_db
class TestFollowUpTimeline:

    def test_tc003_success_creates_timeline_entries(self, lawyer_user):
        """
        TC-003: outcome=SUCCESS deve criar entradas na timeline
        com timestamp e actor preenchidos.
        """
        from followups.services import FollowUpService

        event = PastEventFactory(assigned_to=lawyer_user)
        followup = FollowUpService.create_followup(
            created_by=lawyer_user,
            event=event,
            outcome="SUCCESS",
        )

        assert len(followup.timeline_log) >= 2, (
            "Deve haver ao menos 2 entradas na timeline (início + resultado)"
        )
        for entry in followup.timeline_log:
            assert "ts" in entry, "Cada entrada deve ter campo 'ts' (timestamp)"
            assert "actor" in entry, "Cada entrada deve ter campo 'actor'"
            assert "entry" in entry, "Cada entrada deve ter campo 'entry'"
            assert entry["actor"] == lawyer_user.email
            assert entry["ts"]  # não vazio

    def test_failure_outcome_also_creates_timeline(self, lawyer_user):
        """outcome=FAILURE também deve gerar timeline."""
        from followups.services import FollowUpService

        event = PastEventFactory(assigned_to=lawyer_user)
        followup = FollowUpService.create_followup(
            created_by=lawyer_user,
            event=event,
            outcome="FAILURE",
            notes="Cliente não compareceu.",
        )
        entries_text = [e["entry"] for e in followup.timeline_log]
        assert any("Não realizado" in e or "FAILURE" in e or "confirmou" in e for e in entries_text)

    def test_followup_updates_event_status_to_done(self, lawyer_user):
        """outcome=SUCCESS deve mudar event.status para DONE."""
        from followups.services import FollowUpService

        event = PastEventFactory(assigned_to=lawyer_user, status="SCHEDULED")
        FollowUpService.create_followup(created_by=lawyer_user, event=event, outcome="SUCCESS")

        event.refresh_from_db()
        assert event.status == "DONE"

    def test_postponed_outcome_sets_rescheduled_status(self, lawyer_user):
        """outcome=POSTPONED deve mudar event.status para RESCHEDULED."""
        from followups.services import FollowUpService

        event = PastEventFactory(assigned_to=lawyer_user, status="SCHEDULED")
        FollowUpService.create_followup(created_by=lawyer_user, event=event, outcome="POSTPONED")

        event.refresh_from_db()
        assert event.status == "RESCHEDULED"

    def test_duplicate_followup_returns_400(self, authenticated_client, lawyer_user):
        """Um evento só pode ter um follow-up (OneToOne)."""
        event = PastEventFactory(assigned_to=lawyer_user)
        FollowUpFactory(event=event, created_by=lawyer_user)

        response = authenticated_client.post(
            "/api/v1/followups/",
            {"event": str(event.id), "outcome": "SUCCESS"},
            format="json",
        )
        assert response.status_code == 400
        assert "follow-up" in str(response.data).lower()

    def test_reschedule_creates_linked_event(self, lawyer_user):
        """reschedule deve criar novo Event vinculado ao follow-up via next_event."""
        from followups.services import FollowUpService

        event = PastEventFactory(assigned_to=lawyer_user)
        followup = FollowUpFactory(event=event, created_by=lawyer_user, outcome="POSTPONED")

        new_start = timezone.now() + timedelta(days=7)
        new_event = FollowUpService.reschedule_event(
            followup=followup,
            rescheduled_by=lawyer_user,
            start_datetime=new_start,
        )

        followup.refresh_from_db()
        assert followup.next_event == new_event
        assert new_event.title == event.title
        assert new_event.event_type == event.event_type

        # Timeline deve registrar o novo evento
        entries_text = [e["entry"] for e in followup.timeline_log]
        assert any(str(new_event.id) in e for e in entries_text)

    def test_followup_via_api(self, authenticated_client, lawyer_user):
        """POST /api/v1/followups/ via API deve criar follow-up com timeline."""
        event = PastEventFactory(assigned_to=lawyer_user)
        response = authenticated_client.post(
            "/api/v1/followups/",
            {"event": str(event.id), "outcome": "SUCCESS", "notes": "Tudo certo."},
            format="json",
        )
        assert response.status_code == 201, response.data
        data = response.json()
        assert data["outcome"] == "SUCCESS"
