import { createPort } from '@/platform/ports/createPort'

import type { Task } from './types'

export type TasksPort = {
  readonly list: () => Promise<readonly Task[]>
  readonly complete: (id: string) => Promise<void>
}

export const tasksPort = createPort<TasksPort>('Tasks')
