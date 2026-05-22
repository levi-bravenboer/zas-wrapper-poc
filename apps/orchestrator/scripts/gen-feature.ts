/* eslint-disable no-console */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const APP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = resolve(APP_ROOT, 'src')

const SURFACES = ['app', 'smart', 'embed'] as const
type Surface = (typeof SURFACES)[number]

const REQUIRES = ['patient', 'encounter', 'user'] as const
type Requirement = (typeof REQUIRES)[number]

interface Args {
  id: string
  path: string
  surfaces: readonly Surface[]
  fhirScopes: readonly string[]
  requires: readonly Requirement[]
  titleNl: string
  dryRun: boolean
}

function parseArgs(argv: readonly string[]): Args {
  const flags = new Map<string, string>()
  let positional: string | undefined
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!
    if (arg.startsWith('--')) {
      const key = arg.slice(2)
      const value = argv[i + 1]
      if (value === undefined || value.startsWith('--')) {
        if (key === 'dry-run') {
          flags.set(key, 'true')
          continue
        }
        fail(`flag --${key} requires a value`)
      }
      flags.set(key, value)
      i++
    } else if (!positional) {
      positional = arg
    }
  }

  const id = flags.get('id') ?? positional
  if (!id) fail('feature id is required (positional or --id)')
  if (!/^[a-z][a-z0-9-]*$/.test(id)) fail(`id '${id}' must be kebab-case`)

  const path = flags.get('path') ?? `/${id}`

  const surfacesRaw = flags.get('surfaces')
  if (!surfacesRaw) fail('--surfaces is required')
  const surfaces = surfacesRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean) as Surface[]
  for (const s of surfaces) {
    if (!SURFACES.includes(s)) fail(`unknown surface '${s}'`)
  }
  if (surfaces.length === 0) fail('--surfaces must list at least one surface')

  const fhirNeeded = surfaces.some((s) => s === 'smart' || s === 'embed')
  const fhirScopes = (flags.get('fhir-scopes') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const requires = (flags.get('requires') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean) as Requirement[]
  if (fhirNeeded) {
    if (fhirScopes.length === 0)
      fail('--fhir-scopes is required when smart/embed surfaces are selected')
    if (requires.length === 0) fail('--requires is required when smart/embed surfaces are selected')
    for (const r of requires) {
      if (!REQUIRES.includes(r)) fail(`unknown requirement '${r}'`)
    }
  }

  const titleNl = flags.get('title-nl')
  if (!titleNl) fail('--title-nl is required')

  return {
    id,
    path,
    surfaces,
    fhirScopes,
    requires,
    titleNl,
    dryRun: flags.get('dry-run') === 'true',
  }
}

function fail(message: string): never {
  console.error(`Error: ${message}`)
  process.exit(1)
}

function pascal(id: string): string {
  return id
    .split('-')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('')
}

