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
// - Effects live in hooks too: `$effect` only in a hook's state class; a
//   component derives, attaches or handles an event instead. An effect
//   writes no `$state` field of its class, which a `$derived` holds
//   instead, or, where only the browser holds it, `onMount` or
//   `afterNavigate` sets; the check sees the writes in the effect's own
//   body, not those of a method it calls.
// - Focus keeps its ring: no rule in a stylesheet or a <style> block sets
//   `outline: none` without drawing `--focus` as its box-shadow, so
//   whatever the keyboard reaches shows where it is.
// - Svelte 5 and SvelteKit 3 only: none of the legacy forms below, which
//   still compile but are what code written from older knowledge reaches
//   for, and no `{@html}`, which would render text as markup.
// - Never native components: no `.svelte` file in the org app draws the
//   browser's own select, date field, checkbox or radio (`<select>`, an
//   `<input>` of type date, datetime-local, month, week, checkbox or
//   radio); it composes the UI core's Select, date field and Checkbox,
//   which are on-brand and accessible in every browser alike.
// - No route loads or acts: no `+page.server.ts` or `+layout.server.ts`
//   under a package's `src/routes/`, and no `load` in a `+page.ts` or
//   `+layout.ts`; a page reads through queries and writes through forms,
//   and what stays on a route's server is a `+server.ts` endpoint.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const client = /(^|\/)src\/(app|hooks|components)\//
const server = /(^|\/)(api|drivers|handlers|interfaces)(\/|\.ts$|$)/

