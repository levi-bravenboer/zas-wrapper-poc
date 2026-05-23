import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const SCRIPT = resolve(__dirname, '../gen-feature.ts')
const APP_ROOT = resolve(__dirname, '../..')

function run(args: readonly string[]): { status: number; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync('pnpm', ['exec', 'tsx', SCRIPT, ...args], {
      cwd: APP_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { status: 0, stdout, stderr: '' }
  } catch (err) {
    const e = err as { status?: number; stdout?: Buffer | string; stderr?: Buffer | string }
    return {
      status: e.status ?? 1,
      stdout: typeof e.stdout === 'string' ? e.stdout : (e.stdout?.toString() ?? ''),
      stderr: typeof e.stderr === 'string' ? e.stderr : (e.stderr?.toString() ?? ''),
    }
  }
}

describe('gen:feature', () => {
  it('plans the app-only file set without FHIR adapters', () => {
    const { status, stdout } = run([
      'observations',
      '--surfaces',
      'app',
      '--title-nl',
      'Observaties',
      '--dry-run',
    ])
    expect(status).toBe(0)
    expect(stdout).toContain('src/modules/observations/adapters/orchestrator.ts')
    expect(stdout).toContain('src/routes/_auth/observations.tsx')
    expect(stdout).not.toContain('adapters/fhir.ts')
    expect(stdout).not.toContain('schemas.ts')
    expect(stdout).not.toContain('routes/s/observations.tsx')
    expect(stdout).not.toContain('routes/embed/observations.tsx')
  })

  it('plans the embed-only file set without orchestrator adapter', () => {
    const { status, stdout } = run([
      'observations',
      '--surfaces',
      'embed',
      '--fhir-scopes',
      'patient/Observation.read',
      '--requires',
      'patient',
      '--title-nl',
      'Observaties',
      '--dry-run',
    ])
    expect(status).toBe(0)
    expect(stdout).toContain('src/modules/observations/adapters/fhir.ts')
    expect(stdout).toContain('src/modules/observations/schemas.ts')
    expect(stdout).toContain('src/routes/embed/observations.tsx')
    expect(stdout).not.toContain('adapters/orchestrator.ts')
    expect(stdout).not.toContain('src/routes/_auth/observations.tsx')
  })

  it('refuses to overwrite an existing module', () => {
    const { status, stderr } = run(['tasks', '--surfaces', 'app', '--title-nl', 'Taken'])
    expect(status).not.toBe(0)
    expect(stderr).toContain("feature 'tasks' already exists")
  })

  it('rejects missing required flags', () => {
    const { status, stderr } = run(['observations'])
    expect(status).not.toBe(0)
    expect(stderr).toContain('--surfaces is required')
  })

  it('requires fhir-scopes when smart/embed selected', () => {
    const { status, stderr } = run([
      'observations',
      '--surfaces',
      'app,smart',
      '--title-nl',
      'Observaties',
    ])
    expect(status).not.toBe(0)
    expect(stderr).toContain('--fhir-scopes is required')
  })
})
