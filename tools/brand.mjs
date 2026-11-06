// cella brand: writes @cella/brand's generated files from its house.json,
// the model in packages/brand/src doing the work. This is its node half:
// it reads the source and the font, and writes, or with --check compares
// and names each file that differs, is missing or is left over.
//
//   node tools/brand.mjs [--check] [<repo>]

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import * as fontkit from 'fontkit'
import woff2 from 'wawoff2'
import { fontPackage, fontsCss, hues, iconSvg, lockupSvg, markSvg, name, printCss, resolve, starlightCss, tokensCss, tokensJson, wordmarkSvg } from '../packages/brand/src/index.ts'

const args = process.argv.slice(2)
const check = args.includes('--check')
const repo = args.find((a) => !a.startsWith('--')) ?? process.cwd()
const dir = join(repo, 'packages/brand')
const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
const house = resolve(JSON.parse(readFileSync(join(dir, 'house.json'), 'utf8')))
const icons = JSON.parse(readFileSync(join(dir, 'icons.json'), 'utf8'))
const require = createRequire(join(dir, 'package.json'))

const fail = (msg) => {
  console.error(`brand: ${msg}`)
  process.exit(1)
}
for (const role of ['display', 'text', 'mono']) {
  const p = fontPackage(house.fonts[role].family)
  if (!pkg.dependencies?.[p]) {
    fail(`house.json's ${role} face is ${house.fonts[role].family}; add ${p} to packages/brand/package.json`)
  }
}

// The display face's outlines of the name, at the mark's weight: the
// variable font decompressed from its WOFF2, since fontkit varies only a
// TrueType's glyphs.
const display = house.fonts.display.family
const files = join(require.resolve(`${fontPackage(display)}/package.json`), '..', 'files')
const latin = readdirSync(files).find((f) => /-latin-wght-normal\.woff2$/.test(f))
if (!latin) {
  fail(`${fontPackage(display)} has no latin wght woff2`)
}
const font = fontkit.create(Buffer.from(await woff2.decompress(readFileSync(join(files, latin)))))
const varied = font.getVariation({ wght: house.mark.weight })
const run = varied.layout(name(house.mark))
const outlines = {
  unitsPerEm: font.unitsPerEm,
  ascent: font.ascent,
  descent: font.descent,
  capHeight: font.capHeight,
  glyphs: run.glyphs.map((g, i) => ({ advance: run.positions[i].xAdvance, commands: g.path.commands })),
}

const svg = (s) => `${s.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ')}\n`
const hs = hues(house)
const lockMark = markSvg(house.mark, hs, 240, 'lk')
const out = new Map([
  ['tokens.css', tokensCss(house)],
  ['tokens.json', tokensJson(house)],
  ['fonts.css', fontsCss(house)],
  ['starlight.css', starlightCss()],
  ['print.css', printCss(house)],
  ['mark.svg', svg(markSvg(house.mark, hs, 240))],
  ['favicon.svg', svg(markSvg(house.mark, hs, 16))],
  ['wordmark.svg', wordmarkSvg(outlines, house.mark)],
  ['lockup.svg', lockupSvg(outlines, house.mark, lockMark, 'row')],
  ['lockup-stack.svg', lockupSvg(outlines, house.mark, lockMark, 'stack')],
  ...Object.entries(icons).map(([icon, body]) => [`icons/${icon}.svg`, iconSvg(body)]),
])

// What is generated and no longer made: any svg or generated sheet at the
// root, any icon.
const kept = new Set(['house.json', 'icons.json', 'package.json', 'tokens.json'])
const present = [
  ...readdirSync(dir).filter((f) => /\.(svg|css)$/.test(f) || (f.endsWith('.json') && !kept.has(f))),
  ...(existsSync(join(dir, 'icons')) ? readdirSync(join(dir, 'icons')).map((f) => `icons/${f}`) : []),
]
const stale = present.filter((f) => !out.has(f))

if (check) {
  const wrong = [...out].filter(([f, text]) => !existsSync(join(dir, f)) || readFileSync(join(dir, f), 'utf8') !== text).map(([f]) => f)
  if (wrong.length || stale.length) {
    fail([
      ...wrong.map((f) => `packages/brand/${f} differs from what house.json makes`),
      ...stale.map((f) => `packages/brand/${f} is no longer made`),
      'run `cella brand` and commit what it writes',
    ].join('\nbrand: '))
  }
  console.log(`brand: ${out.size} files as house.json makes them`)
} else {
  mkdirSync(join(dir, 'icons'), { recursive: true })
  for (const [f, text] of out) {
    writeFileSync(join(dir, f), text)
  }
  for (const f of stale) {
    rmSync(join(dir, f))
  }
  console.log(`brand: wrote ${out.size} files${stale.length ? `, removed ${stale.length}` : ''}`)
}
