import { useQuery, type UseQueryResult } from '@tanstack/react-query'

import { fetchTaskById, fetchTasks } from './api'
import { taskQueryKey, tasksListKeyPrefix } from './keys'
import type { TaskItem } from './types'

// Poll the inbox so a caregiver sees newly-booked tasks without a manual
// reload. Realtime invalidation still fires on appointment events; the
// interval is the floor for environments where the socket is unavailable.
const TASKS_POLL_INTERVAL_MS = 15_000

export function useTasksQuery(): UseQueryResult<TaskItem[], Error> {
  return useQuery({
    queryKey: tasksListKeyPrefix,
    queryFn: fetchTasks,
    refetchInterval: TASKS_POLL_INTERVAL_MS,
  })
}

export function useTaskQuery(taskId: string): UseQueryResult<TaskItem, Error> {
  return useQuery({
    queryKey: taskQueryKey(taskId),
    queryFn: () => fetchTaskById(taskId),
  })
}
