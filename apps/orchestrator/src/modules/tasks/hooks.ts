import { useQuery, type UseQueryResult } from '@tanstack/react-query'

import { fetchTaskById, fetchTasks } from './api'
import { taskQueryKey, tasksListKeyPrefix } from './keys'
import type { TaskItem } from './types'

export function useTasksQuery(): UseQueryResult<TaskItem[], Error> {
  return useQuery({
    queryKey: tasksListKeyPrefix,
    queryFn: fetchTasks,
  })
}

export function useTaskQuery(taskId: string): UseQueryResult<TaskItem, Error> {
  return useQuery({
    queryKey: taskQueryKey(taskId),
    queryFn: () => fetchTaskById(taskId),
  })
}
