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
from uuid import UUID, uuid4

from sqlalchemy import event, select
from sqlalchemy.orm import Session

from app.db.models.access.access_grant import AccessGrant
from app.db.models.access.consent import Consent
from app.db.models.access.external_access import ExternalAccessProfile, ExternalGrant
from app.db.models.authz import AuthzOutbox
from app.db.models.care_team.care_team import CareTeam
from app.db.models.care_team.care_team_participant import CareTeamParticipant
from app.db.models.organisation.organisation import Organisation
from app.db.models.pathway.pathway import Pathway
from app.db.models.pathway.pathway_access import PathwayPractitioner, PathwaySpecialism
from app.db.models.patient.patient import Patient
from app.db.models.practitioner.practitioner_role import PractitionerRole
from app.db.models.practitioner.specialism import PractitionerRoleSpecialism, Specialism


def _affected_objects(session: Session, obj: object) -> list[tuple[str, UUID]]:
    """Map a flushed domain row to the authz objects whose tuple sets it feeds.

    A few mappings need small sync lookups (rare admin mutations only):
    a role change touches the specialisms it is linked to; a profile change
    touches every patient holding a grant of that professional type.
    """

    if isinstance(obj, CareTeamParticipant):
        return [("CareTeam", obj.care_team_id)]
    if isinstance(obj, CareTeam):
        # Status / delete changes affect both the team's member tuples and
        # the patient's care_team link.
        return [("CareTeam", obj.id), ("Patient", obj.patient_id)]
    if isinstance(obj, PractitionerRole):
        # Membership feeds the org AND every specialism linked to this role.
        affected: list[tuple[str, UUID]] = [("Organisation", obj.organisation_id)]
        linked = session.execute(
            select(PractitionerRoleSpecialism.specialism_id).where(
                PractitionerRoleSpecialism.practitioner_role_id == obj.id,
                PractitionerRoleSpecialism.deleted_at.is_(None),
            )
        ).all()
        affected.extend(("Specialism", row[0]) for row in linked)
        return affected
    if isinstance(obj, Organisation):
        return [("Organisation", obj.id)]
    if isinstance(obj, Patient):
        return [("Patient", obj.id)]
    if isinstance(obj, PractitionerRoleSpecialism):
        return [("Specialism", obj.specialism_id)]
    if isinstance(obj, Specialism):
        return [("Specialism", obj.id)]
    if isinstance(obj, PathwaySpecialism | PathwayPractitioner):
        return [("Carepath", obj.pathway_id)]
    if isinstance(obj, Pathway):
        return [("Carepath", obj.id)]
    if isinstance(obj, AccessGrant | ExternalGrant | Consent):
        return [("Patient", obj.patient_id)]
    if isinstance(obj, ExternalAccessProfile):
        # Verb config change fans out to every patient with a grant of this
        # type. Admin-rare; the sync lookup is acceptable inside the flush.
        rows = session.execute(
            select(ExternalGrant.patient_id)
            .where(
                ExternalGrant.tenant_id == obj.tenant_id,
                ExternalGrant.professional_type == obj.professional_type,
                ExternalGrant.deleted_at.is_(None),
            )
            .distinct()
        ).all()
        return [("Patient", row[0]) for row in rows]
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
            # New rows may reach before_flush with the client-side uuid4
            # default not yet applied; pre-assign so the outbox row can name
            # the object (equivalent to the column default firing).
            if obj in session.new and getattr(obj, "id", ...) is None:
                obj.id = uuid4()  # type: ignore[attr-defined]
            if obj in session.dirty and not session.is_modified(obj, include_collections=False):
                continue
            pending.update(_affected_objects(session, obj))
        for namespace, object_id in pending:
            session.add(AuthzOutbox(namespace=namespace, object_id=object_id))
