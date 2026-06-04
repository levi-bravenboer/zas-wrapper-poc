import { describe, expect, it } from 'vitest'

import { envSchema } from './env'

describe('envSchema', () => {
  it('defaults VITE_API_BASE_URL when missing', () => {
    const parsed = envSchema.parse({ PROD: false, DEV: true })
    expect(parsed.VITE_API_BASE_URL).toBe('http://localhost:8000')
    expect(parsed.VITE_API_MODE).toBeUndefined()
    expect(parsed.VITE_SMART_CLIENT_ID).toBeUndefined()
  })

  it('accepts a valid URL override', () => {
    const parsed = envSchema.parse({
      PROD: true,
      DEV: false,
      VITE_API_BASE_URL: 'https://api.example.com',
    })
    expect(parsed.VITE_API_BASE_URL).toBe('https://api.example.com')
    expect(parsed.PROD).toBe(true)
  })

  it('rejects an invalid URL', () => {
    expect(() =>
      envSchema.parse({ PROD: false, DEV: true, VITE_API_BASE_URL: 'not a url' }),
    ).toThrow()
  })

  it('restricts VITE_API_MODE to mock or real', () => {
    expect(envSchema.parse({ PROD: false, DEV: true, VITE_API_MODE: 'mock' }).VITE_API_MODE).toBe(
      'mock',
    )
    expect(() => envSchema.parse({ PROD: false, DEV: true, VITE_API_MODE: 'staging' })).toThrow()
  })

  it('rejects an empty VITE_SMART_CLIENT_ID', () => {
    expect(() => envSchema.parse({ PROD: false, DEV: true, VITE_SMART_CLIENT_ID: '' })).toThrow()
  })

  it('requires PROD and DEV booleans', () => {
    expect(() => envSchema.parse({})).toThrow()
  })
})
