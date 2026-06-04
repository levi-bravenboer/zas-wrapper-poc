// Ory Permission Language (OPL) namespace model — the Access Management Engine.
//
// Postgres is the source of truth; every tuple here is derived from domain rows
// (practitioner_roles, care_team_participants, organisation parent edges,
// specialism links, pathway links, access/external grants, consents) by the
// outbox relay + reconciler in apps/backend/app/services/access/sync/.
// Never write tuples by hand outside seeds.
//
// IMPORTANT: permits are pure set algebra. Conditional rules (e.g. REQ-NON-12's
// "explicit assignment narrows the specialism set") live in derive.py, which
// decides WHICH tuples exist — keep both files in sync (derive.py points back
// here).
//
// Subjects are platform users: User:<users.id>. A multi-role human appears as
// several subjects (one per role-scoped users row) — cross-role shielding is
// structural, not policy.
// Objects carry domain UUIDs: Organisation:<id>, CareTeam:<id>, Patient:<id>,
// Specialism:<id>, Carepath:<pathway id>.

import { Namespace, Context } from "@ory/keto-namespace-types"

class User implements Namespace {}

class Organisation implements Namespace {
  related: {
    // parent edge of the organisation tree (child → parent). Campuses are
    // organisation rows under the tenant root (REQ-NON-15) — campus scoping
    // IS this chain, no separate mechanism.
    parent: Organisation[]
    // practitioners holding an open PractitionerRole in this organisation
    member: User[]
  }

  permits = {
    // membership anywhere UP the parent chain grants view of this org's scope —
    // i.e. holding a role in an ancestor org covers every descendant.
    view: (ctx: Context): boolean =>
      this.related.member.includes(ctx.subject) ||
      this.related.parent.traverse((parent) => parent.permits.view(ctx)),
  }
}

class CareTeam implements Namespace {
  related: {
    // practitioners with an open participation period in this team
    member: User[]
  }
}

class Specialism implements Namespace {
  related: {
    // practitioners holding an open role linked to this specialism
    // (practitioner_role_specialisms × open practitioner_roles)
    practitioner: User[]
  }
}

class Carepath implements Namespace {
  related: {
    // derivation emits EITHER assigned OR specialism edges per carepath,
    // never both (assigned-XOR-specialism, REQ-NON-12 — see derive.py)
    specialism: Specialism[]
    assigned: User[]
    // reserved for future org-owned carepaths; no tuples derived today
    owner_org: Organisation[]
  }

  permits = {
    view: (ctx: Context): boolean =>
      this.related.assigned.includes(ctx.subject) ||
      this.related.specialism.traverse((s) =>
        s.related.practitioner.includes(ctx.subject),
      ) ||
      this.related.owner_org.traverse((org) => org.permits.view(ctx)),
  }
}

class Patient implements Namespace {
  related: {
    treating_org: Organisation[]
    care_team: CareTeam[]
    // break-glass grant (access_grants: open, unexpired) — full sight
    break_glass: User[]
    // consent-gated external verb grants (external_grants ∩ active consent
    // ∩ type profile). Externals NEVER reach view_shielded.
    external_reader: User[]
    external_writer: User[]
    external_recorder: User[]
    external_messager: User[]
  }

  permits = {
    // internal/full sight — externals deliberately absent (shielding is
    // set subtraction); break-glass grantees need shielded data too.
    view_shielded: (ctx: Context): boolean =>
      this.related.care_team.traverse((team) =>
        team.related.member.includes(ctx.subject),
      ) ||
      this.related.treating_org.traverse((org) => org.permits.view(ctx)) ||
      this.related.break_glass.includes(ctx.subject),

    view: (ctx: Context): boolean =>
      this.permits.view_shielded(ctx) ||
      this.related.external_reader.includes(ctx.subject),

    edit: (ctx: Context): boolean =>
      this.related.care_team.traverse((team) =>
        team.related.member.includes(ctx.subject),
      ) ||
      this.related.break_glass.includes(ctx.subject) ||
      this.related.external_writer.includes(ctx.subject),

    record: (ctx: Context): boolean =>
      this.permits.edit(ctx) ||
      this.related.external_recorder.includes(ctx.subject),

    message: (ctx: Context): boolean =>
      this.permits.view(ctx) ||
      this.related.external_messager.includes(ctx.subject),
  }
}
