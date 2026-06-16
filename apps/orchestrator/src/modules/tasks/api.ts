import { api } from '@/lib/api/client'
import { apiError } from '@/lib/api/errors'

import type { Task, TaskStatus } from './types'

export async function fetchTasks(): Promise<Task[]> {
  const { data, response } = await api.GET('/tasks', {
    params: { query: { page_size: 100 } },
  })
  if (!response.ok || !data) {
    throw apiError('Tasks fetch failed', response.status)
  }
  if (data.total > data.items.length) {
    // Surface truncation instead of silently dropping items.
    console.warn(`tasks list truncated: showing ${data.items.length} of ${data.total} items`)
  }
  return data.items
}

export async function fetchTask(taskId: string): Promise<Task> {
  const { data, response } = await api.GET('/tasks/{task_id}', {
    params: { path: { task_id: taskId } },
  })
  if (!response.ok || !data) {
    throw apiError('Task fetch failed', response.status)
  }
  return data
}

export async function setTaskStatus(taskId: string, status: TaskStatus): Promise<Task> {
  const { data, response } = await api.PATCH('/tasks/{task_id}', {
    params: { path: { task_id: taskId } },
    body: { status },
  })
  if (!response.ok || !data) {
    throw apiError('Task status update failed', response.status)
  }
  return data
}
