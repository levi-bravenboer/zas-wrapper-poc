import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query'

import { usePaginatedQuery, type Page } from '@/hooks/use-paginated-query'

import { fetchTask, fetchTasks, setTaskStatus } from './api'
import { TASKS_PATH, taskQueryKey, tasksListKeyPrefix } from './keys'
import type { Task, TaskStatus } from './types'

// Poll the inbox so a caregiver sees newly-assigned tasks without a manual
// reload. The interval is the floor for environments where realtime is
// unavailable.
const TASKS_POLL_INTERVAL_MS = 15_000

const PATIENT_TASKS_PAGE_SIZE = 50

export function useTasksQuery(): UseQueryResult<Task[], Error> {
  return useQuery({
    queryKey: tasksListKeyPrefix,
    queryFn: fetchTasks,
    refetchInterval: TASKS_POLL_INTERVAL_MS,
  })
}

/**
 * Open tasks for one patient, scoped to the calling caregiver by the backend
 * (`GET /tasks` restricts a non-admin caller to their own assignments). Rides
 * the bracket-filter envelope (`filter[patient_id]`, `filter[status]`) via the
 * shared paginated-query infra. Polls on the same interval as the inbox.
 */
export function usePatientTasksQuery(patientId: string): UseQueryResult<Page<Task>, Error> {
  return usePaginatedQuery<Task>(
    TASKS_PATH,
    {
      page: 1,
      page_size: PATIENT_TASKS_PAGE_SIZE,
      order_by: 'due_at',
      order: 'asc',
      filters: {
        patient_id: { op: 'eq', value: patientId },
        status: { op: 'eq', value: 'open' satisfies TaskStatus },
      },
    },
    { refetchInterval: TASKS_POLL_INTERVAL_MS },
  )
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
