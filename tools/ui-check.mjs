// ui check: the client layers' rules, which the feat check runs over every
// package's sources.
//
// - Only the UI core (`<app>/core/ui/ts`) holds CSS: no other `.svelte`
//   file has a <style> block or a style attribute, so no page or block
//   styles itself.
// - State lives in hooks: `$state` appears only in a state class under
//   `hooks/`, a `*.svelte.ts` file, which a `use*` hook puts in context.
// - Client code keeps no module-level mutable state: it would be shared by
//   every request the server renders. No top-level `let` or `var` in a
//   hook, an app or component module, or a component's `<script module>`.
// - The client layers import no server layer: no `.svelte` file and no
//   module under `app/`, `hooks/` or `components/` imports a package's
//   `api`, its `drivers`, `handlers` or `interfaces`, `@cella/*-db` or `pg`.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const client = /(^|\/)src\/(app|hooks|components)\//
const server = /(^|\/)(api|drivers|handlers|interfaces)(\/|\.ts$|$)/

const imports = (text) => [...text.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)].map((m) => m[1])

const style = (text) => {
  const markup = text.replace(/<script[\s\S]*?<\/script>/g, '')
  return /<style[\s>]/.test(markup) || /\sstyle\s*=/.test(markup) || /\sstyle:[\w-]+/.test(markup)
}

// Unindented `let` or `var` in a module's own scope; in a component, only
// in its `<script module>`, whose top level is indented once.
const mutable = (path, text) => {
  if (path.endsWith('.svelte')) {
    const module = text.match(/<script[^>]*\smodule[^>]*>([\s\S]*?)<\/script>/)
    return module ? /^ {0,2}(export\s+)?(let|var)\s/m.test(module[1]) : false
  }
  return /^(export\s+)?(let|var)\s/m.test(text)
}

// The problems of one source file. `path` is relative to the repository;
// `ui` says whether it sits in the UI core.
export function problems(path, text, ui) {
  const out = []
  const svelte = path.endsWith('.svelte')
  const layer = svelte || client.test(path)
  if (svelte && !ui && style(text)) {
    out.push(`${path}: styles itself; only the UI core holds CSS, so compose its components`)
  }
  if (/\$state(\.raw)?\s*[(<]/.test(text) && !(path.endsWith('.svelte.ts') && /(^|\/)hooks\//.test(path))) {
    out.push(`${path}: holds $state; state lives in a hook's state class, hooks/*.svelte.ts`)
  }
  if (layer && mutable(path, text)) {
    out.push(`${path}: keeps module-level mutable state, which every request the server renders would share`)
  }
  if (layer) {
    for (const spec of imports(text)) {
      const relative = spec.startsWith('.')
      if ((relative && server.test(spec)) || (!relative && (/\/api$/.test(spec) || /^@cella\/[\w-]+-db$/.test(spec) || spec === 'pg'))) {
        out.push(`${path}: imports ${spec}, a server layer, from a client layer`)
      }
    }
  }
  return out
}

const walk = (repo, dir, out = []) => {
  for (const name of readdirSync(join(repo, dir))) {
    const path = join(dir, name)
    if (['node_modules', 'build', '.svelte-kit'].includes(name)) {
      continue
    }
    if (statSync(join(repo, path)).isDirectory()) {
      walk(repo, path, out)
    } else if (/\.(svelte|ts)$/.test(name)) {
      out.push(path)
    }
  }
  return out
}

// Every package's `src/`; a package is in the UI core when it sits at
// `<node>/core/ui/ts`.
export function checkUi(repo, dirs) {
  const out = []
  for (const dir of dirs) {
    if (!existsSync(join(repo, dir, 'src'))) {
      continue
    }
    const ui = dir.split(sep).slice(-3).join('/') === 'core/ui/ts'
    for (const file of walk(repo, join(dir, 'src'))) {
      out.push(...problems(relative(repo, join(repo, file)), readFileSync(join(repo, file), 'utf8'), ui))
    }
  }
  return out
}
