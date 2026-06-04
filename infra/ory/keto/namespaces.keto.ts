// Ory Permission Language (OPL) namespace model — the Access Management Engine.
//
// Postgres is the source of truth; every tuple here is derived from domain rows
// (practitioner_roles, care_team_participants, organisation parent edges,
// external episodes) by the outbox relay + reconciler in
// apps/backend/app/services/authz/. Never write tuples by hand outside seeds.
//
// Subjects are platform users: User:<users.id>.
// Objects carry domain UUIDs: Organisation:<id>, CareTeam:<id>, Patient:<id>.

import { Namespace, Context } from "@ory/keto-namespace-types"

class User implements Namespace {}

class Organisation implements Namespace {
  related: {
    // parent edge of the organisation tree (child → parent)
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

class Patient implements Namespace {
  related: {
    treating_org: Organisation[]
    care_team: CareTeam[]
    // tuple existence == active external episode; deleted on EpisodeEnded
    external_carer: User[]
  }

  permits = {
    // internal eyes only — shielding policy is set subtraction: external_carer
    // is deliberately absent here.
    view_shielded: (ctx: Context): boolean =>
      this.related.care_team.traverse((team) =>
        team.related.member.includes(ctx.subject),
      ) ||
      this.related.treating_org.traverse((org) => org.permits.view(ctx)),

    view: (ctx: Context): boolean =>
      this.permits.view_shielded(ctx) ||
      this.related.external_carer.includes(ctx.subject),
  }
}
