// The ui check: CSS only in the UI core, state and effects only in hooks,
// no module-level mutable state in client code, no server layer imported
// by a client one, no legacy Svelte or SvelteKit form.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { problems } from '../ui-check.mjs'

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
    [component("  setContext('k', 1)"), /uses setContext and getContext; use createContext in a hook/],
  ]
  for (const [text, message] of refused) {
    const found = problems(block, text, false)
    assert.equal(found.length, 1, `${text}: ${found}`)
    assert.match(found[0], message)
  }
  assert.match(problems('apps/org/ts/src/routes/+layout.server.ts', "import { invalidateAll } from '$app/navigation'\n", false)[0], /uses invalidateAll; use refreshAll/)
})

test('the forms that replace them pass, and prose that names them does not trip the check', () => {
  const modern = component(
    "  import { page } from '$app/state'\n  import { fromAction } from 'svelte/attachments'\n  let { data, children } = $props()\n  // never on:click, use:enhance or $app/stores here",
    '<button onclick={go}>Go</button>\n<form {@attach enhanced}></form>\n{#each xs as x (x)}{const y = $derived(x * 2)}{y}{/each}\n{@render children()}\n<!-- not <slot />, not {@html} -->\n<p>Decided on: the close</p>',
  )
  assert.deepEqual(problems(block, modern, false), [])
})

test('a collection page renders the Collection alone', () => {
  const path = 'apps/org/ts/src/routes/[collection]/+page.svelte'
  const only = component("  import { Collection } from '@cella/org-ui'", '{#if mounted}\n  <!-- one view -->\n  {#key data.name}\n    <Collection title="x" status={[a].filter((s) => s !== undefined)} />\n  {/key}\n{/if}')
  assert.deepEqual(problems(path, only, false), [])
  const beside = component("  import { Collection, Stats } from '@cella/org-ui'", '<Stats items={[]} />\n<Collection title="x" />\n<div>totals</div>')
  const found = problems(path, beside, false)
  assert.equal(found.length, 2, `${found}`)
  assert.match(found[0], /renders <Stats> beside the Collection/)
  assert.match(found[1], /renders <div> beside the Collection/)
})
