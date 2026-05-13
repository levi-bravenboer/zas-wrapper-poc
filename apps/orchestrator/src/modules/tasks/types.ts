export type TaskStatus = 'open' | 'in_progress' | 'completed'

export type Task = {
  readonly id: string
  readonly title: string
  readonly status: TaskStatus
  readonly dueDate?: string
}
