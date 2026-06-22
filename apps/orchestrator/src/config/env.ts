import { z } from 'zod'

export const envSchema = z.object({
  VITE_API_BASE_URL: z.string().url().default('http://localhost:8000'),
  VITE_API_MODE: z.enum(['mock', 'real']).optional(),
  VITE_SMART_CLIENT_ID: z.string().min(1).optional(),
  VITE_EMBED_HOST_ORIGIN: z.string().url().optional(),
  VITE_EMBED_FRAME_ANCESTORS: z.string().min(1).optional(),
  // Build-time toggle: when "true", the patient Metingen tab renders the
  // Luscii-faithful replica instead of the default MeasurementCharts view.
  // Default-off; gated pending PO sign-off (see openspec/mdr-watchlist.md).
  VITE_LUSCII_METINGEN_REPLICA: z.string().optional(),
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
  LUSCII_METINGEN_REPLICA: parsed.VITE_LUSCII_METINGEN_REPLICA === 'true',
  PROD: parsed.PROD,
  DEV: parsed.DEV,
} as const

export type Env = typeof env
