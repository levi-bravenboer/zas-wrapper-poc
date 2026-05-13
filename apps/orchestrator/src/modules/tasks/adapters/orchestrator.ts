import type { OrchestratorDeps } from '@/platform/embed/depsContext'

import type { TasksPort } from '../ports'
import type { Task } from '../types'

// Reason: placeholder data while the orchestrator backend Tasks endpoint is unbuilt.
// Swap for real `api.GET('/tasks')` calls once the schema lands. Adapter contract
// is what the page consumes — keeping that stable here lets the UI ship first.
const PLACEHOLDER_TASKS: readonly Task[] = [
  { id: 't-1', title: 'Review Patient X intake', status: 'open' },
  { id: 't-2', title: 'Sign off pathway adjustment', status: 'in_progress' },
  { id: 't-3', title: 'Schedule follow-up call', status: 'open' },
]

export function orchestratorTasksPort(_deps: OrchestratorDeps): TasksPort {
  return {
    async list() {
      return PLACEHOLDER_TASKS
    },
    async complete(_id) {
      // no-op until backend exists
    },
  }
}
