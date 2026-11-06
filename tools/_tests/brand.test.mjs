// The brand's port of the explorer: the mark @cella/brand draws for
// house.json is the SVG the explorer's own markSvg() draws, and its
// shades, its paper and the tokens.css it writes are the values the
// explorer's themeVars() sets, both captured from the explorer's src.html
// (sha256 7fc005c3…98498e1cf8) into brand/. And `cella brand --check`
// names each generated file that differs, is missing or is left over.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { grain, hues, markSvg, resolve, shades, sunkL, actionL, onActionL, tokensCss } from '../../packages/brand/src/index.ts'

const repo = new URL('../..', import.meta.url).pathname
const brand = join(repo, 'packages/brand')
const fixture = (f) => readFileSync(new URL(`brand/${f}`, import.meta.url), 'utf8')
const house = resolve(JSON.parse(readFileSync(join(brand, 'house.json'), 'utf8')))
const explorer = JSON.parse(fixture('explorer-theme.json'))
const themes = [['light', 1], ['dark', -1]]

test('the five hues are the phase and the step, in the pentad\'s order', () => {
  assert.deepEqual(hues(house), [23, 91, 159, 227, 295])
  assert.deepEqual(house.tones.accent, house.tones.base, 'an action is ink: the accent is the paper\'s tone')
})

test('the mark is the explorer\'s, at 240 and at 16', () => {
  for (const size of [240, 16]) {
    assert.equal(markSvg(house.mark, hues(house), size), fixture(`explorer-mark-${size}.svg`).trim(), `at ${size}`)
  }
})

test('the shades, the well, the action and the paper are the explorer\'s in both themes', () => {
  for (const [name, t] of themes) {
    const want = explorer[name]
    shades(house, t).forEach((l, i) => assert.equal(l.toFixed(4), want[`--shade-${i}`], `${name} shade ${i}`))
    assert.equal(sunkL(house, t).toFixed(4), want['--sunk-l'], `${name} sunk`)
    assert.equal(actionL(house, t).toFixed(4), want['--accent-l'], `${name} action`)
    assert.equal(`oklch(${onActionL(house, t).toFixed(4)} var(--tone-base))`, want['--on-accent'], `${name} on the action`)
    for (const s of ['ground', 'panel', 'raised']) {
      assert.equal(grain(house, s, t), want[`--grain-${s}`], `${name} ${s}'s paper`)
    }
  }
})

test('tokens.css computes the explorer\'s shades and wears its paper in both themes', () => {
  const css = tokensCss(house)
  // the last rule of a selector: dark's sign comes before its values
  const rule = (selector) => css.slice(css.lastIndexOf(`${selector} {`)).split('\n}')[0]
  const model = rule(':root, [data-theme]')
  const dark = rule('[data-theme=\'dark\']')
  for (const [name, t] of themes) {
    for (let i = 0; i < 10; i++) {
      const literal = name === 'dark' && dark.match(new RegExp(`--shade-${i}: ([0-9.]+);`))
      const [, mid, k] = model.match(new RegExp(`--shade-${i}: calc\\(([0-9.]+) \\+ var\\(--theme\\) \\* (-?[0-9.]+)\\);`))
      const l = literal ? Number(literal[1]) : Number(mid) + t * Number(k)
      assert.ok(Math.abs(l - Number(explorer[name][`--shade-${i}`])) < 1e-4, `${name} shade ${i}: ${l}, the explorer's ${explorer[name][`--shade-${i}`]}`)
    }
    const paper = name === 'dark' ? dark : model
    for (const s of ['ground', 'panel', 'raised']) {
      assert.ok(paper.includes(`--grain-${s}: ${explorer[name][`--grain-${s}`]};`), `${name} ${s}'s paper`)
    }
  }
})

// A copy of the brand in a throwaway repo, its dependencies linked; file
// by file, since cpSync copies a directory's mode, which a lane's ACLs
// refuse.
const tree = (from, to) => {
  mkdirSync(to, { recursive: true })
  for (const f of readdirSync(from).filter((f) => f !== 'node_modules')) {
    statSync(join(from, f)).isDirectory() ? tree(join(from, f), join(to, f)) : writeFileSync(join(to, f), readFileSync(join(from, f)))
  }
}
function copy() {
  const root = mkdtempSync(join(tmpdir(), 'cella-brand-'))
  tree(brand, join(root, 'packages/brand'))
  symlinkSync(join(brand, 'node_modules'), join(root, 'packages/brand/node_modules'))
  return root
}
const run = (root, ...args) => spawnSync('node', [join(repo, 'tools/brand.mjs'), ...args, root], { encoding: 'utf8' })

test('cella brand --check passes what cella brand wrote, and names what differs', () => {
  const root = copy()
  try {
    assert.equal(run(root, '--check').status, 0, 'the committed files are what house.json makes')
    writeFileSync(join(root, 'packages/brand/tokens.css'), '/* edited */\n')
    unlinkSync(join(root, 'packages/brand/icons/info.svg'))
    writeFileSync(join(root, 'packages/brand/old.svg'), '<svg/>\n')
    const r = run(root, '--check')
    assert.equal(r.status, 1)
    assert.match(r.stderr, /packages\/brand\/tokens\.css differs/)
    assert.match(r.stderr, /packages\/brand\/icons\/info\.svg differs/)
    assert.match(r.stderr, /packages\/brand\/old\.svg is no longer made/)
    assert.match(r.stderr, /run `cella brand`/)
    assert.equal(run(root).status, 0)
    assert.equal(run(root, '--check').status, 0, 'cella brand writes them back and removes the stale')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('a face house.json names that the package does not depend on is refused', () => {
  const root = copy()
  try {
    const file = join(root, 'packages/brand/house.json')
    const json = JSON.parse(readFileSync(file, 'utf8'))
    json.fonts.mono.family = 'JetBrains Mono'
    writeFileSync(file, JSON.stringify(json))
    const r = run(root, '--check')
    assert.equal(r.status, 1)
    assert.match(r.stderr, /add @fontsource-variable\/jetbrains-mono to packages\/brand\/package\.json/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
