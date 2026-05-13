import { z } from 'zod'

import type { SurfaceId } from '@/platform/surface/types'

const surfaceSchema: z.ZodType<Extract<SurfaceId, 'smart' | 'embed'>> = z.union([
  z.literal('smart'),
  z.literal('embed'),
])

export const launchSearchSchema = z.object({
  iss: z.string().url(),
  launch: z.string().min(1),
  surface: surfaceSchema.optional().default('smart'),
  return: z.string().startsWith('/').optional(),
  state: z.string().min(1).optional(),
})

export type LaunchSearch = z.infer<typeof launchSearchSchema>

export const callbackSearchSchema = z
  .object({
    code: z.string().min(1).optional(),
    state: z.string().min(1).optional(),
    error: z.string().min(1).optional(),
    error_description: z.string().min(1).optional(),
  })
  .refine((value) => value.code !== undefined || value.error !== undefined, {
    message: 'callback requires either `code` or `error`',
  })

export type CallbackSearch = z.infer<typeof callbackSearchSchema>
