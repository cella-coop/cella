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
//   browser's own select, date or time field, checkbox, radio or file
//   field (`<select>`, an `<input>` of type date, datetime-local, month,
//   week, time, checkbox, radio or file); it composes the UI core's
//   Select, date, time and file Field and Checkbox, which are on-brand and
//   accessible in every browser alike. A file input carrying `hidden` is
//   allowed: the file picker keeps one inside, unseen, for the form to
//   post.
// - No route loads or acts: no `+page.server.ts` or `+layout.server.ts`
//   under a package's `src/routes/`, and no `load` in a `+page.ts` or
//   `+layout.ts`; a page reads through queries and writes through forms,
//   and what stays on a route's server is a `+server.ts` endpoint.
// - A create form opens only in New's Dialog: no component imports a
//   create form a slice's app declares (`create:` in its `app/index.ts`),
//   so no page or block draws one inline, and the UI core draws a
//   collection's `creates` only inside its one Dialog. A form a block
//   draws on its own page that creates a record of another kind no tool
//   sees; review holds it.
// - No page draws a Save button: a `Form` whose `submit` starts with
//   Save is drawn only inside the shared `Dialog` or `ProposeInstead`;
//   a page's own Save is refused by name, wherever it is drawn.
// - A record's overview is laid out by its page's layout (`layouts`):
//   every block on it, its owner's or an extension's, the body alone
//   excepted, is a panel, drawing only `Panel`s at its top level; a
//   `panels` page shows a panel, and a `body` page declares its body.
// - Panels are one system (`panels`): a `Button`, or a `Form` drawing
//   its own button, inside a `Panel`'s body is refused, since its key
//   actions are its footer's (`actions`), a bare form's submit among
//   them by the form's id; the retired `Inlay` and `Widget` are refused
//   by name; an empty state is `Empty`, never a `Note` drawn `quiet`; a
//   list of totals is a `Table`'s `totals`, never a `Sheet` of one
//   unnamed column (`columns={['']}`).
// - A computed figure is no property (`figures`): a slice's `properties`
//   holding a `money` or `number` value is refused; it declares it in
//   `figures`, a `Stat` on the overview's Figures panel.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, normalize, relative, sep } from 'node:path'
import { pages } from './tabs.mjs'

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
// the blocks its slices declare (`b.block`) and, in a tab listing a
// collection scoped to the record, the one Collection: no page frames a
// record itself.
const itemPage = /(^|\/)ts\/src\/routes\/\[collection\]\/\[id\]\/\+page\.svelte$/
// The boundary a page's queries are awaited in, and what it draws while
// they load and when one throws.
const bounded = new Set(['svelte:boundary', 'Skeleton', 'Failed'])
const tags = (text) =>
  [...text.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<!--[\s\S]*?-->/g, '').matchAll(/<([A-Za-z][\w.:-]*)/g)].map((m) => m[1])

// The browser's own controls, which the UI core's replace: in an org
// app's markup, past its scripts, styles and comments.
const org = /^apps\/org\//
const natives = [[/<select[\s>/]/, 'a native <select>', "the UI core's Select"]]
// An `<input>`'s types that are the browser's own controls; a file input
// may be drawn `hidden`, as the file picker's own.
const inputs = [
  [/^(date|datetime-local|month|week)$/, 'a native date input', "the UI core's Field of type date"],
  [/^time$/, 'a native time input', "the UI core's Field of type time"],
  [/^(checkbox|radio)$/, 'a native checkbox or radio', "the UI core's Checkbox, or a button group"],
  [/^file$/, 'a native file input', "the UI core's Field of type file", 'hidden'],
]

