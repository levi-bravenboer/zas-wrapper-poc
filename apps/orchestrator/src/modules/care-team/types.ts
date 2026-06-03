import type { components } from '@/lib/api/schema'

export type CareTeamRow = components['schemas']['CareTeamRead']
export type CareTeamStatus = components['schemas']['CareTeamStatus']
export type ParticipantRow = components['schemas']['ParticipantRead']
export type RoleInCare = components['schemas']['RoleInCare']
export type CareTeamCreatePayload = components['schemas']['CareTeamCreate']
export type CareTeamUpdatePayload = components['schemas']['CareTeamUpdate']
export type ParticipantCreatePayload = components['schemas']['ParticipantCreate']
export type ParticipantRoleChangePayload = components['schemas']['ParticipantRoleChange']