// Legacy forms and what replaces each: in a component's markup, in its
// scripts, and in any source.
const markup = [
  [/\son:[a-z]+[=\s>|]/, 'on:event', 'an onevent attribute'],
  [/<slot[\s/>]/, '<slot>', 'a snippet and {@render}'],
  [/\suse:[\w$]/, 'use:action', '{@attach}, or fromAction over a legacy action'],
  [/\{@const\s/, '{@const}', 'a declaration tag, {const x = $derived(…)}'],
  [/\{@html\s/, '{@html}', 'text, which Svelte escapes'],
  [/\$\$(props|restProps|slots)\b/, '$$props', '$props()'],
]
const scripts = [
  [/^\s*export\s+let\s/m, 'export let', '$props()'],
  [/^\s*\$:/m, '$:', '$derived'],
  [/\bcreateEventDispatcher\b/, 'createEventDispatcher', 'a callback prop'],
]
const anywhere = [
  [/(?<![.\w$])(setContext|getContext|hasContext)\s*\(|import\s*\{[^}]*\b(setContext|getContext|hasContext)\b[^}]*\}\s*from\s*['"]svelte['"]/, 'setContext, getContext or hasContext', 'createContext in a hook'],
  [/['"]svelte\/store['"]/, 'svelte/store', "$state in a hook's state class"],
  [/['"]\$app\/stores['"]/, '$app/stores', '$app/state'],
  [/['"]\$lib[/'"]/, '$lib', '#lib with the file extension'],
  [/['"]\$env\//, '$env', '$app/env, declared in src/env.ts'],
  [/\binvalidateAll\b/, 'invalidateAll', 'refreshAll'],
]

const legacy = (path, text) => {
  const out = []
  const found = (rules, source) => {
    for (const [re, form, instead] of rules) {
      if (re.test(source)) {
        out.push(`${path}: uses ${form}; use ${instead}`)
      }
    }
  }
  if (path.endsWith('.svelte')) {
    found(markup, text.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<!--[\s\S]*?-->/g, ''))
    found(scripts, [...text.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n'))
  } else if (/\.svelte\.ts$/.test(path)) {
    found(scripts, text)
  }
  found(anywhere, text)
  return out
}

// The `$state` fields of a state class that an `$effect` writes in its own
// body, its teardown with it: `this.x = …`, `this.#x ??= …`, `this.x++`.
const effected = (text) => {
  const fields = new Set([...text.matchAll(/^\s*(#?[\w$]+)\s*(?::[^=\n]+)?=\s*\$state(?:\.raw)?\s*[(<]/gm)].map((m) => m[1]))
  const written = new Set()
  for (const m of text.matchAll(/\$effect(?:\.pre)?\s*\(/g)) {
    let depth = 1
    let end = m.index + m[0].length
    for (; end < text.length && depth > 0; end++) {
      depth += text[end] === '(' ? 1 : text[end] === ')' ? -1 : 0
    }
    const body = text.slice(m.index + m[0].length, end)
    const writes = [...body.matchAll(/\bthis\.(#?[\w$]+)\s*(?:(?:[-+*/%&|^]|\*\*|<<|>>>?|&&|\|\||\?\?)?=(?!=)|\+\+|--)/g), ...body.matchAll(/(?:\+\+|--)\s*this\.(#?[\w$]+)/g)]
    for (const [, name] of writes) {
      if (fields.has(name)) {
        written.add(name)
      }
    }
  }
  return [...written]
}

const imports = (text) => [...text.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)].map((m) => m[1])

const style = (text) => {
  const markup = text.replace(/<script[\s\S]*?<\/script>/g, '')
  return /<style[\s>]/.test(markup) || /\sstyle\s*=/.test(markup) || /\sstyle:[\w-]+/.test(markup)
}

// The selectors of a stylesheet's rules, or a component's <style> blocks',
// that set `outline: none` and draw no ring: each innermost block, past
// comments.
const ringless = (path, text) => {
  const css = path.endsWith('.css') ? text : [...text.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n')
  return [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]*)\{([^{}]*)\}/g)]
    .filter(([, , body]) => /(^|[;{\s])outline\s*:\s*(none|0)\s*(!important\s*)?(;|$)/.test(body) && !/box-shadow\s*:[^;]*var\(--focus\)/.test(body))
    .map(([, selector]) => selector.trim().replace(/\s+/g, ' '))
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

// A shell's collection page renders the UI core's one Collection and
// nothing beside it: what a collection shows is configured on it, never a
// page's own markup. The tags its markup opens, past control blocks; the
// boundary its content sits in, with the UI core's Skeleton and Failed in
// its snippets, is the page's frame, as on an item's page.
const collectionPage = /(^|\/)ts\/src\/routes\/\[collection\]\/\+page\.svelte$/
// A shell's item page renders the UI core's one Detail, and in it only
// the blocks its slices declare (`b.block`): no page frames a record
// itself.
const itemPage = /(^|\/)ts\/src\/routes\/\[collection\]\/\[id\]\/\+page\.svelte$/
// The boundary a page's queries are awaited in, and what it draws while
// they load and when one throws.
const bounded = new Set(['svelte:boundary', 'Skeleton', 'Failed'])
const tags = (text) =>
  [...text.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<!--[\s\S]*?-->/g, '').matchAll(/<([A-Za-z][\w.:-]*)/g)].map((m) => m[1])

// The browser's own controls, which the UI core's replace: in an org
// app's markup, past its scripts, styles and comments.
const org = /^apps\/org\//
const natives = [
  [/<select[\s>/]/, 'a native <select>', "the UI core's Select"],
  [/<input\b[^>]*\stype\s*=\s*["']?(date|datetime-local|month|week)["'\s/>]/, 'a native date input', "the UI core's Field of type date"],
  [/<input\b[^>]*\stype\s*=\s*["']?(checkbox|radio)["'\s/>]/, 'a native checkbox or radio', "the UI core's Checkbox, or a button group"],
]
const markupOf = (text) => text.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<!--[\s\S]*?-->/g, '')

// A route's server load or actions, and a universal load.
const routed = /(^|\/)src\/routes\/(.*\/)?\+(page|layout)(\.server)?\.ts$/
const loads = /^\s*export\s+(const|let|var|(async\s+)?function)\s+load\b|^\s*export\s*\{[^}]*\bload\b[^}]*\}/m

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
  if (/\b(localStorage|sessionStorage|indexedDB)\b/.test(text) && !(path.endsWith('.svelte.ts') && /(^|\/)hooks\//.test(path))) {
    out.push(`${path}: reaches browser storage; a viewer's preference is kept by a hook's state class, behind try and catch`)
  }
  if (/\$effect(\.pre)?\s*\(/.test(text) && !(path.endsWith('.svelte.ts') && /(^|\/)hooks\//.test(path))) {
    out.push(`${path}: runs an $effect; an effect lives in a hook's state class, and a component derives, attaches or handles an event`)
  }
  for (const field of effected(text)) {
    out.push(`${path}: writes the $state field ${field} in an $effect; derive it with $derived, or set what only the browser holds in onMount or afterNavigate`)
  }
  out.push(...legacy(path, text))
  const route = path.match(routed)
  if (route && route[4]) {
    out.push(`${path}: is a route's server load or actions; read through a query and write through a form in src/lib/remote, redirect in the server hook, or serve a +server.ts endpoint`)
  } else if (route && loads.test(text)) {
    out.push(`${path}: exports a load; read through a query in src/lib/remote, awaited under a boundary`)
  }
  if (svelte && org.test(path)) {
    const drawn = markupOf(text)
    for (const [re, what, instead] of natives) {
      if (re.test(drawn)) {
        out.push(`${path}: draws ${what}; never native components: compose ${instead}`)
      }
    }
  }
  for (const selector of ringless(path, text)) {
    out.push(`${path}: ${selector} sets outline: none and draws no ring; draw box-shadow: var(--focus) with it, or leave focus to :focus-visible`)
  }
  // An up or down arrow on a control that moves something is a reorder
  // button, which dragging replaces.
  for (const spec of imports(text)) {
    if (/^phosphor-svelte\/lib\/Arrow(Fat|Line)?(Up|Down)$/.test(spec) && /move/i.test(text.replace(/<script[\s\S]*?<\/script>/g, ''))) {
      out.push(`${path}: reorders with ${spec.split('/').pop()} buttons; items reorder by dragging, with the UI core's sortable`)
    }
  }
  // A menu floated by hand, absolutely positioned over a stacking order,
  // is clipped by whatever scrolls around it; the UI core's Popover puts
  // it in the top layer.
  if (svelte && !path.endsWith('/Popover.svelte')) {
    for (const [, body] of text.replace(/<script[\s\S]*?<\/script>/g, '').matchAll(/\{([^{}]*)\}/g)) {
      if (/position:\s*absolute/.test(body) && /z-index/.test(body)) {
        out.push(`${path}: floats its own layer with position: absolute and z-index; open it in the UI core's Popover`)
        break
      }
    }
  }
  if (collectionPage.test(path)) {
    for (const tag of new Set(tags(text).filter((t) => t !== 'Collection' && !bounded.has(t)))) {
      out.push(`${path}: renders <${tag}> beside the Collection; configure the collection's view instead`)
    }
  }
  if (itemPage.test(path)) {
    const drawn = tags(text)
    if (!drawn.includes('Detail')) {
      out.push(`${path}: draws no <Detail>; every record opens on the UI core's one record page`)
    }
    for (const tag of new Set(drawn.filter((t) => t !== 'Detail' && !t.includes('.') && !bounded.has(t)))) {
      out.push(`${path}: renders <${tag}> beside the Detail; a record's page is the Detail and its slices' blocks`)
    }
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
    } else if (/\.(svelte|ts|css)$/.test(name)) {
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
