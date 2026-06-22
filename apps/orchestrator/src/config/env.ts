import { z } from 'zod'

export const envSchema = z.object({
  VITE_API_BASE_URL: z.string().url().default('http://localhost:8000'),
  VITE_API_MODE: z.enum(['mock', 'real']).optional(),
  VITE_SMART_CLIENT_ID: z.string().min(1).optional(),
  VITE_EMBED_HOST_ORIGIN: z.string().url().optional(),
  VITE_EMBED_FRAME_ANCESTORS: z.string().min(1).optional(),
  // Escape hatch for environments shipping before any feature adopts the
  // registry (e.g. the throwaway demo). Set to "true" to skip the boot guard.
  VITE_ALLOW_EMPTY_REGISTRY: z.string().optional(),
  PROD: z.boolean(),
  DEV: z.boolean(),
})

const parsed = envSchema.parse(import.meta.env)

export const env = {
  API_BASE_URL: parsed.VITE_API_BASE_URL,
  API_MODE: parsed.VITE_API_MODE,
  SMART_CLIENT_ID: parsed.VITE_SMART_CLIENT_ID,
  EMBED_HOST_ORIGIN: parsed.VITE_EMBED_HOST_ORIGIN,
  EMBED_FRAME_ANCESTORS: parsed.VITE_EMBED_FRAME_ANCESTORS,
  ALLOW_EMPTY_REGISTRY: parsed.VITE_ALLOW_EMPTY_REGISTRY === 'true',
  PROD: parsed.PROD,
  DEV: parsed.DEV,
} as const

export type Env = typeof env
