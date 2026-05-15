import { ListTodo } from 'lucide-react'

import { defineFeature } from '@/platform/embed/defineFeature'

import { fhirTasksPort } from './adapters/fhir'
import { tasksPort } from './ports'
import { TasksPage } from './TasksPage'

export const tasksFeature = defineFeature({
  id: 'tasks',
  path: '/tasks',
  titleKey: 'nav.tasks',
  page: TasksPage,
  port: tasksPort,
  surfaces: ['smart', 'embed'] as const,
  adapters: {
    fhir: fhirTasksPort,
  },
  smart: {
    scopes: ['patient/Task.read'],
    requires: ['patient'],
  },
  nav: { icon: ListTodo, order: 20 },
})
