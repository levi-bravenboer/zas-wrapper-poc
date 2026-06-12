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

/**
 * Resolve a `TaskItem` by its synthetic id (`source:source_id` pair).
 *
 * Per the tasks-base aggregator: v1 source is always `appointment` and the
 * route is `GET /tasks/appointment/{source_id}`. We split the synthetic id
 * here so route components stay decoupled from the source axis — they pass
 * the `$taskId` URL param directly.
 */
export async function fetchTaskById(taskId: string): Promise<TaskItem> {
  // v1 source set is exactly `appointment`. `taskId` equals the underlying
  // appointment uuid (no composite encoding per design.md D-AGG).
  const { data, response } = await api.GET('/tasks/{source}/{source_id}', {
    params: { path: { source: 'appointment', source_id: taskId } },
  })
  if (!response.ok || !data) {
    throw apiError('Task fetch failed', response.status)
  }
  return data as TaskItem
}

export function taskQueryKey(taskId: string): readonly unknown[] {
  return [...tasksListKeyPrefix, taskId] as const
}

export function useTaskQuery(taskId: string): UseQueryResult<TaskItem, Error> {
  return useQuery({
    queryKey: taskQueryKey(taskId),
    queryFn: () => fetchTaskById(taskId),
  })
}
