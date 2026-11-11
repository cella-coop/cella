import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { judge, inlined, badIcon } from '../site-figures.mjs'

test('the fixture must build as it is and fail on an icon Phosphor lacks, naming it', () => {
  const ok = { status: 0, stdout: '', stderr: '' }
  const named = { status: 1, stdout: '', stderr: `unknown Phosphor icon: ${badIcon}` }
  const unnamed = { status: 1, stdout: '', stderr: 'Cannot find module' }
  assert.equal(judge(false, ok), null)
  assert.equal(judge(true, named), null)
  assert.match(judge(true, ok), /built with the icon/)
  assert.match(judge(true, unnamed), /without naming/)
  assert.match(judge(false, unnamed), /does not build/)
})

test('the fixture\'s HTML inlines no unprinted photo', () => {
  assert.equal(inlined('<img src="/_astro/fixture.hash.jpg" loading="lazy" width="800" height="450">'), null)
  assert.match(inlined('<img src="data:image/jpeg;base64,/9j/4AAQ">'), /inlines an unprinted photo/)
})
