// The ui check: CSS only in the UI core, state and effects only in hooks,
// no module-level mutable state in client code, no server layer imported
// by a client one, no legacy Svelte or SvelteKit form, and no create form
// drawn but in New's Dialog.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { inlineCreates, problems } from '../ui-check.mjs'

const block = 'apps/org/feats/invoice/core/ts/src/app/blocks/Lines.svelte'
const component = (script, markup = '<p>x</p>') => `<script lang="ts">\n${script}\n</script>\n\n${markup}\n`

test('a block that composes the UI core passes', () => {
  const text = component(`  import { Section } from '@cella/org-ui'\n  import type { Invoice } from '../../models/invoice.ts'\n  import { useIssue } from '../../hooks/useIssue.ts'\n  let { data } = $props()`)
  assert.deepEqual(problems(block, text, false), [])
})

test('a block that styles itself is refused; the UI core may', () => {
  for (const markup of ['<p>x</p>\n<style>\n  p { color: red; }\n</style>', '<p style="color: red">x</p>', '<p style:color="red">x</p>']) {
    assert.match(problems(block, component('', markup), false)[0], /styles itself; only the UI core holds CSS/)
  }
  assert.deepEqual(problems('apps/org/core/ui/ts/src/components/Card.svelte', component('', '<style>p {}</style>'), true), [])
})

test('state outside a hook\'s state class is refused', () => {
  assert.match(problems(block, component('  let open = $state(false)'), false)[0], /holds \$state; state lives in a hook/)
  assert.match(problems('apps/org/feats/invoice/core/ts/src/app/state.svelte.ts', 'export class S {\n  x = $state(0)\n}\n', false)[0], /holds \$state/)
  assert.deepEqual(problems('apps/org/feats/invoice/core/ts/src/hooks/IssueState.svelte.ts', 'export class IssueState {\n  lines = $state.raw([])\n}\n', false), [])
})

test('module-level mutable state in client code is refused', () => {
  assert.match(problems('apps/org/feats/invoice/core/ts/src/hooks/useIssue.ts', 'let shared = null\nexport function useIssue() {}\n', false)[0], /module-level mutable state/)
  assert.match(problems(block, `<script module lang="ts">\n  let count = 0\n</script>\n${component('')}`, false)[0], /module-level mutable state/)
  assert.deepEqual(problems('apps/org/feats/invoice/core/ts/src/hooks/useIssue.ts', 'const [get, set, has] = createContext()\nexport function useIssue() {\n  let x = 1\n}\n', false), [])
})

test('a client layer importing a server layer is refused', () => {
  for (const spec of ['../../api/index.ts', '../../drivers/invoice.ts', '../handlers/issue.ts', '@cella/org-invoice/api', '@cella/org-db', 'pg']) {
    assert.match(problems(block, component(`  import { x } from '${spec}'`), false)[0], /a server layer, from a client layer/)
  }
  const server = 'apps/org/feats/invoice/core/ts/src/api/slice.ts'
  assert.deepEqual(problems(server, `import { action } from '@cella/org-db'\nimport { issue } from '../handlers/index.ts'\n`, false), [])
})