function buildFiles(args: Args): Map<string, string> {
  const files = new Map<string, string>()
  const { id, path, surfaces, fhirScopes, requires, titleNl } = args
  const Page = `${pascal(id)}Page`
  const hasApp = surfaces.includes('app')
  const hasFhir = surfaces.includes('smart') || surfaces.includes('embed')

  const adapters: string[] = []
  const adapterImports: string[] = []
  if (hasApp) {
    adapterImports.push(`import { orchestrator${pascal(id)}Port } from './adapters/orchestrator'`)
    adapters.push(`    orchestrator: orchestrator${pascal(id)}Port,`)
  }
  if (hasFhir) {
    adapterImports.push(`import { fhir${pascal(id)}Port } from './adapters/fhir'`)
    adapters.push(`    fhir: fhir${pascal(id)}Port,`)
  }

  const smartBlock = hasFhir
    ? `  smart: {
    scopes: [${fhirScopes.map((s) => `'${s}'`).join(', ')}],
    requires: [${requires.map((r) => `'${r}'`).join(', ')}],
  },\n`
    : ''

  files.set(
    `src/modules/${id}/index.ts`,
    `import { Square } from 'lucide-react'

import { defineFeature } from '@/platform/embed/defineFeature'

${adapterImports.join('\n')}
import { ${id.replace(/-/g, '')}Port } from './ports'
import { ${Page} } from './${Page}'

export const ${id.replace(/-/g, '')}Feature = defineFeature({
  id: '${id}',
  path: '${path}',
  titleKey: 'nav.${id}',
  page: ${Page},
  port: ${id.replace(/-/g, '')}Port,
  surfaces: [${surfaces.map((s) => `'${s}'`).join(', ')}] as const,
  adapters: {
${adapters.join('\n')}
  },
${smartBlock}  nav: { icon: Square, order: 99 },
})
`,
  )

  files.set(
    `src/modules/${id}/${Page}.tsx`,
    `import { useTranslation } from 'react-i18next'

import { ${id.replace(/-/g, '')}Port } from './ports'

export function ${Page}() {
  const { t } = useTranslation('nav')
  const port = ${id.replace(/-/g, '')}Port.use()
  void port
  return (
    <section className="mx-auto max-w-3xl p-8">
      <h1 className="text-5xl font-bold tracking-tight">{t('${id}')}</h1>
    </section>
  )
}
`,
  )

  files.set(
    `src/modules/${id}/ports.ts`,
    `import { createPort } from '@/platform/ports/createPort'

import type { ${pascal(id)} } from './types'

export type ${pascal(id)}Port = {
  readonly list: () => Promise<readonly ${pascal(id)}[]>
}

export const ${id.replace(/-/g, '')}Port = createPort<${pascal(id)}Port>('${pascal(id)}')
`,
  )

  files.set(
    `src/modules/${id}/types.ts`,
    `export type ${pascal(id)} = {
  readonly id: string
}
`,
  )

  if (hasApp) {
    files.set(
      `src/modules/${id}/adapters/orchestrator.ts`,
      `import type { OrchestratorDeps } from '@/platform/embed/depsContext'

import type { ${pascal(id)}Port } from '../ports'

export function orchestrator${pascal(id)}Port(_deps: OrchestratorDeps): ${pascal(id)}Port {
  return {
    async list() {
      return []
    },
  }
}
`,
    )
    files.set(
      `src/routes/_auth/${id}.tsx`,
      `import { createFileRoute } from '@tanstack/react-router'

import { ${id.replace(/-/g, '')}Feature } from '@/modules/${id}'
import { renderFeature } from '@/platform/embed/renderFeature'

export const Route = createFileRoute('/_auth/${id}')({
  component: () => renderFeature(${id.replace(/-/g, '')}Feature),
})
`,
    )
  }

  if (hasFhir) {
    files.set(
      `src/modules/${id}/adapters/fhir.ts`,
      `import type { FhirDeps } from '@/platform/embed/depsContext'

import type { ${pascal(id)}Port } from '../ports'

export function fhir${pascal(id)}Port(_deps: FhirDeps): ${pascal(id)}Port {
  return {
    async list() {
      return []
    },
  }
}
`,
    )
    files.set(
      `src/modules/${id}/schemas.ts`,
      `import { z } from 'zod'

export const ${id.replace(/-/g, '')}Schema = z.object({
  id: z.string(),
})

export type ${pascal(id)}Resource = z.infer<typeof ${id.replace(/-/g, '')}Schema>
`,
    )
  }

  if (surfaces.includes('smart')) {
    files.set(
      `src/routes/s/${id}.tsx`,
      `import { createFileRoute } from '@tanstack/react-router'

import { ${id.replace(/-/g, '')}Feature } from '@/modules/${id}'
import { renderFeature } from '@/platform/embed/renderFeature'

export const Route = createFileRoute('/s/${id}')({
  component: () => renderFeature(${id.replace(/-/g, '')}Feature),
})
`,
    )
  }

  if (surfaces.includes('embed')) {
    files.set(
      `src/routes/embed/${id}.tsx`,
      `import { createFileRoute } from '@tanstack/react-router'

import { ${id.replace(/-/g, '')}Feature } from '@/modules/${id}'
import { renderFeature } from '@/platform/embed/renderFeature'

export const Route = createFileRoute('/embed/${id}')({
  component: () => renderFeature(${id.replace(/-/g, '')}Feature),
})
`,
    )
  }

  files.set(
    `src/modules/${id}/__tests__/${Page}.test.tsx`,
    `import { describe, expect, it } from 'vitest'

import { ${Page} } from '../${Page}'

describe('${Page}', () => {
  it('is defined', () => {
    expect(${Page}).toBeTypeOf('function')
  })
})
`,
  )

  void titleNl
  return files
}

