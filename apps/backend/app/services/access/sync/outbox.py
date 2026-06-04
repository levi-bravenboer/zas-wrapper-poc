"""Session hook enqueueing authz reconciliation work in the same transaction.

`install_authz_outbox_hook()` registers a `Session.before_flush` listener
(same idiom as `app/db/audit.py`) that watches every model whose rows feed
the tuple derivation and appends an `AuthzOutbox` row naming the affected
object. Because the outbox row rides the domain transaction, a commit
either records both the domain fact and the pending sync, or neither.

Centralising here (instead of editing every service) means new mutation
paths — services, scripts, future code — are covered automatically.

Caveat: bulk statements (`session.execute(update(...))`) bypass ORM flush
events and therefore this hook — after bulk SQL touching access-relevant
tables, run `python -m scripts.reconcile_authz_tuples`.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import event
from sqlalchemy.orm import Session

from app.db.models.authz import AuthzOutbox
from app.db.models.care_team.care_team import CareTeam
from app.db.models.care_team.care_team_participant import CareTeamParticipant
from app.db.models.organisation.organisation import Organisation
from app.db.models.patient.patient import Patient
from app.db.models.practitioner.practitioner_role import PractitionerRole


def _affected_objects(obj: object) -> list[tuple[str, UUID]]:
    """Map a flushed domain row to the authz objects whose tuple sets it feeds."""

    if isinstance(obj, CareTeamParticipant):
        return [("CareTeam", obj.care_team_id)]
    if isinstance(obj, CareTeam):
        # Status / delete changes affect both the team's member tuples and
        # the patient's care_team link.
        return [("CareTeam", obj.id), ("Patient", obj.patient_id)]
    if isinstance(obj, PractitionerRole):
        return [("Organisation", obj.organisation_id)]
    if isinstance(obj, Organisation):
        return [("Organisation", obj.id)]
    if isinstance(obj, Patient):
        return [("Patient", obj.id)]
    return []


def install_authz_outbox_hook() -> None:
    @event.listens_for(Session, "before_flush")
    def _enqueue_authz_outbox(
        session: Session,
        _flush_context: Any,
        _instances: Any,
    ) -> None:
        # Import here to avoid a settings dependency at module import time.
        from app.core.settings import get_settings

        if not get_settings().authz_keto_enabled:
            return
        pending: set[tuple[str, UUID]] = set()
        for obj in session.new | session.dirty | session.deleted:
            if isinstance(obj, AuthzOutbox):
                continue
            if obj in session.dirty and not session.is_modified(obj, include_collections=False):
                continue
            pending.update(_affected_objects(obj))
        for namespace, object_id in pending:
            session.add(AuthzOutbox(namespace=namespace, object_id=object_id))
