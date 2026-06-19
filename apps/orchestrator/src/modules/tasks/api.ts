import { api } from '@/lib/api/client'
import { unwrapApi } from '@/lib/api/unwrap'

import type { Task, TaskStatus } from './types'

export async function fetchTasks(): Promise<Task[]> {
  const page = await unwrapApi(
    api.GET('/tasks', { params: { query: { page_size: 100 } } }),
    'Tasks fetch failed',
  )
  if (page.total > page.items.length) {
    // Surface truncation instead of silently dropping items.
    console.warn(`tasks list truncated: showing ${page.items.length} of ${page.total} items`)
  }
  return page.items
}

export async function fetchTask(taskId: string): Promise<Task> {
  return unwrapApi(
    api.GET('/tasks/{task_id}', { params: { path: { task_id: taskId } } }),
    'Task fetch failed',
  )
}

export async function setTaskStatus(taskId: string, status: TaskStatus): Promise<Task> {
  return unwrapApi(
    api.PATCH('/tasks/{task_id}', { params: { path: { task_id: taskId } }, body: { status } }),
    'Task status update failed',
  )
}
