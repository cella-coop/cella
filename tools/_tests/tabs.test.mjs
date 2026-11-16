// The tabs check: a record's page declares at most four tabs, which the
// slice owning its collection chooses; an extension places its blocks in
// them, and declares none of its own.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { problems } from '../tabs.mjs'

const owner = (tabs) => ({
  file: 'apps/org/core/person/ts/src/app/index.ts',
  text: `import type { App } from '@cella/org-ui'
import Devices from './blocks/Devices.svelte'
export const app: App = {
  name: 'person',
  collections: {
    people: {
      view: { title: 'People', columns: [] },
      page: {
        eyebrow: 'Person',
        title: (p) => p.name,
        tabs: [${tabs.map((t) => `{ id: '${t}', label: '${t}' }`).join(', ')}],
        blocks: [{ tab: 'authority', block: Devices }],
      },
    },
  },
}
`,
})

const extension = (page) => ({
  file: 'apps/org/grafts/membership-task/ts/src/app/index.ts',
  text: `import type { App } from '@cella/org-ui'
import Doing from './blocks/Doing.svelte'
export const app: App = {
  name: 'membership-task',
  extends: {
    tasks: { columns: [] },
    people: {
      page: ${page},
    },
  },
}
`,
})

const four = ['overview', 'membership', 'work', 'authority']

test('a page of four tabs its owner declares, its extensions placing blocks in them, passes', () => {
  assert.deepEqual(problems([owner(four), extension(`{ blocks: [{ tab: 'work', block: Doing }] }`)]), [])
})

test('a page declaring a fifth tab is refused by name', () => {
  const [p, ...rest] = problems([owner([...four, 'devices'])])
  assert.deepEqual(rest, [])
  assert.match(p, /person's people page declares 5 tabs \(overview, membership, work, authority, devices\); a record's page shows at most 4/)
  assert.match(p, /leave every other extender to Related/)
})

test('an extension placing a block in a tab of its own is refused by name', () => {
  const found = problems([owner(four), extension(`{ tabs: [{ id: 'tasks', label: 'Tasks' }], blocks: [{ tab: 'tasks', block: Doing }] }`)])
  assert.equal(found.length, 2)
  assert.match(found[0], /membership-task adds a tab of its own to the people page; the page's owner, person, chooses its tabs/)
  assert.match(found[1], /membership-task places a block in the people page's tab tasks, which its owner, person, does not name \(overview, membership, work, authority\)/)
  assert.match(found[1], /or leave its collection a jump in Related/)
})

test('a block mapped into a tab is read as placed there', () => {
  const mapped = extension(`{ blocks: [Doing].map((block) => ({ tab: 'tasks', block })) }`)
  assert.match(problems([owner(four), mapped])[0], /places a block in the people page's tab tasks/)
})

test("an owner's block in a tab its page does not declare is refused", () => {
  assert.match(problems([owner(['overview', 'membership'])])[0], /person places a block of the people page in the tab authority, which the page does not declare/)
})

test('tabs the check cannot read are refused', () => {
  const computed = { ...owner(four), text: owner(four).text.replace(/tabs: \[[^\]]*\]/, 'tabs: declared') }
  assert.match(problems([computed])[0], /declares its tabs other than as a list of \{ id, label \} literals/)
})
