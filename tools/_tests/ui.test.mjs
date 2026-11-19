// The ui check: CSS only in the UI core, state and effects only in hooks,
// no module-level mutable state in client code, no server layer imported
// by a client one, no legacy Svelte or SvelteKit form, no create form
// drawn but in New's Dialog, and no page's own Save button.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { figures, inlineCreates, layouts, loose, pageSaves, panels, problems, recordIconOverlap } from '../ui-check.mjs'

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
  const listing = component("  import { Collection, Detail } from '@cella/org-ui'", '<Detail title="x">\n  {#if scope}<Collection tab="tasks" />{/if}\n</Detail>')
  assert.deepEqual(problems(path, listing, false), [], 'a tab listing a collection scoped to the record draws the one Collection')
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
  const carets = component(
    "  import CaretUp from 'phosphor-svelte/lib/CaretUp'",
    '<li>{name}<button aria-label="Move {name} up" onclick={() => set(moved(items, at, -1))}><Icon icon={CaretUp} /></button></li>',
  )
  assert.match(problems('apps/org/core/ui/ts/src/components/Arrange.svelte', carets, true)[0], /reorders with CaretUp buttons/, 'a caret moving a choice is an arrow too')
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

test('never native components: a native select, date or time input, checkbox, radio or visible file input in the org app is refused by name; the UI core\'s pass', () => {
  for (const [markup, what] of [
    ['<select name="kind"><option>a</option></select>', /draws a native <select>; never native components: compose the UI core's Select/],
    ['<input name="due" type="date" required />', /draws a native date input; never native components/],
    ['<input type=datetime-local name="at">', /draws a native date input/],
    ['<input type="checkbox" checked aria-label="Done" />', /draws a native checkbox or radio; never native components: compose the UI core's Checkbox/],
    ['<input\n  role="switch"\n  type="checkbox"\n/>', /draws a native checkbox or radio/],
    ['<input type="radio" name="a" />', /draws a native checkbox or radio/],
    ['<input name="time" type="time" value="10:00" required />', /draws a native time input; never native components: compose the UI core's Field of type time/],
    ['<input {id} name={posted} type="file" {required} {accept} />', /draws a native file input; never native components: compose the UI core's Field of type file/],
    ['<input\n  onchange={(e) => took(e)}\n  type=file\n  class="hidden"\n/>', /draws a native file input/],
  ]) {
    const found = problems(block, component('', markup), false)
    assert.equal(found.length, 1, `${markup}: ${found}`)
    assert.match(found[0], what)
  }
  // The UI core is held to it as any slice.
  assert.match(problems('apps/org/core/ui/ts/src/components/Field.svelte', component('', '<select {id}></select>'), true)[0], /draws a native <select>/)
  const composed = component(
    "  import { Select, Checkbox, Field } from '@cella/org-ui'",
    '<Select label="Kind" options={kinds} bind:value />\n<Checkbox label="Done" bind:checked />\n<Field label="Due" name="due" type="date" />\n<input type="hidden" name="a" />\n<input class="selected" />\n<!-- <select> in a comment -->',
  )
  assert.deepEqual(problems(block, composed, false), [])
  // The file picker's own input, kept hidden for the form to post, passes.
  const picker = component('', '<input\n  bind:this={input}\n  type="file"\n  hidden\n  {name}\n  onchange={(e) => (e.currentTarget.value = "")}\n/>\n<Field label="Time" name="time" type="time" />')
  assert.deepEqual(problems('apps/org/core/ui/ts/src/components/FilePicker.svelte', picker, true), [])
  // A select in a script's string, or outside the org app, is not drawn here.
  assert.deepEqual(problems(block, component("  const html = '<select>'"), false), [])
  assert.deepEqual(problems('apps/site/src/components/Form.svelte', component('', '<select></select>'), false).filter((p) => /native/.test(p)), [])
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

test('a Form with a Save submit drawn on a page is refused by name; a modal may end in Save', () => {
  const page = { path: 'apps/org/feats/report/core/ts/src/app/blocks/Save.svelte', text: component('', '<Form action="save" submit="Save report">\n  <Field label="Title" name="title" />\n</Form>') }
  assert.deepEqual(pageSaves([page]), [`${page.path}: draws a Form submitting "Save report" on a page; a page holds no Save button, only a modal confirms`])

  const dialog = { path: 'apps/org/feats/document/core/ts/src/app/blocks/Save.svelte', text: component('', '<Dialog title="New version">\n  <Form action="version" submit="Save version" />\n</Dialog>') }
  assert.deepEqual(pageSaves([dialog]), [], "the shared Dialog's own Form may end in Save")

  const propose = { path: 'apps/org/core/ui/ts/src/components/Settings.svelte', text: component('', '<ProposeInstead>\n  <Form action="propose" submit="Save settings" />\n</ProposeInstead>') }
  assert.deepEqual(pageSaves([propose]), [], 'ProposeInstead holds one too')

  // A create form a collection declares is exempt throughout its file:
  // inlineCreates already refuses it drawn anywhere but in New's Dialog.
  const app = { path: 'apps/org/feats/report/core/ts/src/app/index.ts', text: "import Save from './blocks/Save.svelte'\nexport const app = { collections: { reports: { view: { create: Save } } } }\n" }
  assert.deepEqual(pageSaves([app, page]), [], "a declared create form's own confirming button may be named Save")

  // A submit not starting with Save passes.
  const other = { path: 'apps/org/feats/project/core/ts/src/app/blocks/Budget.svelte', text: component('', '<Form action="budget" submit="Set budget" inline />') }
  assert.deepEqual(pageSaves([other]), [])
})

test('a curated record icon overlapping a feature\'s or a collection\'s icon is refused', () => {
  const curated = { path: 'apps/org/core/ui/ts/src/record-icons.ts', text: "import Rocket from 'phosphor-svelte/lib/Rocket'\nimport Briefcase from 'phosphor-svelte/lib/Briefcase'\nexport const recordIcons = [{ slug: 'rocket', name: 'Rocket', icon: Rocket }, { slug: 'briefcase', name: 'Briefcase', icon: Briefcase }]\n" }
  // icons.ts, the single list features and collections draw their icon
  // from, imports Briefcase for project's: the overlap the curated set
  // may never repeat.
  const icons = { path: 'apps/org/core/ui/ts/src/icons.ts', text: "export { default as Briefcase } from 'phosphor-svelte/lib/Briefcase'\n" }
  assert.deepEqual(recordIconOverlap([curated, icons]), [
    `${curated.path}: curates Briefcase, which a feature's or a collection's icon already draws; pick another`,
  ])

  const none = { path: 'apps/org/core/ui/ts/src/icons.ts', text: "export { default as X } from 'phosphor-svelte/lib/X'\n" }
  assert.deepEqual(recordIconOverlap([curated, none]), [], 'no overlap, no complaint')
  assert.deepEqual(recordIconOverlap([icons]), [], 'no curated file in the sources, nothing to check')
})

// The layout check: a record's overview is laid out by its page's layout,
// and every block on it but the body is a panel, a Panel.
const owner = (page, blocks = {}) => [
  {
    path: 'apps/org/feats/invoice/core/ts/src/app/index.ts',
    text: `import type { App } from '@cella/org-ui'
import Body from './blocks/Body.svelte'
import Lines from './blocks/Lines.svelte'
import Postings from './blocks/Postings.svelte'
export const app: App = {
  name: 'invoice',
  collections: {
    invoices: {
      view: { title: 'Invoices', columns: [] },
      page: ${page},
    },
  },
}
`,
  },
  { path: 'apps/org/feats/invoice/core/ts/src/app/blocks/Body.svelte', text: component('', '<div data-body></div>\n<Editor />') },
  { path: 'apps/org/feats/invoice/core/ts/src/app/blocks/Lines.svelte', text: blocks.lines ?? component('', '<Panel title="Lines">\n  <Table />\n</Panel>') },
  { path: 'apps/org/feats/invoice/core/ts/src/app/blocks/Postings.svelte', text: component('', '<Section title="Postings">\n  <Table />\n</Section>') },
]
const extension = (blocks, text) => [
  {
    path: 'apps/org/grafts/invoice-project/ts/src/app/index.ts',
    text: `import type { App } from '@cella/org-ui'
import Project from './blocks/Project.svelte'
export const app: App = { name: 'invoice-project', extends: { invoices: { page: { blocks: ${blocks} } } } }
`,
  },
  { path: 'apps/org/grafts/invoice-project/ts/src/app/blocks/Project.svelte', text },
]
const tabs = "tabs: [{ id: 'overview', label: 'Overview' }, { id: 'postings', label: 'Postings' }]"

test('a panel draws only Panels at its top level, past control blocks, declarations and snippets', () => {
  assert.deepEqual(loose(component('', '{#if x}\n  {const y = $derived(1)}\n  <Panel title="A">\n    <Table />\n    {y}\n  </Panel>\n{:else}\n  <Panel title="B" />\n{/if}\n{#each xs as x (x)}<Panel title={x}><input type="text"><p>{x}</p></Panel>{/each}')), [])
  assert.deepEqual(loose(component('', '{#snippet open()}<Button>x</Button>{/snippet}\n<Panel title="A" actions={open}>\n  <Row />\n</Panel>')), [], 'a snippet it defines is no part of what it draws')
  assert.deepEqual(loose(component('', '<Section title="Lines">\n  <Table />\n</Section>')), ['<Section>'])
  assert.deepEqual(loose(component('', '<Panel title="A" />\nloose words\n{@render more()}\n<p title={a > b ? "x" : "y"}>x</p>')), ['text', '{@render}', '<p>'])
  assert.deepEqual(loose(component('', '<Inlay name="A" />')), ['<Inlay>'], 'the retired Inlay is no panel')
})

test('an escaped quote inside an expression closes nothing, so the scanner still finds the tag past it', () => {
  assert.deepEqual(loose(component('', '<p title={"\\""}>x</p>\nmore loose text')), ['<p>', 'text'])
})

test("a button in a Panel's body is refused; its footer's actions, and a bare form's fields in its body, pass", () => {
  const pressed = (markup) => panels(block, component('', markup))
  assert.match(pressed('<Panel title="A">\n  <Table />\n  <Row end><Button href="/x">Open</Button></Row>\n</Panel>')[0], /draws a button in a Panel's body/)
  assert.match(pressed('<Panel title="A">\n  <Form action="vote" submit="Consent" inline />\n</Panel>')[0], /draws a button in a Panel's body/, "a form drawing its own button")
  assert.match(pressed('<Panel title="A">\n  <Form action="vote" button submit="Consent" />\n</Panel>')[0], /draws a button in a Panel's body/, 'a form that is its button belongs in the footer')
  assert.deepEqual(pressed('<Panel title="A">\n  <Table />\n  {#snippet actions()}<Button href="/x">Open</Button><Form action="vote" button submit="Consent" />{/snippet}\n  {#snippet help()}Why{/snippet}\n</Panel>'), [])
  assert.deepEqual(pressed('{#snippet open()}<Button href="/x">Open</Button>{/snippet}\n<Panel title="A" actions={open}>\n  <Form id="f" action="charge" bare><Field label="Project" name="project" /></Form>\n  {#snippet actions()}<Button type="submit" form="f">Move</Button>{/snippet}\n</Panel>'), [])
  assert.deepEqual(pressed('<Section title="A"><Button>Go</Button></Section>'), [], 'outside a panel a button stands where it is drawn')
})

test('the retired Inlay, a quiet Note for an empty state and a Sheet of totals are refused by name', () => {
  assert.match(panels(block, component("  import { Inlay } from '@cella/org-ui'", '<Inlay name="A" />'))[0], /draws an Inlay or a Widget, which the Panel replaced/)
  assert.match(panels(block, component('', '<Note text="Nothing yet" quiet />'))[0], /empty state as a quiet Note; draw Empty/)
  assert.deepEqual(panels(block, component('', '<Note text="Closed" subtle />\n<Empty text="Nothing yet" />')), [])
  assert.match(panels(block, component('', "<Sheet columns={['']} rows={totals} />"))[0], /Sheet of one unnamed column as a list of totals/)
  assert.deepEqual(panels(block, component('', '<Sheet columns={data.columns} rows={data.rubrics} />\n<Table columns={lines} rows={rows} {totals} />')), [])
})

test("a sum or a count among a slice's properties is refused; its figures hold it", () => {
  const app = 'apps/org/feats/project/core/ts/src/app/index.ts'
  const page = (body) => `export const app = { collections: { projects: { page: { ${body} } } } }\n`
  assert.match(figures(app, page("properties: (p) => [{ label: 'Budget', value: p.budget, kind: 'money' }],"))[0], /lists a sum or a count among its properties/)
  assert.match(figures(app, page("properties: (t) => (t ? [{ label: 'Hours', value: t.hours, kind: 'number' }] : []),"))[0], /declare it in figures/)
  assert.match(figures(app, page("properties: (p) => [{ label: 'Milestones', value: p.done, group: 'Figures' }],"))[0], /lists a sum or a count/)
  assert.deepEqual(figures(app, page("properties: (p) => [{ label: 'Due', value: p.due, kind: 'date' }],\n        figures: (p) => [{ label: 'Budget', value: p.budget, kind: 'money' }],")), [])
  assert.deepEqual(figures('apps/org/feats/project/core/ts/src/app/blocks/Budget.svelte', "properties: (p) => [{ kind: 'money' }]"), [], 'only an app module declares properties')
  assert.match(figures(app, page("properties: p => [{ label: 'Budget', value: p.budget, kind: 'money' }],"))[0], /lists a sum or a count among its properties/, 'an unparenthesised param is still caught')
})

test('a panels page opens on its panels, its body a Notes panel, and each block on its overview is a Panel', () => {
  assert.deepEqual(layouts(owner(`{ eyebrow: 'Invoice', title: (i) => i.label, ${tabs}, layout: 'panels', body: Body, blocks: [Lines, { tab: 'postings', block: Postings }] }`)), [])
  assert.deepEqual(layouts(owner(`{ eyebrow: 'Invoice', title: (i) => i.label, ${tabs}, body: Body, blocks: [Lines] }`)), [], 'panels is the layout unset')
  const loosely = layouts(owner(`{ eyebrow: 'Invoice', title: (i) => i.label, ${tabs}, layout: 'panels', body: Body, blocks: [{ tab: 'overview', block: Postings }] }`))
  assert.equal(loosely.length, 1)
  assert.match(loosely[0], /Postings\.svelte: is placed on the invoices page's overview by invoice and draws <Section> outside a panel; draw it in one Panel/)
  assert.deepEqual(layouts(owner(`{ eyebrow: 'Invoice', title: (i) => i.label, ${tabs}, layout: 'panels', body: Body, blocks: [Body] }`)).length, 1, 'the body placed among the blocks is no panel')
})

test('a panels page without a panel is refused, and so is a body page without a body', () => {
  const none = layouts(owner(`{ eyebrow: 'Invoice', title: (i) => i.label, ${tabs}, layout: 'panels', body: Body, blocks: [{ tab: 'postings', block: Postings }] }`))
  assert.deepEqual(none, [
    "apps/org/feats/invoice/core/ts/src/app/index.ts: invoice's invoices page opens on its panels and has none, so its overview opens on its notes alone; give it a panel summarising the record, or lay it out as 'body' if it is a record of words",
  ])
  const filled = layouts([...owner(`{ eyebrow: 'Invoice', title: (i) => i.label, ${tabs}, body: Body }`), ...extension('[Project]', component('', '<Panel title="Project" />'))])
  assert.deepEqual(filled, [], "an extension's panel is the page's panel too")
  const bodiless = layouts(owner(`{ eyebrow: 'Invoice', title: (i) => i.label, ${tabs}, layout: 'body', blocks: [Lines] }`))
  assert.equal(bodiless.length, 1)
  assert.match(bodiless[0], /invoices page opens on its body and declares none/)
  assert.deepEqual(layouts(owner(`{ eyebrow: 'Invoice', title: (i) => i.label, layout: 'body', body: Body, blocks: [Lines] }`)), [], 'a body page puts its panels after its body')
})

test("an extension's block on the overview is a panel too; in another tab it may be anything", () => {
  const page = `{ eyebrow: 'Invoice', title: (i) => i.label, ${tabs}, body: Body, blocks: [Lines] }`
  const section = component('', '<Section title="Project" />')
  assert.match(layouts([...owner(page), ...extension('[Project]', section)])[0], /Project\.svelte: is placed on the invoices page's overview by invoice-project and draws <Section> outside a panel/)
  assert.match(layouts([...owner(page), ...extension("[{ tab: 'overview', block: Project }]", section)])[0], /by invoice-project and draws <Section>/, 'named by the tab the owner opens on')
  assert.deepEqual(layouts([...owner(page), ...extension("[{ tab: 'postings', block: Project }]", section)]), [])
})

test('a block the layout check cannot read on the overview is refused', () => {
  const spread = layouts(owner(`{ eyebrow: 'Invoice', title: (i) => i.label, ${tabs}, body: Body, blocks: [...[Lines].map((block) => block)] }`))
  assert.match(spread[0], /that is not a component's name or a \{ tab, block \} naming one/)
  const elsewhere = layouts(owner(`{ eyebrow: 'Invoice', title: (i) => i.label, ${tabs}, body: Body, blocks: [Missing] }`))
  assert.match(elsewhere[0], /places Missing on the invoices page's overview, which the layout check cannot read/)
})
