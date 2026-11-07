+++
title = "Diagrams"
updated = 2026-11-06
+++

`@cella/diagrams` is the landing site's diagrams: Svelte components,
each one picture of how cella works, drawn by agents and marked so.
It holds no feat and writes no SQL; it depends on no package of the
repository but the brand, whose roles it wears.

## A diagram

Each diagram is one component, `src/<name>.svelte`, its name its
file's, and is listed in `src/index.ts`, which the site reads by name.
A diagram:

- **is static**: the site renders it to HTML and SVG at build time, with
  no `client:` directive, so it ships no script;
- **wears the brand**: it reads `@cella/brand`'s roles, `var(--text)`,
  `var(--line)`, the faces and the scale, and names no colour or face
  of its own, so it restyles with the brand and follows the theme;
- **says what it is made by**: its module exports `meta`, with its
  `title`, its `alt`, the text a reader without the picture reads, and
  `made: "ai"`. `cella check site` refuses a diagram whose `meta` lacks
  any of them, and one the index does not list.

The words inside a diagram, its labels, are the diagram's, and agents
write them; the text around it is the operator's
([whose words](../../apps/site/index.md#whose-words)).
