// The site's section numbering (apps/site/index.md, the layout): a page's
// top-level sections learn their page, their place, the ink of their
// photo's turn and, where they ask, their ghost numeral, in the order the
// page writes them; a nested one, and a file that is not a page, are left
// as they are.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { number, pageOf } from '../../apps/site/src/lib/sections.ts'

const page = `---
title: Home
---

<Hero heading="Top" photo="a">

Words.

</Hero>

<Section heading="One" photo="b" ghost>

<Section heading="Nested" />

</Section>

<Band ink="error" diagram="federation"
  heading={"Two\\nlines"}>

Words.

</Band>

<Section
  heading="Three"
  ghost
/>
`

test('a page is named by its file, a post by the blog', () => {
  assert.equal(pageOf('/x/apps/site/src/content/pages/about.mdx'), 'about')
  assert.equal(pageOf('/x/apps/site/src/drafts/pages/home.mdx'), 'home')
  assert.equal(pageOf('/x/apps/site/src/content/blog/why.mdx'), 'blog')
  assert.equal(pageOf('/x/apps/site/src/content/pages/home/hero.mdx'), undefined)
  assert.equal(pageOf('/x/apps/site/src/components/Section.astro'), undefined)
})

test('the top-level sections are told where they stand, in order', () => {
  const out = number(page, 'home')
  assert.match(out, /<Hero page="home" heading="Top"/)
  assert.match(out, /<Section page="home" place="0" turn="1" numeral="1" heading="One"/)
  assert.match(out, /<Band page="home" place="1" turn="2" ink="error"/)
  assert.match(out, /<Section page="home" place="2" turn="2" numeral="2"\n  heading="Three"/)
})

test('a nested section is left as it is', () => {
  assert.match(number(page, 'home'), /\n<Section heading="Nested" \/>/)
})

test('a photo is read across a tag that spans lines, and a brace keeps a quote', () => {
  const out = number('<Section\n  heading={"a > b"}\n  photo="p"\n/>\n\n<Section heading="next" />\n', 'about')
  assert.match(out, /<Section page="about" place="1" turn="2" heading="next"/)
})
