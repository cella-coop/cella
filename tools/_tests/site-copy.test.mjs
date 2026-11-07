// The site's copy check (apps/site/index.md, the text): today's tree,
// every word of it in src/content/, passes; a heading planted in the page,
// a sentence in its frontmatter, a spoken attribute, a sentence under
// set:html or set:text or a component's string fails, named by its file
// and line; plumbing passes.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { check, findings, parser } from '../site-copy.mjs'

const repo = new URL('../..', import.meta.url).pathname
const site = join(repo, 'apps/site')
const parse = await parser(site)
const page = readFileSync(join(site, 'src/pages/index.astro'), 'utf8')

/** A copy of the site's structure, changed by `plant`, checked by the site's parser. */
async function planted(plant) {
  const dir = mkdtempSync(join(tmpdir(), 'site-copy-'))
  try {
    cpSync(join(site, 'src'), join(dir, 'src'), { recursive: true })
    plant(dir)
    return await check(dir, parse)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

test('today\'s tree passes: every word the site shows is in its collections', async () => {
  assert.deepEqual(await check(site), [])
  const run = spawnSync(process.execPath, [join(repo, 'tools/site-copy.mjs'), site], { encoding: 'utf8' })
  assert.equal(run.status, 0, run.stderr)
})

test('a heading planted in index.astro fails, named by its file and line', async () => {
  const line = page.split('\n').findIndex((l) => l.includes('<main>')) + 2
  const found = await planted((dir) =>
    writeFileSync(join(dir, 'src/pages/index.astro'), page.replace('<main>', '<main>\n    <h2>Join</h2>')),
  )
  assert.deepEqual(found, [`src/pages/index.astro:${line}: the text "Join" is copy`])
})

test('a page holding its own words fails at each: the frontmatter\'s strings, the props, the text', () => {
  const source = `---
import Base from '../layouts/Base.astro'
const sections = [{ id: 'what', heading: 'What cella is' }]
---

<Base title="Cella" description="Cella, the cooperative workspace.">
  <p class="line">The cooperative workspace.</p>
  {sections.map((s) => <h2 id={\`\${s.id}-heading\`}>{s.heading}</h2>)}
  <p>{'To be written.'}</p>
</Base>
`
  assert.deepEqual(findings(parse, source), [
    { line: 3, what: "the string 'What cella is' is copy" },
    { line: 6, what: 'the attribute title="Cella" is copy' },
    { line: 6, what: 'the attribute description="Cella, the cooperative workspace." is copy' },
    { line: 7, what: 'the text "The cooperative workspace." is copy' },
    { line: 9, what: "the string 'To be written.' is copy" },
  ])
})

test('a spoken attribute is copy; an attribute that names or places is plumbing', () => {
  const source = `<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="A cooperative workspace." />
  </head>
  <section id="join" class="a b" aria-labelledby="join-heading" data-theme="dark">
    <img src="/a.jpg" alt="A cell under glass" />
    <button aria-label="Close">{'x'}</button>
  </section>
  <style>
    p { color: var(--text); }
  </style>
</html>
`
  assert.deepEqual(findings(parse, source), [
    { line: 5, what: 'the attribute content="A cooperative workspace." is copy' },
    { line: 8, what: 'the attribute alt="A cell under glass" is copy' },
    { line: 9, what: 'the attribute aria-label="Close" is copy' },
  ])
})

test('a component\'s script holding a sentence fails; its paths and names pass', async () => {
  const found = await planted((dir) =>
    writeFileSync(
      join(dir, 'src/components/figures.ts'),
      "import { z } from 'astro/zod'\nexport const figures = { kind: 'over' }\nexport const label = 'Photo by someone'\n",
    ),
  )
  assert.deepEqual(found, ["src/components/figures.ts:3: the string 'Photo by someone' is copy"])
})

test('set:html and set:text render their value as content: a literal is copy, an import is not', () => {
  const source = `---
import lockup from '@cella/brand/lockup-stack.svg?raw'
---

<h1 class="lockup" set:html={lockup} />
<p set:html="A sentence." />
<p set:text="A sentence." />
<p set:html={'A sentence.'} />
`
  assert.deepEqual(findings(parse, source), [
    { line: 6, what: 'the text "A sentence." is copy' },
    { line: 7, what: 'the text "A sentence." is copy' },
    { line: 8, what: "the string 'A sentence.' is copy" },
  ])
})