// Each `<input>` tag drawn, read whole past a `>` in a `{…}` expression or
// a quoted value, as an arrow's, its expressions emptied to `{}`.
function inputTags(drawn) {
  const out = []
  for (const m of drawn.matchAll(/<input\b/g)) {
    let tag = ''
    let depth = 0
    let quote = null
    for (let i = m.index; i < drawn.length; i++) {
      const c = drawn[i]
      if (depth > 0) {
        depth += c === '{' ? 1 : c === '}' ? -1 : 0
        tag += depth === 0 ? '}' : ''
        continue
      }
      if (quote) {
        quote = c === quote ? null : quote
      } else if (c === '"' || c === "'") {
        quote = c
      } else if (c === '{') {
        depth = 1
      }
      tag += c
      if (!quote && c === '>') {
        break
      }
    }
    out.push(tag)
  }
  return out
}
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
    const found = new Set(natives.filter(([re]) => re.test(drawn)))
    for (const tag of inputTags(drawn)) {
      const type = tag.match(/\stype\s*=\s*["']?([\w-]+)/)?.[1]?.toLowerCase() ?? ''
      const hidden = /\shidden(?=[\s/>=])/.test(tag)
      for (const rule of inputs) {
        if (rule[0].test(type) && !(rule[3] === 'hidden' && hidden)) {
          found.add(rule)
        }
      }
    }
    for (const [, what, instead] of [...natives, ...inputs].filter((r) => found.has(r))) {
      out.push(`${path}: draws ${what}; never native components: compose ${instead}`)
    }
  }
  for (const selector of ringless(path, text)) {
    out.push(`${path}: ${selector} sets outline: none and draws no ring; draw box-shadow: var(--focus) with it, or leave focus to :focus-visible`)
  }
  // An up or down arrow or caret on a control that moves something is a reorder
  // button, which dragging replaces.
  for (const spec of imports(text)) {
    if (/^phosphor-svelte\/lib\/(Arrow(Fat|Line)?|Caret)(Up|Down)$/.test(spec) && /move/i.test(text.replace(/<script[\s\S]*?<\/script>/g, ''))) {
      out.push(`${path}: reorders with ${spec.split('/').pop()} buttons; items reorder by dragging, with the UI core's sortable`)
    }
  }
  // A menu floated by hand, absolutely positioned over a stacking order,
  // is clipped by whatever scrolls around it; the UI core's Popover puts
  // it in the top layer. A layer drawn under its own element's content,
  // at a z-index below zero, as a button's cell, floats over nothing.
  if (svelte && !path.endsWith('/Popover.svelte')) {
    for (const [, body] of text.replace(/<script[\s\S]*?<\/script>/g, '').matchAll(/\{([^{}]*)\}/g)) {
      if (/position:\s*absolute/.test(body) && /z-index:\s*[^-\s]/.test(body)) {
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
    for (const tag of new Set(drawn.filter((t) => t !== 'Detail' && t !== 'Collection' && !t.includes('.') && !bounded.has(t)))) {
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

// The create forms the slices' apps declare, by the file each is, and the
// app that declares it: `create: Name`, `Name` imported from a component.
const declared = (sources) => {
  const out = new Map()
  for (const { path, text } of sources) {
    if (!/(^|\/)src\/app\/index\.ts$/.test(path)) {
      continue
    }
    const from = new Map([...text.matchAll(/^import\s+([\w$]+)\s+from\s+['"](\.[^'"]+\.svelte)['"]/gm)].map((m) => [m[1], m[2]]))
    for (const [, name] of text.matchAll(/\bcreate:\s*([\w$]+)/g)) {
      if (from.has(name)) {
        out.set(normalize(join(dirname(path), from.get(name))), path)
      }
    }
  }
  return out
}

// Whether `{#each creates` at `at` sits inside a `<Dialog>` of the markup.
const inDialog = (markup, at) => {
  const before = markup.slice(0, at)
  return (before.match(/<Dialog[\s>]/g) ?? []).length > (before.match(/<\/Dialog>/g) ?? []).length
}

// Whether `at` sits inside an unclosed `<tag>` of the markup; a
// self-closing `<tag … />` opens nothing.
const enclosedIn = (markup, at, tag) => {
  const before = markup.slice(0, at)
  const opens = [...before.matchAll(new RegExp(`<${tag}\\b[^>]*?(/?)>`, 'g'))].filter((m) => m[1] !== '/').length
  const closes = (before.match(new RegExp(`</${tag}>`, 'g')) ?? []).length
  return opens > closes
}

// A `Form` whose `submit` starts with Save, drawn anywhere but inside
// the shared `Dialog` or `ProposeInstead`: a page holds no Save button,
// only a modal confirms. A declared create form is exempt throughout
// its file: `inlineCreates` already refuses it drawn anywhere but in
// the Dialog behind New, wherever its own confirming button is named.
// `sources` are every file's `{ path, text }`.
export function pageSaves(sources) {
  const out = []
  const forms = declared(sources)
  for (const { path, text } of sources) {
    if (!path.endsWith('.svelte') || forms.has(path)) {
      continue
    }
    const markup = text.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<!--[\s\S]*?-->/g, '')
    for (const m of markup.matchAll(/<Form\b[^>]*\bsubmit\s*=\s*(["'])(Save[^"']*)\1/g)) {
      if (!enclosedIn(markup, m.index, 'Dialog') && !enclosedIn(markup, m.index, 'ProposeInstead')) {
        out.push(`${path}: draws a Form submitting "${m[2]}" on a page; a page holds no Save button, only a modal confirms`)
      }
    }
  }
  return out
}

// A create form drawn anywhere but in New's Dialog: a component importing
// one a slice's app declares, and a UI core component drawing a
// collection's `creates` outside its Dialog. `sources` are every file's
// `{ path, text }`, paths relative to the repository; `ui` says whether a
// path sits in the UI core.
export function inlineCreates(sources, ui = (path) => /(^|\/)core\/ui\/ts\//.test(path)) {
  const out = []
  const forms = declared(sources)
  for (const { path, text } of sources) {
    if (!path.endsWith('.svelte')) {
      continue
    }
    for (const spec of imports(text)) {
      const file = spec.startsWith('.') && normalize(join(dirname(path), spec))
      if (file && forms.has(file)) {
        out.push(`${path}: draws ${file.split('/').pop()}, the create form ${forms.get(file)} declares, inline; a create form opens only in the Dialog behind New`)
      }
    }
    if (ui(path)) {
      const markup = text.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<!--[\s\S]*?-->/g, '')
      for (const m of markup.matchAll(/\{#each\s+creates\b/g)) {
        if (!inDialog(markup, m.index)) {
          out.push(`${path}: draws a collection's create forms outside its Dialog; New opens them in the one Dialog`)
          break
        }
      }
    }
  }
  return out
}

// The elements that hold nothing, which no closing tag follows.
const voids = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'])

// Where a `{…}` or a tag opened at `at` ends: its closing brace or `>`,
// past nested braces and quoted strings, an escaped quote inside one
// closing nothing.
function ending(markup, at, close) {
  let depth = 0
  let quote = null
  for (let i = at; i < markup.length; i++) {
    const c = markup[i]
    if (quote) {
      if (c === '\\') {
        i++
      } else if (c === quote) {
        quote = null
      }
    } else if (c === '"' || c === "'" || c === '`') {
      quote = c
    } else if (c === '{') {
      depth++
    } else if (c === '}') {
      depth--
      if (close === '}' && depth === 0) {
        return i
      }
    } else if (c === '>' && close === '>' && depth === 0) {
      return i
    }
  }
  return markup.length
}

// What a component draws at its top level that is not a panel: every tag,
// text or expression outside a `<Panel>`, past its scripts, styles,
// comments, control blocks, declarations and the snippets it defines.
export function loose(text) {
  const markup = markupOf(text)
  const out = new Set()
  let depth = 0
  let snippets = 0
  for (let i = 0; i < markup.length; ) {
    const c = markup[i]
    const top = depth === 0 && snippets === 0
    if (c === '{') {
      const end = ending(markup, i, '}')
      const inner = markup.slice(i + 1, end).trim()
      if (depth === 0 && /^#snippet\b/.test(inner)) {
        snippets++
      } else if (depth === 0 && /^\/snippet\b/.test(inner)) {
        snippets--
      } else if (top && !/^[#:/]/.test(inner) && !/^const\s/.test(inner)) {
        out.add(`{${inner.split(/[\s(]/)[0]}}`)
      }
      i = end + 1
      continue
    }
    const tag = c === '<' && markup.slice(i).match(/^<(\/?)([A-Za-z][\w.:-]*)/)
    if (tag) {
      const end = ending(markup, i, '>')
      if (tag[1]) {
        depth--
      } else {
        if (top && tag[2] !== 'Panel') {
          out.add(`<${tag[2]}>`)
        }
        if (markup[end - 1] !== '/' && !voids.has(tag[2])) {
          depth++
        }
      }
      i = end + 1
      continue
    }
    if (top && !/\s/.test(c)) {
      out.add('text')
    }
    i++
  }
  return [...out]
}

// The layout check: a record's overview, its first tab, is laid out by
// its page's layout, `body` or `panels`, `panels` unset. On it every
// block, its owner's or an extension's, is a panel, a component drawing
// only `Panel`s at its top level, the record's body alone excepted; a
// `body` page declares its body, and a `panels` page shows a panel, its
// owner's or an extension's. `sources` are every file's `{ path, text }`,
// paths relative to the repository.
export function layouts(sources) {
  const out = []
  const texts = new Map(sources.map((s) => [s.path, s.text]))
  const apps = sources.filter(({ path }) => /(^|\/)src\/app\/.*\.ts$/.test(path) && !/\.(svelte|d)\.ts$/.test(path)).map(({ path, text }) => pages(path, text))
  const owners = new Map(apps.flatMap((p) => p.owned).map((o) => [o.collection, o]))
  const overview = (o, b) => b.tab === null || b.tab === o?.tabs?.[0]
  const fix = "draw it in one Panel, or several, each with a title and its key actions in its footer; put what is too big to summarise in a tab"
  const check = (who, collection, file, imports, b) => {
    if (b.name === null) {
      out.push(`${file}: ${who} places a block on the ${collection} page's overview that is not a component's name or a { tab, block } naming one, which the layout check reads; name it`)
      return
    }
    const spec = imports.get(b.name)
    const path = spec?.startsWith('.') && normalize(join(dirname(file), spec))
    const text = path && texts.get(path)
    if (!text) {
      out.push(`${file}: ${who} places ${b.name} on the ${collection} page's overview, which the layout check cannot read; import it from the slice's own .svelte file`)
      return
    }
    const found = loose(text)
    if (found.length) {
      out.push(`${path}: is placed on the ${collection} page's overview by ${who} and draws ${found.join(', ')} outside a panel; ${fix}`)
    }
  }
  for (const o of owners.values()) {
    const layout = o.layout ?? 'panels'
    if (layout !== 'body' && layout !== 'panels') {
      out.push(`${o.file}: ${o.slice}'s ${o.collection} page declares its layout other than as 'body' or 'panels', which the layout check reads`)
      continue
    }
    for (const b of o.blocks.filter((b) => overview(o, b))) {
      check(o.slice, o.collection, o.file, o.imports, b)
    }
  }
  const extended = apps.flatMap((p) => p.extended)
  for (const e of extended) {
    for (const b of e.blocks.filter((b) => overview(owners.get(e.collection), b))) {
      check(e.slice, e.collection, e.file, e.imports, b)
    }
  }
  for (const o of owners.values()) {
    const layout = o.layout ?? 'panels'
    const panels = [...o.blocks.filter((b) => overview(o, b)), ...extended.filter((e) => e.collection === o.collection).flatMap((e) => e.blocks.filter((b) => overview(o, b)))]
    if (layout === 'panels' && !panels.length) {
      out.push(
        `${o.file}: ${o.slice}'s ${o.collection} page opens on its panels and has none, so its overview opens on its notes alone; give it a panel summarising the record, or lay it out as 'body' if it is a record of words`,
      )
    }
    if (layout === 'body' && !o.body) {
      out.push(`${o.file}: ${o.slice}'s ${o.collection} page opens on its body and declares none; declare its body, or lay it out as 'panels' with a panel summarising the record`)
    }
  }
  return out
}

// The markup between `open` and its closing tag, past nested tags of the
// same name; a self-closing tag holds nothing.
function inside(markup, at, name) {
  const end = ending(markup, at, '>')
  if (markup[end - 1] === '/') {
    return ''
  }
  let depth = 1
  const re = new RegExp(`<(/?)${name}\\b`, 'g')
  re.lastIndex = end
  for (let m = re.exec(markup); m; m = re.exec(markup)) {
    const close = ending(markup, m.index, '>')
    if (m[1]) {
      depth--
    } else if (markup[close - 1] !== '/') {
      depth++
    }
    if (depth === 0) {
      return markup.slice(end + 1, m.index)
    }
  }
  return markup.slice(end + 1)
}

// Markup with the snippets named `names` taken out, their own nested
// snippets with them.
function without(markup, names) {
  let out = ''
  let i = 0
  const open = new RegExp(`\\{#snippet\\s+(${names.join('|')})\\b`, 'g')
  for (let m = open.exec(markup); m; m = open.exec(markup)) {
    out += markup.slice(i, m.index)
    let depth = 0
    const marks = /\{(#|\/)snippet\b/g
    marks.lastIndex = m.index
    let end = markup.length
    for (let n = marks.exec(markup); n; n = marks.exec(markup)) {
      depth += n[1] === '#' ? 1 : -1
      if (depth === 0) {
        end = ending(markup, n.index, '}') + 1
        break
      }
    }
    i = end
    open.lastIndex = end
  }
  return out + markup.slice(i)
}

// The tags named `name` a markup opens, each read whole.
const opened = (markup, name) => [...markup.matchAll(new RegExp(`<${name}\\b`, 'g'))].map((m) => markup.slice(m.index, ending(markup, m.index, '>') + 1))
const flag = (tag, name) => new RegExp(`\\s${name}(?=[\\s/>=])`).test(tag)

// Panels as one system, in a component's markup: no button in a panel's
// body, the retired names, an empty state drawn as a quiet note, a list of
// totals drawn as a sheet of one unnamed column.
export function panels(path, text) {
  const out = []
  if (!path.endsWith('.svelte')) {
    return out
  }
  const markup = markupOf(text)
  for (const m of markup.matchAll(/<Panel\b/g)) {
    const body = without(inside(markup, m.index, 'Panel'), ['actions', 'help'])
    const pressed = opened(body, 'Button').length > 0 || opened(body, 'Form').some((t) => !flag(t, 'bare'))
    if (pressed) {
      out.push(`${path}: draws a button in a Panel's body; its key actions are its footer's, in its actions snippet, a bare form's submit among them by the form's id`)
      break
    }
  }
  if (/<(Inlay|Widget)\b/.test(markup) || /import\s*\{[^}]*\bInlay\b[^}]*\}\s*from\s*['"]@cella\/org-ui['"]/.test(text)) {
    out.push(`${path}: draws an Inlay or a Widget, which the Panel replaced; draw a Panel`)
  }
  if (opened(markup, 'Note').some((t) => flag(t, 'quiet'))) {
    out.push(`${path}: draws an empty state as a quiet Note; draw Empty`)
  }
  if (opened(markup, 'Sheet').some((t) => /\scolumns=\{\[\s*(['"])\1\s*\]\}/.test(t))) {
    out.push(`${path}: draws a Sheet of one unnamed column as a list of totals; a Sheet is a financial statement, and totals are a Table's totals`)
  }
  return out
}

// A slice's `properties` holding a computed figure, in an app module: the
// body of each `properties:` arrow, read to its close.
export function figures(path, text) {
  if (!/(^|\/)src\/app\/.*\.ts$/.test(path) || /\.(svelte|d)\.ts$/.test(path)) {
    return []
  }
  for (const m of text.matchAll(/\bproperties:\s*(\(|[A-Za-z_$][\w$]*\s*=>)/g)) {
    let start
    if (m[1] === '(') {
      let i = m.index + m[0].length
      for (let depth = 1; i < text.length && depth > 0; i++) {
        depth += text[i] === '(' ? 1 : text[i] === ')' ? -1 : 0
      }
      start = text.indexOf('=>', i) + 2
    } else {
      // An unparenthesised single param, as `p => […]`: the arrow is
      // already in this match, so the body starts right after it.
      start = m.index + m[0].length
    }
    let end = start
    for (let depth = 0, began = false; end < text.length; end++) {
      const c = text[end]
      if ('([{'.includes(c)) {
        depth++
        began = true
      } else if (')]}'.includes(c)) {
        depth--
      }
      if ((began && depth === 0) || depth < 0 || (!began && c === ',')) {
        break
      }
    }
    if (/\bkind:\s*['"](money|number)['"]|\bgroup:\s*['"]Figures['"]/.test(text.slice(start, end + 1))) {
      return [`${path}: lists a sum or a count among its properties; a computed figure is no property of the drawer: declare it in figures, a Stat on the overview`]
    }
  }
  return []
}

// A phosphor-svelte icon a module import names, by its default export's
// path, `phosphor-svelte/lib/<Name>`.
const phosphorIcon = (spec) => spec.match(/^phosphor-svelte\/lib\/([A-Za-z]+)$/)?.[1]
const recordIconsFile = /(^|\/)core\/ui\/ts\/src\/record-icons\.ts$/

// The curated record icons (`core/ui/ts/src/record-icons.ts`) overlap no
// icon a feature or a collection already draws: every other source's
// phosphor-svelte imports, by name, refuse any the curated file also
// imports. `sources` are every file's `{ path, text }`, paths relative to
// the repository.
export function recordIconOverlap(sources) {
  const out = []
  const curated = sources.find(({ path }) => recordIconsFile.test(path))
  if (!curated) {
    return out
  }
  const picked = new Set(imports(curated.text).map(phosphorIcon).filter(Boolean))
  const used = new Set()
  for (const { path, text } of sources) {
    if (path === curated.path) {
      continue
    }
    for (const spec of imports(text)) {
      const name = phosphorIcon(spec)
      if (name && picked.has(name)) {
        used.add(name)
      }
    }
  }
  for (const name of [...used].sort()) {
    out.push(`${curated.path}: curates ${name}, which a feature's or a collection's icon already draws; pick another`)
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
  const sources = []
  const core = new Set()
  for (const dir of dirs) {
    if (!existsSync(join(repo, dir, 'src'))) {
      continue
    }
    const ui = dir.split(sep).slice(-3).join('/') === 'core/ui/ts'
    for (const file of walk(repo, join(dir, 'src'))) {
      const path = relative(repo, join(repo, file))
      const text = readFileSync(join(repo, file), 'utf8')
      out.push(...problems(path, text, ui))
      out.push(...panels(path, text))
      out.push(...figures(path, text))
      sources.push({ path, text })
      if (ui) {
        core.add(path)
      }
    }
  }
  out.push(...inlineCreates(sources, (path) => core.has(path)))
  out.push(...pageSaves(sources))
  out.push(...recordIconOverlap(sources))
  out.push(...layouts(sources))
  return out
}
