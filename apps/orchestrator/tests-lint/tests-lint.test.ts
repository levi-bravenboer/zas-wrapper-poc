import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const orchestratorRoot = path.resolve(__dirname, '..')

// Use lintText with a synthetic filePath under src/** so the rules scoped to
// `src/**/*.{ts,tsx}` actually apply. The on-disk fixture lives under
// tests-lint/violations/** (which is globalIgnored to keep the default
// `eslint .` pass clean), so we can't lintFiles() it directly.
async function lintFixture(fixture: string, syntheticPath: string) {
  const eslint = new ESLint({
    cwd: orchestratorRoot,
    overrideConfigFile: path.join(orchestratorRoot, 'eslint.config.js'),
  })
  const source = await readFile(path.join(__dirname, 'violations', fixture), 'utf8')
  const results = await eslint.lintText(source, {
    filePath: path.join(orchestratorRoot, syntheticPath),
  })
  return results[0]
}

describe('DataTable encapsulation lint rules (§26)', () => {
  it('§26.1 flags raw <table> outside the Table primitive', async () => {
    const result = await lintFixture('raw-table.tsx', 'src/modules/example/raw-table.tsx')
    const messages = result.messages.map((m) => m.message)
    expect(
      messages.some((m) =>
        m.includes(
          'Use `DataTable<T>` for lists; raw `<table>` only allowed inside the `Table` primitive.',
        ),
      ),
    ).toBe(true)
  })

  it('§26.2 flags @tanstack/react-table imports outside data-table/**', async () => {
    const result = await lintFixture('tanstack-import.ts', 'src/modules/example/tanstack-import.ts')
    const messages = result.messages.map((m) => m.message)
    expect(
      messages.some((m) =>
        m.includes(
          'TanStack Table is an implementation detail of DataTable; import from `@/components/data-table` instead.',
        ),
      ),
    ).toBe(true)
  })

  it('§26.3 flags @/components/ui/table imports outside data-table/** and tests', async () => {
    const result = await lintFixture('ui-table-import.ts', 'src/modules/example/ui-table-import.ts')
    const messages = result.messages.map((m) => m.message)
    expect(
      messages.some((m) =>
        m.includes(
          'Import `DataTable` from `@/components/data-table`; the `Table` primitive is internal.',
        ),
      ),
    ).toBe(true)
  })

  it('§26.4 flags useQuery against `?page=` list-endpoint literals', async () => {
    const result = await lintFixture('raw-use-query.ts', 'src/modules/example/raw-use-query.ts')
    const messages = result.messages.map((m) => m.message)
    expect(messages.some((m) => m.includes('Use `usePaginatedQuery` for paginated lists.'))).toBe(
      true,
    )
  })

  it('§26.2 allows @tanstack/react-table imports inside data-table/**', async () => {
    const result = await lintFixture('tanstack-import.ts', 'src/components/data-table/internal.ts')
    const messages = result.messages.map((m) => m.message)
    expect(messages.some((m) => m.includes('TanStack Table is an implementation detail'))).toBe(
      false,
    )
  })

  it('§26.3 allows @/components/ui/table imports inside tests', async () => {
    const result = await lintFixture('ui-table-import.ts', 'src/components/foo.test.ts')
    const messages = result.messages.map((m) => m.message)
    expect(messages.some((m) => m.includes('the `Table` primitive is internal'))).toBe(false)
  })
})
