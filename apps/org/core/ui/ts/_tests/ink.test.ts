// The ink specimen's candidates, alone: the hues are the brand's, every
// pair each ink draws clears WCAG AA in both themes, and a name keeps
// its ink. Run by `cella test slice ui`.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { HUES, TURN, inkOf, inked, nth, pairs } from '../src/models/ink.ts'

const tokens = readFileSync(new URL('../../../../../../packages/brand/tokens.css', import.meta.url), 'utf8')

test('the hues and the surfaces are the brand tokens', () => {
  HUES.forEach((h, i) => assert.match(tokens, new RegExp(`--p${i}: oklch\\([\\d.]+ [\\d.]+ ${h}\\);`), `--p${i} is at ${h}`))
  for (const [shade, k] of [['0', '0.3588'], ['2', '0.3041'], ['9', '-0.3312']]) {
    assert.ok(tokens.includes(`--shade-${shade}: calc(0.61 + var(--theme) * ${k});`), `--shade-${shade} is ${k} from 0.61`)
  }
})

test('every pair each ink draws clears AA, light and dark', () => {
  for (const t of [1, -1] as const) {
    HUES.forEach((_, ink) => {
      for (const p of pairs(ink, t)) {
        assert.ok(p.ratio >= p.floor, `ink ${ink}, theme ${t}: ${p.what} is ${p.ratio.toFixed(2)}, under ${p.floor}`)
      }
    })
  }
})

test('a name keeps its ink, and a list takes the inks in turn', () => {
  assert.equal(inkOf('Coordination'), inkOf('Coordination'))
  assert.deepEqual(new Set(TURN), new Set([0, 1, 2, 3, 4]))
  assert.deepEqual([0, 1, 2, 3, 4, 5].map(nth), [...TURN, TURN[0]])
  assert.match(inked(2), /--fill: oklch\(calc\(0\.52 \+ var\(--theme\) \* 0\) 0\.13 159\)/)
})
