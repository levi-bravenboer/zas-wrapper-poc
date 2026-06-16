import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query'

import { fetchTask, fetchTasks, setTaskStatus } from './api'
import { taskQueryKey, tasksListKeyPrefix } from './keys'
import type { Task, TaskStatus } from './types'

// Poll the inbox so a caregiver sees newly-assigned tasks without a manual
// reload. The interval is the floor for environments where realtime is
// unavailable.
const TASKS_POLL_INTERVAL_MS = 15_000

export function useTasksQuery(): UseQueryResult<Task[], Error> {
  return useQuery({
    queryKey: tasksListKeyPrefix,
    queryFn: fetchTasks,
    refetchInterval: TASKS_POLL_INTERVAL_MS,
  })
}

export function useTaskQuery(taskId: string): UseQueryResult<Task, Error> {
  return useQuery({
    queryKey: taskQueryKey(taskId),
    queryFn: () => fetchTask(taskId),
  })
}

export function useSetTaskStatus(taskId: string): UseMutationResult<Task, Error, TaskStatus> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (status: TaskStatus) => setTaskStatus(taskId, status),
    onSuccess: (task) => {
      queryClient.setQueryData(taskQueryKey(taskId), task)
      void queryClient.invalidateQueries({ queryKey: tasksListKeyPrefix, exact: true })
    },
  })
}
