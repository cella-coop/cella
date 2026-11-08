// The brand's port of the explorer: the mark @cella/brand draws for the
// explorer's house.json, kept in brand/ as the brand left it, is the SVG
// the explorer's own markSvg() draws, and its shades, its paper and the
// tokens.css it writes are the values the explorer's themeVars() sets,
// both captured from the explorer's src.html (sha256 7fc005c3…98498e1cf8)
// into brand/. The house has since grown past the explorer, its inks
// fuller and its hues nudged, which the explorer's house leaves at their
// defaults. And `cella brand --check` names each generated file that
// differs, is missing or is left over.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { cell, cluster, grain, hues, maskField, markSvg, ORGANIC, sample, print, printCss, PRINT_INKS, printInk, printMarkup, PRINT_STYLES, PRINT_TONE, resolve, rgb8, shades, sunkL, actionL, onActionL, tokensCss } from '../../packages/brand/src/index.ts'
import { printFile } from '../../packages/brand/src/print-file.ts'

const repo = new URL('../..', import.meta.url).pathname
const brand = join(repo, 'packages/brand')
const fixture = (f) => readFileSync(new URL(`brand/${f}`, import.meta.url), 'utf8')
const house = resolve(JSON.parse(readFileSync(join(brand, 'house.json'), 'utf8')))
const ported = resolve(JSON.parse(fixture('explorer-house.json')))
const explorer = JSON.parse(fixture('explorer-theme.json'))
const themes = [['light', 1], ['dark', -1]]

test('the five hues are the phase and the step, in the pentad\'s order', () => {
  assert.deepEqual(hues(ported), [23, 91, 159, 227, 295])
  assert.deepEqual(ported.tones.accent, ported.tones.base, 'an action is ink: the accent is the paper\'s tone')
})

test('the house\'s hues are nudged off the pentad, and its inks are fuller than its tones', () => {
  assert.deepEqual(ported.nudge, [0, 0, 0, 0, 0], 'a house that names no nudge keeps the even pentad')
  assert.equal(ported.inkC, ported.statusC, 'a house that names no ink chroma inks at its tones\'')
  hues(house).forEach((h, i) => assert.equal(h, Math.round((house.phase + i * house.step + house.nudge[i] + 360) % 360), `hue ${i}`))
  assert.ok(house.inkC > house.statusC, 'the inks speak louder than the states\' text')
  assert.match(printCss(house), new RegExp(`--print-info-fill: oklch\\(${house.accentL} ${house.inkC} `), 'a state\'s fill is an ink')
})

test('a cluster is its seed\'s, inside its box, and runs off the side it bleeds to', () => {
  const opts = { pitch: 115, gutter: 12, round: 16, seed: 7, drop: 0.25 }
  const xs = (paths) => paths.flatMap((d) => [...d.matchAll(/[MLQ ]?(-?[0-9.]+) (-?[0-9.]+)/g)].map((m) => Number(m[1])))
  const held = cluster(1000, 800, opts)
  assert.deepEqual(cluster(1000, 800, opts), held, 'the same seed, the same cells')
  assert.ok(held.length > 20, `a cluster of many cells: ${held.length}`)
  assert.ok(xs(held).every((x) => x >= 0 && x <= 1000), 'every cell inside the box')
  assert.ok(xs(cluster(1000, 800, { ...opts, bleed: 'r' })).some((x) => x > 1000), 'bleeding right, a cell runs past the edge')
  assert.match(cell(11), /^M[0-9. ]+Q/, 'a lone cell is a rounded path')
})

// A cell's corners, its middle and its area, read back from its path.
const corners = (d) => [...d.matchAll(/Q(-?[0-9.]+) (-?[0-9.]+)/g)].map((m) => [Number(m[1]), Number(m[2])])
const middle = (d) => {
  const ps = corners(d)
  return [ps.reduce((s, p) => s + p[0], 0) / ps.length, ps.reduce((s, p) => s + p[1], 0) / ps.length]
}
const area = (d) => {
  const ps = corners(d)
  return Math.abs(ps.reduce((s, p, k) => s + p[0] * ps[(k + 1) % ps.length][1] - ps[(k + 1) % ps.length][0] * p[1], 0)) / 2
}

