import { z } from 'zod'

export const launchSearchSchema = z.object({
  iss: z.string().url(),
  launch: z.string().min(1),
  state: z.string().min(1).optional(),
})

export type LaunchSearch = z.infer<typeof launchSearchSchema>
