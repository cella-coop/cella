import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { check } from '../site-diagrams.mjs'

const repo = new URL('../../packages/diagrams/package.json', import.meta.url)
const { parse } = createRequire(repo)('svelte/compiler')

function fixture(fn) {
  const root = mkdtempSync(join(tmpdir(), 'site-diagrams-'))
  const dir = join(root, 'diagrams')
  const site = join(root, 'site')
  mkdirSync(join(dir, 'src'), { recursive: true })
  mkdirSync(join(site, 'src/content/sections'), { recursive: true })
  const put = (path, source) => writeFileSync(join(root, path), source)
  try {
    put('diagrams/src/one.svelte', '<script module>export const meta = { title: "One", alt: "A picture", made: "ai" }</script><svg />')
    put('diagrams/src/index.ts', "import One from './one.svelte'\nexport const diagrams = { 'one': One }")
    put('site/src/content/sections/section.mdx', '')
    fn({ dir, site, put })
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

test('listed diagrams with attribution and named MDX placements pass', () => fixture(({ dir, site, put }) => {
  put('site/src/content/sections/section.mdx', '<Diagram name="one" />')
  assert.deepEqual(check(dir, parse, site), [])
}))

test('a figure named in a page or a nested section is read too', () => fixture(({ dir, site, put }) => {
  mkdirSync(join(site, 'src/content/sections/home'), { recursive: true })
  mkdirSync(join(site, 'src/content/pages'), { recursive: true })
  put('site/src/content/sections/home/split.mdx', '---\nfigure: { diagram: one }\n---\n<Diagram name="gone" />')
  put('site/src/content/pages/home.yaml', 'hero:\n  figure:\n    diagram: lost\n')
  const errors = check(dir, parse, site)
  assert.ok(errors.some((e) => e.includes('home/split.mdx: unknown diagram gone')))
  assert.ok(errors.some((e) => e.includes('home.yaml: unknown diagram lost')))
  assert.ok(!errors.some((e) => e.includes('diagram one')))
}))

test('a missing mark, unlisted component and unknown MDX name each fail', () => fixture(({ dir, site, put }) => {
  put('diagrams/src/one.svelte', '<script module>export const meta = { title: "One", alt: "A picture" }</script><svg />')
  put('diagrams/src/two.svelte', '<script module>export const meta = { title: "Two", alt: "Another", made: "ai" }</script><svg />')
  put('site/src/content/sections/section.mdx', '<Diagram name="missing" />')
  const errors = check(dir, parse, site)
  assert.ok(errors.some((e) => e.includes('meta must export')))
  assert.ok(errors.some((e) => e.includes('not listed')))
  assert.ok(errors.some((e) => e.includes('unknown diagram missing')))
}))
