import type { components } from '@/lib/api/schema'

export type Task = components['schemas']['TaskRead']
export type TaskStatus = Task['status']
