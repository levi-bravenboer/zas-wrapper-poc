import { Generator, getConfig } from '@tanstack/router-generator'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const config = await getConfig({}, root)
const generator = new Generator({ config, root })
await generator.run()
console.log('route tree generated')
