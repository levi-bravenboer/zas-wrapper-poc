import { ListTodo } from 'lucide-react'

import { defineFeature } from '@/platform/embed/defineFeature'

import { fhirTasksPort } from './adapters/fhir'
import { orchestratorTasksPort } from './adapters/orchestrator'
import { tasksPort } from './ports'
import { TasksPage } from './TasksPage'

export const tasksFeature = defineFeature({
  id: 'tasks',
  path: '/tasks',
  titleKey: 'nav.tasks',
  page: TasksPage,
  port: tasksPort,
  surfaces: ['app', 'smart', 'embed'] as const,
  adapters: {
    orchestrator: orchestratorTasksPort,
    fhir: fhirTasksPort,
  },
  smart: {
    scopes: ['patient/Task.read'],
    requires: ['patient'],
  },
  nav: { icon: ListTodo, order: 20 },
})