test('a cluster fills each organic silhouette, its seed\'s, inside its box', () => {
  const opts = { pitch: 115, gutter: 12, round: 16, seed: 7, drop: 0.25 }
  const xs = (paths) => paths.flatMap((d) => corners(d).map((p) => p[0]))
  for (const kind of ORGANIC) {
    const held = cluster(1000, 833, { ...opts, silhouette: kind })
    assert.deepEqual(cluster(1000, 833, { ...opts, silhouette: kind }), held, `${kind}: the same seed, the same cells`)
    assert.notDeepEqual(cluster(1000, 833, { ...opts, seed: 8, silhouette: kind }), held, `${kind}: another seed, another shape`)
    assert.ok(held.length > 12, `${kind}: a cluster of many cells: ${held.length}`)
    assert.ok(xs(held).every((x) => x >= 0 && x <= 1000), `${kind}: every cell inside the box`)
    assert.deepEqual(cluster(1000, 833, { ...opts, silhouette: { kind, limbs: 5 } }).length > 0, true, `${kind}: its limbs may be counted`)
  }
})

// A rounded cell's outline within its curves: each corner's chord
const inner = (d) => [...d.matchAll(/[ML](-?[0-9.]+) (-?[0-9.]+)Q-?[0-9.]+ -?[0-9.]+ (-?[0-9.]+) (-?[0-9.]+)/g)].flatMap((m) => [[Number(m[1]), Number(m[2])], [Number(m[3]), Number(m[4])]])
const contains = (ps, [x, y]) => ps.reduce((on, p, k) => {
  const q = ps[(k + 1) % ps.length]
  return (p[1] > y) !== (q[1] > y) && x < p[0] + ((y - p[1]) * (q[0] - p[0])) / (q[1] - p[1]) ? !on : on
}, false)
// how far a point inside a polygon lies from its nearest edge
const depth = (ps, [x, y]) => Math.min(...ps.map((p, k) => {
  const q = ps[(k + 1) % ps.length]
  const [dx, dy] = [q[0] - p[0], q[1] - p[1]]
  const t = Math.max(0, Math.min(1, ((x - p[0]) * dx + (y - p[1]) * dy) / (dx * dx + dy * dy || 1)))
  return Math.hypot(x - p[0] - t * dx, y - p[1] - t * dy)
}))

test('a cluster holds each focus whole in one cell, its largest round it', () => {
  const opts = { pitch: 115, gutter: 12, round: 16, drop: 0.25 }
  const cases = [
    [{ x: 500, y: 400, r: 60 }],
    [{ x: 150, y: 120, r: 70 }, { x: 760, y: 560, r: 40 }],
    // two faces side by side and a third apart
    [{ x: 380, y: 300, r: 45 }, { x: 470, y: 320, r: 40 }, { x: 700, y: 250, r: 50 }],
    // a row of faces too close for a gutter between them, too many to merge
    [0, 1, 2, 3, 4, 5].map((k) => ({ x: 200 + k * 110, y: 380 + (k % 2) * 40, r: 42 })),
  ]
  for (const [n, focus] of cases.entries()) {
    for (const seed of [3, 7, 11]) {
      for (const bleed of [null, 'r']) {
        const cells = cluster(1000, 769, { ...opts, seed, bleed, focus }).map(inner)
        for (const f of focus) {
          const holding = cells.filter((ps) => contains(ps, [f.x, f.y]))
          assert.equal(holding.length, 1, `case ${n}, seed ${seed}: one cell holds the focus at ${f.x}, ${f.y}`)
          const cut = Math.min(f.r, f.x - 2, 769 - 2 - f.y, f.y - 2, bleed === 'r' ? Infinity : 1000 - 2 - f.x)
          assert.ok(depth(holding[0], [f.x, f.y]) >= cut - 0.5, `case ${n}, seed ${seed}, bleed ${bleed}: no gutter within ${f.r} of ${f.x}, ${f.y}: ${depth(holding[0], [f.x, f.y]).toFixed(1)}`)
        }
      }
    }
  }
  // the cells shrink away from the focus
  const focus = [{ x: 250, y: 300, r: 60 }]
  const cells = cluster(1000, 769, { ...opts, seed: 7, focus })
  const mean = (near) => {
    const picked = cells.filter((d) => (Math.hypot(middle(d)[0] - 250, middle(d)[1] - 300) < 330) === near)
    return picked.reduce((s, d) => s + area(d), 0) / picked.length
  }
  assert.ok(mean(true) > mean(false) * 1.5, `cells near the focus average ${mean(true).toFixed(0)}, elsewhere ${mean(false).toFixed(0)}`)
  assert.deepEqual(cluster(1000, 769, { ...opts, seed: 7, focus }), cells, 'the same focus and seed, the same cells')
})

