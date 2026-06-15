export const TASKS_PATH = '/tasks'
export const tasksListKeyPrefix = ['tasks', TASKS_PATH] as const

export function taskQueryKey(taskId: string): readonly unknown[] {
  return [...tasksListKeyPrefix, taskId] as const
}
