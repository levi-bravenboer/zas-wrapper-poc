import { useQuery, type UseQueryResult } from '@tanstack/react-query'

import { api } from '@/lib/api/client'
import { apiError } from '@/lib/api/errors'

import type { TaskItem } from './types'

export const TASKS_PATH = '/tasks'
export const tasksListKeyPrefix = ['tasks', TASKS_PATH] as const

export async function fetchTasks(): Promise<TaskItem[]> {
  const { data, response } = await api.GET('/tasks', {})
  if (!response.ok || !data) {
    throw apiError('Tasks fetch failed', response.status)
  }
  return data.items as TaskItem[]
}

export function useTasksQuery(): UseQueryResult<TaskItem[], Error> {
  return useQuery({
    queryKey: tasksListKeyPrefix,
    queryFn: fetchTasks,
  })
}