test('a mask is a signed distance a cluster fills, and a grid is sampled between its cells', () => {
  // a 20 by 20 grid, its middle 10 by 10 inside, laid over 200 by 200 from 100, 100
  const data = Array.from({ length: 400 }, (_, i) => (i % 20 >= 5 && i % 20 < 15 && Math.floor(i / 20) >= 5 && Math.floor(i / 20) < 15 ? 1 : 0))
  const place = { x: 100, y: 100, w: 200, h: 200 }
  const field = maskField({ w: 20, h: 20, data }, place)
  assert.ok(field(200, 200) < -40, `deep inside, far from the edge: ${field(200, 200)}`)
  assert.ok(Math.abs(field(150, 200)) < 12, `on the edge, near nought: ${field(150, 200)}`)
  assert.ok(field(110, 200) > 30, `outside: ${field(110, 200)}`)
  assert.ok(field(0, 200) > 140, `past the grid, its distance added: ${field(0, 200)}`)
  const at = sample({ w: 2, h: 1, data: [0, 1] }, { x: 0, y: 0, w: 2, h: 1 })
  assert.equal(at(0.5, 0.5), 0)
  assert.equal(at(1, 0.5), 0.5)
  assert.equal(at(1.5, 0.5), 1)
  const cells = cluster(400, 400, { pitch: 40, gutter: 4, round: 5, seed: 3, silhouette: { field }, loose: 0 })
  assert.ok(cells.length > 8, `the square holds many cells: ${cells.length}`)
  assert.ok(cells.every((d) => field(...middle(d)) < 20), 'every cell stands in the square')
})

test('the mark is the explorer\'s, at 240 and at 16', () => {
  for (const size of [240, 16]) {
    assert.equal(markSvg(ported.mark, hues(ported), size), fixture(`explorer-mark-${size}.svg`).trim(), `at ${size}`)
  }
})

test('the shades, the well, the action and the paper are the explorer\'s in both themes', () => {
  for (const [name, t] of themes) {
    const want = explorer[name]
    shades(ported, t).forEach((l, i) => assert.equal(l.toFixed(4), want[`--shade-${i}`], `${name} shade ${i}`))
    assert.equal(sunkL(ported, t).toFixed(4), want['--sunk-l'], `${name} sunk`)
    assert.equal(actionL(ported, t).toFixed(4), want['--accent-l'], `${name} action`)
    assert.equal(`oklch(${onActionL(ported, t).toFixed(4)} var(--tone-base))`, want['--on-accent'], `${name} on the action`)
    for (const s of ['ground', 'panel', 'raised']) {
      assert.equal(grain(ported, s, t), want[`--grain-${s}`], `${name} ${s}'s paper`)
    }
  }
})

