// A navigation the next one abandons, alone: what the page lets go of
// where it starts a navigation, and what it still raises. Run by `cella
// test slice ui`.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { abandon, abandoned } from '../src/models/navigation.ts'

test('a navigation overtaken, cancelled or unloaded under is abandoned, and let go of', () => {
  const unloaded = new DOMException('The operation was aborted. ', 'AbortError')
  for (const e of [new Error('navigation aborted'), new Error('navigation cancelled'), unloaded]) {
    assert.equal(abandoned(e), true, String(e))
    assert.doesNotThrow(() => abandon(e))
  }
})

test('any other failure of a navigation is raised', () => {
  for (const e of [new Error('Not found: /nowhere'), new Error('navigation aborted twice'), new TypeError('NetworkError when attempting to fetch resource.'), 'aborted', null, undefined]) {
    assert.equal(abandoned(e), false, String(e))
    assert.throws(() => abandon(e), (thrown) => thrown === e)
  }
})
