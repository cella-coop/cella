// Check the named diagram registry and the metadata exported by every Svelte diagram.
import { readFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export function check(dir, parse, site) {
  const source = readFileSync(join(dir, 'src/index.ts'), 'utf8')
  const registered = [...source.matchAll(/from ['"]\.\/([^'"/]+\.svelte)['"]/g)].map((m) => m[1])
  const files = readdirSync(join(dir, 'src')).filter((f) => f.endsWith('.svelte'))
  const errors = []
  for (const file of files) {
    if (!registered.includes(file)) errors.push(`${file}: not listed in src/index.ts`)
    const ast = parse(readFileSync(join(dir, 'src', file), 'utf8'), { filename: file, modern: true })
    const meta = ast.module?.content.body
      .filter((n) => n.type === 'ExportNamedDeclaration')
      .flatMap((n) => n.declaration?.declarations ?? [])
      .find((n) => n.id.name === 'meta')?.init
    const object = meta?.type === 'TSAsExpression' ? meta.expression : meta
    const properties = object?.type === 'ObjectExpression' ? object.properties : []
    const value = (key) => properties.find((p) => p.key?.name === key)?.value?.value
    if (!value('title') || !value('alt') || value('made') !== 'ai') {
      errors.push(`${file}: meta must export title, alt and made: "ai"`)
    }
  }
  for (const file of registered) if (!files.includes(file)) errors.push(`src/index.ts: missing ${file}`)
  // The registry's keys must name exactly their files, including when aliases are used.
  for (const file of files) if (!source.includes(`'${file.slice(0, -7)}':`)) errors.push(`${file}: registry key must match filename`)
  // Every diagram the text names: a <Diagram name> in an MDX body, or a
  // figure's `diagram:` in a page's YAML or a section's frontmatter.
  if (site) {
    const content = join(site, 'src/content')
    for (const file of walk(content).filter((name) => /\.(mdx|ya?ml)$/.test(name))) {
      const text = readFileSync(join(content, file), 'utf8')
      const named = [
        ...text.matchAll(/<Diagram\s+name=["']([^"']+)["']/g),
        ...text.matchAll(/\bdiagram:[ \t]*["']?([a-z0-9-]+)["']?/g),
      ]
      for (const match of named) {
        if (!files.includes(`${match[1]}.svelte`)) errors.push(`${file}: unknown diagram ${match[1]}`)
      }
    }
  }
  return errors
}

const walk = (dir, at = '') =>
  readdirSync(join(dir, at), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(dir, join(at, e.name)) : [join(at, e.name)],
  )

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dir = resolve(process.argv[2] ?? 'packages/diagrams')
  const require = createRequire(join(dir, 'package.json'))
  const { parse } = require('svelte/compiler')
  const errors = check(dir, parse, process.argv[3] && resolve(process.argv[3]))
  for (const error of errors) console.error(error)
  if (errors.length) process.exit(1)
  console.log('site diagrams: every component is registered and marked AI-generated')
}
