import type { FhirDeps } from '@/platform/embed/depsContext'

import type { TasksPort } from '../ports'
import type { Task } from '../types'

const STUB_FHIR_TASKS: readonly Task[] = [
  { id: 'fhir-t-1', title: 'Bloeddrukcontrole inplannen', status: 'open' },
  { id: 'fhir-t-2', title: 'Medicatiebeoordeling afronden', status: 'in_progress' },
]

export function fhirTasksPort(_deps: FhirDeps): TasksPort {
  return {
    async list() {
      return STUB_FHIR_TASKS
    },
    async complete(_id) {
      // PoC stub — real FHIR write deferred to post-PoC integration change
    },
  }
}
