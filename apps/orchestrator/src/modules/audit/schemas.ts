import type { components } from '@/lib/api/schema'

/** One row of the append-only audit trail (`GET /audit-events`). */
export type AuditEventRead = components['schemas']['AuditEventRead']

export type AuditAction = components['schemas']['AuditAction']
export type AuditResult = components['schemas']['AuditResult']

/** Action verbs surfaced as filter options + badges (FHIR CRUDE + legacy login). */
export const AUDIT_ACTIONS: readonly AuditAction[] = [
  'created',
  'read',
  'updated',
  'deleted',
  'execute',
  'login',
]

export const AUDIT_RESULTS: readonly AuditResult[] = ['success', 'failure']

/** Resource types currently emitted into the trail (drives the resource filter). */
export const AUDITED_RESOURCE_TYPES = ['Pathway', 'User', 'Patient'] as const
