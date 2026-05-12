import { createFileRoute, redirect } from '@tanstack/react-router'

import { LAUNCH_LANDING_PATH } from '@/modules/smart-launch/constants'
import { launchSearchSchema } from '@/modules/smart-launch/schemas'
import { useLaunchStore } from '@/modules/smart-launch/store'

export const Route = createFileRoute('/launch')({
  validateSearch: launchSearchSchema,
  beforeLoad: ({ search }) => {
    useLaunchStore.getState().setContext({
      iss: search.iss,
      launch: search.launch,
      ...(search.state !== undefined ? { state: search.state } : {}),
    })
    throw redirect({ to: LAUNCH_LANDING_PATH })
  },
})
