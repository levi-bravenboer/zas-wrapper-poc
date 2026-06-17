import type { EnrollmentState } from '@/modules/patient-pathway/types'

// Presentation-only carepath attribution for Luscii connections. Matches a
// connection's live Luscii program id against the `external_program` program
// ids of the patient's pathway enrollments, then buckets current vs history.
// Pure — no data fetching, no pathway datalayer coupling (the caller supplies
// the already-resolved enrollment program ids from existing read APIs).

export type CarepathBucket = 'current' | 'history' | 'unassigned'

export interface CarepathRef {
  enrollmentId: string
  pathwayName: string | null
  state: EnrollmentState
}

export interface EnrollmentCarepath extends CarepathRef {
  /** Luscii `external_program` program ids declared by this enrollment's pathway. */
  programIds: string[]
}

export interface ConnectionLike {
  connection_id: string
  status: 'active' | 'inactive'
  program?: { id?: string | null } | null
}

export interface BucketedConnection<T> {
  connection: T
  carepath: CarepathRef | null
}

export interface BucketedConnections<T> {
  current: BucketedConnection<T>[]
  history: BucketedConnection<T>[]
  unassigned: BucketedConnection<T>[]
}

// `paused` counts as a current carepath — still the live path, just on hold.
const CURRENT_STATES: ReadonlySet<EnrollmentState> = new Set<EnrollmentState>(['active', 'paused'])

export function matchCarepath(
  programId: string | null | undefined,
  enrollments: EnrollmentCarepath[],
): CarepathRef | null {
  if (!programId) return null
  const matches = enrollments.filter((e) => e.programIds.includes(programId))
  // Tie-break: prefer an active/paused enrollment over a finished one.
  const chosen = matches.find((e) => CURRENT_STATES.has(e.state)) ?? matches[0]
  if (!chosen) return null
  return {
    enrollmentId: chosen.enrollmentId,
    pathwayName: chosen.pathwayName,
    state: chosen.state,
  }
}

export function bucketConnections<T extends ConnectionLike>(
  connections: T[],
  enrollments: EnrollmentCarepath[],
): BucketedConnections<T> {
  const out: BucketedConnections<T> = { current: [], history: [], unassigned: [] }
  for (const connection of connections) {
    if (connection.status === 'inactive') {
      out.history.push({ connection, carepath: null })
      continue
    }
    const carepath = matchCarepath(connection.program?.id, enrollments)
    if (carepath === null) {
      out.unassigned.push({ connection, carepath: null })
    } else if (CURRENT_STATES.has(carepath.state)) {
      out.current.push({ connection, carepath })
    } else {
      out.history.push({ connection, carepath })
    }
  }
  return out
}