function updateModulesBarrel(id: string): { path: string; before: string; after: string } {
  const file = resolve(SRC, 'modules/index.ts')
  const before = readFileSync(file, 'utf8')
  const exportLine = `export { ${id.replace(/-/g, '')}Feature } from './${id}'`
  if (before.includes(exportLine)) {
    return { path: file, before, after: before }
  }
  const lines = before.split('\n')
  const exportLines = lines.filter((l) => l.startsWith('export {'))
  const otherLines = lines.filter((l) => !l.startsWith('export {'))
  exportLines.push(exportLine)
  exportLines.sort((a, b) => a.localeCompare(b))
  const trailing = otherLines.at(-1) === '' ? '' : '\n'
  const after = [...otherLines.filter((l) => l !== ''), ...exportLines, ''].join('\n')
  return { path: file, before, after: after + trailing.slice(0, 0) }
}

function updateNavLocale(
  id: string,
  titleNl: string,
): { path: string; before: string; after: string } {
  const file = resolve(SRC, 'lib/i18n/locales/nl/nav.json')
  const before = readFileSync(file, 'utf8')
  const parsed = JSON.parse(before) as Record<string, string>
  if (parsed[id] === titleNl) return { path: file, before, after: before }
  parsed[id] = titleNl
  const after = `${JSON.stringify(parsed, null, 2)}\n`
  return { path: file, before, after }
}

function main(): void {
  const args = parseArgs(process.argv.slice(2))
  const featureDir = resolve(SRC, `modules/${args.id}`)
  if (existsSync(featureDir)) {
    fail(`feature '${args.id}' already exists (${featureDir})`)
  }

  const files = buildFiles(args)
  const conflicts: string[] = []
  for (const rel of files.keys()) {
    if (existsSync(resolve(APP_ROOT, rel))) conflicts.push(rel)
  }
  if (conflicts.length > 0) {
    fail(`would overwrite existing files:\n${conflicts.map((c) => `  - ${c}`).join('\n')}`)
  }

  const barrel = updateModulesBarrel(args.id)
  const locale = updateNavLocale(args.id, args.titleNl)

  if (args.dryRun) {
    console.log('Dry run — planned writes:')
    for (const rel of files.keys()) console.log(`  + ${rel}`)
    if (barrel.before !== barrel.after) console.log(`  ~ ${barrel.path.slice(APP_ROOT.length + 1)}`)
    if (locale.before !== locale.after) console.log(`  ~ ${locale.path.slice(APP_ROOT.length + 1)}`)
    return
  }

  for (const [rel, contents] of files) {
    const full = resolve(APP_ROOT, rel)
    mkdirSync(dirname(full), { recursive: true })
    writeFileSync(full, contents)
    console.log(`+ ${rel}`)
  }
  if (barrel.before !== barrel.after) {
    writeFileSync(barrel.path, barrel.after)
    console.log(`~ ${barrel.path.slice(APP_ROOT.length + 1)}`)
  }
  if (locale.before !== locale.after) {
    writeFileSync(locale.path, locale.after)
    console.log(`~ ${locale.path.slice(APP_ROOT.length + 1)}`)
  }

  execFileSync('pnpm', ['exec', 'tsr', 'generate'], { cwd: APP_ROOT, stdio: 'inherit' })
  console.log('routeTree.gen.ts regenerated')
}

main()
