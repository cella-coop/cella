// The ui check: CSS only in the UI core, state only in hooks, no
// module-level mutable state in client code, no server layer imported by a
// client one.

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