test('tokens.css computes the explorer\'s shades and wears its paper in both themes', () => {
  const css = tokensCss(ported)
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

// The print, held to the explorer's printInto(): one fixture picture and
// what the explorer paints of it, captured in node from its src.html
// (sha256 7fc005c3…98498e1cf8) with a canvas that copies the picture
// through unscaled, for the house's halftone in three inks, at one and at
// 1.5 device pixels, and for five other presets with rotate off.
const printed = JSON.parse(fixture('explorer-print.json'))
const picture = { width: printed.width, height: printed.height, data: Buffer.from(printed.input, 'base64') }
const unit = (ink) => rgb8(printInk(ported, ink)).map((v) => v / 255)

test('house.json\'s print is the house style, and its tone the print\'s', () => {
  const raw = JSON.parse(readFileSync(join(brand, 'house.json'), 'utf8'))
  const { label, layers, ...style } = PRINT_STYLES.house
  const camel = (s) => s.replace(/-(\w)/g, (_, c) => c.toUpperCase())
  assert.equal(raw.printStyle, 'house')
  assert.deepEqual({ ...raw.print, layers: raw.print.layers.filter((l) => l.ink !== 'off') }, { ...style, layers: layers.map((l) => ({ ...l, ink: camel(l.ink) })) })
  assert.deepEqual(PRINT_TONE, { contrast: raw.dither.contrast, bright: raw.dither.bright, gamma: raw.dither.gamma })
})

test('a print\'s masks, laid on the paper in their inks, are what the explorer paints', () => {
  const paper = unit('paper')
  for (const c of printed.prints) {
    const p = print(picture, { style: PRINT_STYLES[c.style], ink: c.ink, scale: c.scale })
    const inks = p.masks.map((m) => unit(m.ink))
    const want = Buffer.from(c.rgb, 'base64')
    let worst = 0
    for (let i = 0; i < p.width * p.height; i++) {
      const rgb = [...paper]
      p.masks.forEach((m, k) => {
        const a = m.alpha[i] / 255
        for (let j = 0; j < 3; j++) {
          rgb[j] = p.over === 'multiply' ? rgb[j] * (1 - a + a * inks[k][j]) : rgb[j] + (inks[k][j] - rgb[j]) * a
        }
      })
      rgb.forEach((v, j) => {
        worst = Math.max(worst, Math.abs(v * 255 - want[i * 3 + j]))
      })
    }
    assert.ok(worst <= 1, `${c.style}${c.ink ? ` in ${c.ink}` : ''} at ${c.scale}: ${worst.toFixed(2)} levels from the explorer`)
    assert.ok(p.masks.some((m) => m.alpha.some((a) => a > 0)), `${c.style} inks something`)
  }
  assert.deepEqual(print(picture, { ink: 'info' }).masks.map((m) => m.ink), ['info-deep'], 'the house\'s one ink turns to the status asked')
})

test('a print read from a file gives the core\'s masks as PNGs', async () => {
  const sharp = createRequire(join(brand, 'package.json'))('sharp')
  const png = await sharp(picture.data, { raw: { width: picture.width, height: picture.height, channels: 4 } }).png().toBuffer()
  const file = await printFile(png, { width: picture.width, ink: 'success' })
  const core = print(picture, { ink: 'success' })
  assert.deepEqual([file.width, file.height, file.over], [core.width, core.height, core.over])
  for (const [k, m] of file.masks.entries()) {
    assert.equal(m.png[25], 4, 'a grey and alpha PNG')
    const { data, info } = await sharp(m.png).raw().toBuffer({ resolveWithObject: true })
    assert.equal(m.ink, core.masks[k].ink)
    assert.deepEqual(Uint8ClampedArray.from({ length: data.length / info.channels }, (_, i) => data[(i + 1) * info.channels - 1]), core.masks[k].alpha)
  }
})

test('print.css holds the paper and every ink, and printMarkup lays them', () => {
  const css = printCss(house)
  for (const ink of PRINT_INKS) {
    assert.match(css, new RegExp(`--print-${ink}: oklch\\(`), ink)
  }
  const p = print(picture, { style: PRINT_STYLES.poster })
  assert.equal(printMarkup(p, ['a.png', 'b"c.png', 'd.png']), [
    '<span style="--mask: url(&quot;a.png&quot;); --ink: var(--print-warning-fill)"></span>',
    '<span style="--mask: url(&quot;b&quot;c.png&quot;); --ink: var(--print-accent-fill)"></span>',
    '<span style="--mask: url(&quot;d.png&quot;); --ink: var(--print-text)"></span>',
  ].join(''))
})