test('an effect outside a hook\'s state class is refused', () => {
  const effect = '  $effect(() => {\n    node?.scrollIntoView()\n  })'
  assert.match(problems(block, component(effect), false)[0], /runs an \$effect; an effect lives in a hook's state class/)
  assert.match(problems('apps/org/core/ui/ts/src/components/Collection.svelte', component(effect), true)[0], /runs an \$effect/)
  assert.match(problems(block, component('  $effect.pre(() => {})'), false)[0], /runs an \$effect/)
  assert.deepEqual(problems('apps/org/core/ui/ts/src/hooks/ScrollState.svelte.ts', 'export class S {\n  constructor() {\n    $effect(() => {})\n  }\n}\n', true), [])
})

test('an effect that writes a $state field of its class is refused; a $derived holds it', () => {
  const hook = 'apps/org/core/ui/ts/src/hooks/ViewsState.svelte.ts'
  const state = (effect) => `export class S {\n  list: string[] = $state([])\n  #seen = $state.raw(null)\n  count = $state(0)\n  plain = 0\n  constructor() {\n${effect}\n  }\n}\n`
  const refused = [
    ['    $effect(() => {\n      this.list = read()\n    })', 'list'],
    ['    $effect.pre(() => {\n      this.#seen ??= now()\n    })', '#seen'],
    ['    $effect(() => {\n      this.count++\n    })', 'count'],
    ['    $effect(() => {\n      ++this.count\n    })', 'count'],
    ['    $effect(() => {\n      const stop = start()\n      return () => {\n        stop()\n        this.list = []\n      }\n    })', 'list'],
  ]
  for (const [effect, field] of refused) {
    const found = problems(hook, state(effect), false)
    assert.equal(found.length, 1, `${effect}: ${found}`)
    assert.equal(found[0], `${hook}: writes the $state field ${field} in an $effect; derive it with $derived, or set what only the browser holds in onMount or afterNavigate`)
  }
  const kept = [
    '    $effect(() => {\n      void this.list\n      this.plain = 1\n      if (this.count === 2 || this.count >= 3) tally(this.count)\n    })',
    '    $effect(() => this.#tally($state.snapshot(this.list)))',
    "    onMount(() => {\n      this.list = read()\n    })\n    $effect(() => {\n      const doc = make()\n      return () => doc.free()\n    })",
  ]
  for (const effect of kept) {
    assert.deepEqual(problems(hook, state(effect), false), [], effect)
  }
})

test('legacy Svelte and SvelteKit forms are refused, wherever they are written', () => {
  const refused = [
    [component('', '<button on:click={go}>Go</button>'), /uses on:event; use an onevent attribute/],
    [component('', '<div><slot /></div>'), /uses <slot>; use a snippet/],
    [component('', '<form use:enhance></form>'), /uses use:action; use \{@attach\}/],
    [component('', '{#each xs as x (x)}{@const y = x * 2}{y}{/each}'), /uses \{@const\}; use a declaration tag/],
    [component('', '<p>{@html body}</p>'), /uses \{@html\}; use text/],
    [component('', '<p {...$$restProps}></p>'), /uses \$\$props; use \$props\(\)/],
    [component('  export let data'), /uses export let; use \$props\(\)/],
    [component('  $: total = a + b'), /uses \$:; use \$derived/],
    [component("  import { createEventDispatcher } from 'svelte'"), /uses createEventDispatcher; use a callback prop/],
    [component("  import { page } from '$app/stores'"), /uses \$app\/stores; use \$app\/state/],
    [component("  import { x } from '$lib/x'"), /uses \$lib; use #lib/],
    [component("  import { A } from '$env/static/private'"), /uses \$env; use \$app\/env/],
    [component("  setContext('k', 1)"), /uses setContext, getContext or hasContext; use createContext in a hook/],
    [component('  const v = getContext(key)'), /uses setContext, getContext or hasContext/],
    [component('  if (hasContext(Symbol.for("k"))) {}'), /uses setContext, getContext or hasContext/],
    [component("  import { getContext as read } from 'svelte'"), /uses setContext, getContext or hasContext/],
    [component("  import { writable } from 'svelte/store'"), /uses svelte\/store; use \$state in a hook's state class/],
  ]
  for (const [text, message] of refused) {
    const found = problems(block, text, false)
    assert.equal(found.length, 1, `${text}: ${found}`)
    assert.match(found[0], message)
  }
  assert.match(problems('apps/org/ts/src/routes/theme/+server.ts', "import { invalidateAll } from '$app/navigation'\n", false)[0], /uses invalidateAll; use refreshAll/)
})

test('the forms that replace them pass, and prose that names them does not trip the check', () => {
  const modern = component(
    "  import { page } from '$app/state'\n  import { fromAction } from 'svelte/attachments'\n  import { createContext } from 'svelte'\n  let { data, children } = $props()\n  const pixels = canvas.getContext('2d')\n  // never on:click, use:enhance, $app/stores or setContext here",
    '<button onclick={go}>Go</button>\n<form {@attach enhanced}></form>\n{#each xs as x (x)}{const y = $derived(x * 2)}{y}{/each}\n{@render children()}\n<!-- not <slot />, not {@html} -->\n<p>Decided on: the close</p>',
  )
  assert.deepEqual(problems(block, modern, false), [])
})

test('a collection page renders the Collection alone', () => {
  const path = 'apps/org/ts/src/routes/[collection]/+page.svelte'
  const only = component("  import { Collection } from '@cella/org-ui'", '{#snippet loading()}<Skeleton title="x" />{/snippet}\n<svelte:boundary pending={loading}>\n  {#snippet failed(e)}<Failed error={e} />{/snippet}\n  {#if mounted}\n  <!-- one view -->\n  {#key data.name}\n    <Collection title="x" status={[a].filter((s) => s !== undefined)} />\n  {/key}\n  {/if}\n</svelte:boundary>')
  assert.deepEqual(problems(path, only, false), [])
  const beside = component("  import { Collection, Stats } from '@cella/org-ui'", '<Stats items={[]} />\n<Collection title="x" />\n<div>totals</div>')
  const found = problems(path, beside, false)
  assert.equal(found.length, 2, `${found}`)
  assert.match(found[0], /renders <Stats> beside the Collection/)
  assert.match(found[1], /renders <div> beside the Collection/)
})

test('an item page renders the Detail and its slices\' blocks alone', () => {
  const path = 'apps/org/ts/src/routes/[collection]/[id]/+page.svelte'
  const only = component("  import { Detail } from '@cella/org-ui'", '<svelte:boundary>\n  {#snippet failed(e)}<Failed error={e} />{/snippet}\n{#snippet header()}\n  <w.block data={d} />\n{/snippet}\n{#if page}\n  <Detail title="x">\n    {#each blocks as b}<b.block data={d} />{/each}\n  </Detail>\n{/if}\n</svelte:boundary>')
  assert.deepEqual(problems(path, only, false), [])
  const framed = component("  import { Frame, Properties } from '@cella/org-ui'", '<Frame title="x">\n  <Properties items={[]} />\n  <b.block data={d} />\n</Frame>')
  const found = problems(path, framed, false)
  assert.equal(found.length, 3, `${found}`)
  assert.match(found[0], /draws no <Detail>/)
  assert.match(found[1], /renders <Frame> beside the Detail/)
  assert.match(found[2], /renders <Properties> beside the Detail/)
})

test('browser storage is reached only from a hook\'s state class', () => {
  assert.match(problems(block, component("  const v = localStorage.getItem('cella-views')"), false)[0], /reaches browser storage/)
  assert.match(problems('apps/org/core/ui/ts/src/components/Collection.svelte', component('  sessionStorage.clear()'), true)[0], /reaches browser storage/)
  assert.deepEqual(problems('apps/org/core/ui/ts/src/hooks/ViewsState.svelte.ts', "export class V {\n  read() {\n    try {\n      return localStorage.getItem('k')\n    } catch {\n      return null\n    }\n  }\n}\n", true), [])
})

test('reorder buttons with up and down arrows are refused; dragging reorders', () => {
  const arrows = component(
    "  import ArrowUp from 'phosphor-svelte/lib/ArrowUp'\n  import ArrowDown from 'phosphor-svelte/lib/ArrowDown'",
    '<li>{w.title}<button title="Move up" onclick={() => move(i, -1)}><Icon icon={ArrowUp} /></button><button onclick={() => move(i, 1)}><Icon icon={ArrowDown} /></button></li>',
  )
  const found = problems('apps/org/core/ui/ts/src/components/Widgets.svelte', arrows, true)
  assert.equal(found.length, 2, `${found}`)
  assert.match(found[0], /reorders with ArrowUp buttons; items reorder by dragging/)
  const disclosure = component("  import CaretDown from 'phosphor-svelte/lib/CaretDown'", '<summary>Menu <Icon icon={CaretDown} /></summary>')
  assert.deepEqual(problems('apps/org/core/ui/ts/src/components/Shell.svelte', disclosure, true), [])
  const sorted = component("  import { sortable } from '../attachments/sortable.ts'", '<ol {@attach sortable(drag, { list: "w", label, onmove })}><li data-drag-item="w" data-drag-index={0}><DragHandle label="Owed" /></li></ol>')
  assert.deepEqual(problems('apps/org/core/ui/ts/src/components/Widgets.svelte', sorted, true), [])
})

test('a menu floated by hand is refused; the Popover opens it in the top layer', () => {
  const floated = component('', '<details><summary>Me</summary><div class="menu">…</div></details>\n<style>\n  .menu {\n    position: absolute;\n    z-index: 40;\n  }\n</style>')
  assert.match(problems('apps/org/core/ui/ts/src/components/Shell.svelte', floated, true)[0], /floats its own layer/)
  const stretched = component('', '<a class="s">x</a>\n<style>\n  .s::after {\n    position: absolute;\n    inset: 0;\n  }\n</style>')
  assert.deepEqual(problems('apps/org/core/ui/ts/src/components/Table.svelte', stretched, true), [], 'a stretched link is no layer')
  assert.deepEqual(problems('apps/org/core/ui/ts/src/components/Popover.svelte', floated, true), [])
})

test('a rule that sets outline: none without the focus ring is refused, in a stylesheet or a <style> block', () => {
  const sheet = 'apps/org/core/ui/ts/src/styles/base.css'
  const found = problems(sheet, 'input:focus,\nselect:focus {\n  outline: none;\n  border-color: var(--accent-border);\n}\n', true)
  assert.equal(found.length, 1, `${found}`)
  assert.match(found[0], /input:focus, select:focus sets outline: none and draws no ring/)
  assert.match(problems(sheet, '@media (hover: hover) {\n  .x { outline: 0 }\n}\n', true)[0], /\.x sets outline: none/)
  assert.match(problems('apps/org/core/ui/ts/src/components/Grid.svelte', component('', '<input />\n<style>\n  input:focus {\n    outline: none;\n  }\n</style>'), true)[0], /input:focus sets outline: none/)
  assert.deepEqual(problems(sheet, ':focus-visible {\n  outline: none;\n  box-shadow: var(--focus);\n}\n.drop {\n  outline: 2px dashed transparent;\n}\n/* outline: none */\n', true), [], 'the ring, or an outline drawn, passes')
})

test('a route\'s server load or actions, or a universal load, is refused; an endpoint passes', () => {
  for (const file of ['+page.server.ts', '+layout.server.ts', 'sign-in/+page.server.ts', '[collection]/[id]/+layout.server.ts']) {
    const path = `apps/org/ts/src/routes/${file}`
    const found = problems(path, 'export const load = () => ({})\n', false)
    assert.equal(found.length, 1, `${found}`)
    assert.match(found[0], /is a route's server load or actions; read through a query/)
    assert.match(problems(path, 'export const actions = { default: () => {} }\n', false)[0], /server load or actions/)
  }
  for (const text of ['export const load = () => ({})\n', 'export async function load() {\n  return {}\n}\n', 'const load = () => ({})\nexport { load }\n']) {
    assert.match(problems('apps/org/ts/src/routes/settings/[page]/+page.ts', text, false)[0], /exports a load; read through a query/)
    assert.match(problems('apps/org/ts/src/routes/+layout.ts', text, false)[0], /exports a load/)
  }
  assert.deepEqual(problems('apps/org/ts/src/routes/+layout.ts', 'export const ssr = true\n', false), [], 'a route option is no load')
  assert.deepEqual(problems('apps/org/ts/src/routes/search/+server.ts', "export const GET = () => new Response('[]')\n", false), [])
  assert.deepEqual(problems('apps/org/ts/src/lib/server/load.ts', 'export const load = () => ({})\n', false), [], 'only a route file is a route')
})

test('a create form drawn inline on a page is refused by name; New opens it in the Dialog', () => {
  const app = {
    path: 'apps/org/feats/task/core/ts/src/app/index.ts',
    text: "import Body from './blocks/Body.svelte'\nimport Create from './blocks/Create.svelte'\nexport const app = { collections: { tasks: { view: { create: Create }, page: { blocks: [Body] } } } }\n",
  }
  const create = { path: 'apps/org/feats/task/core/ts/src/app/blocks/Create.svelte', text: component('', '<Form action="create" submit="Create task" />') }
  const inline = { path: 'apps/org/feats/task/core/ts/src/app/blocks/Body.svelte', text: component("  import Create from './Create.svelte'", '<Create rows={[]} about={null} />') }
  assert.deepEqual(inlineCreates([app, create, inline]), [
    'apps/org/feats/task/core/ts/src/app/blocks/Body.svelte: draws Create.svelte, the create form apps/org/feats/task/core/ts/src/app/index.ts declares, inline; a create form opens only in the Dialog behind New',
  ])
  assert.deepEqual(inlineCreates([app, create]), [], 'a create form only its app declares passes')

  const collection = 'apps/org/core/ui/ts/src/components/Collection.svelte'
  const drawn = (markup) => [{ path: collection, text: component("  import Dialog from './Dialog.svelte'", markup) }]
  const each = '{#each creates as c (c)}<c.form />{/each}'
  assert.deepEqual(inlineCreates(drawn(`<Card title="New">${each}</Card>`)), [
    `${collection}: draws a collection's create forms outside its Dialog; New opens them in the one Dialog`,
  ])
  assert.deepEqual(inlineCreates(drawn(`<Dialog title="New">${each}</Dialog>\n<!-- {#each creates} -->`)), [], "the Dialog behind New holds them")
})
