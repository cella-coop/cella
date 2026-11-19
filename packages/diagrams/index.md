+++
title = "Diagrams"
updated = 2026-11-19
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
- **speaks the language**: it composes the parts of `src/lang/`
  ([the language](#the-language)) and styles nothing of its own, so it
  restyles with the brand, follows the theme and reads alike on the
  paper and on a band;
- **says what it is made by**: its module exports `meta`, with its
  `title`, its `alt`, the text a reader without the picture reads, and
  `made: "ai"`. `cella check site` refuses a diagram whose `meta` lacks
  any of them, and one the index does not list.

The words inside a diagram, its labels, are the diagram's, and agents
write them, few and plain: a line's name and kind, a particle's one
word. The text around it is the operator's
([whose words](../../apps/site/index.md#whose-words)).

| Diagram | What it shows | Where |
|---|---|---|
| `members-consent` | three members, their assembly and a role: a motion put, each member's consent, the motion adopted, a narrower mandate granted, the role acting | the home page's quote band |
| `federation` | two coops, each its own scope, trading signed records; a third asks to join, is answered, and receives them too | the home page's call to join |
| `mandate-tree` | authority narrowing from the GA to the board to two roles, an act, then a revoke cascading down what derived from it and the next act refused | |
| `scope-notary` | an action through a scope's notary: judged, state and signed log written in one transaction, answered; a second refused, nothing written | |
| `signed-log` | the notary appending entries to a scope's log, each signed and carrying the hash of the one before, the next drawn pending | |
| `you-join` | a coop of one member and a newcomer, You: You apply, the member consents, the motion passes and You are admitted; a mandate goes to the Cofounder role, You take it, and its first act is coffee | |

## The language

Every diagram draws in one visual language, after Feynman's diagrams:
shape and glyph carry the meaning, colour only backs it up. It is
specified once, in `src/lang/`: `Frame.svelte` holds its one
stylesheet, the other parts each draw one element, and `draw.ts` holds
the geometry of the particles' paths.

- **Time runs down.** The earliest is at the top and what follows
  stacks below it. A diagram's left edge is a hairline axis running
  down, an open chevron at its head and `TIME` under it, so nothing else
  needs an arrow (`Axis`).
- **Worldlines are who.** A circle is a double line, its two rails 4.4
  apart; a role, a person or a store a single line; a role dashed while
  it stands vacant, or a coop before it joins (`Line`). Where someone
  takes a role, a short tick crosses its line and their name, in the
  particles' italic, stands beside it; the line is solid from there.
  Each line's
  name stands at its head, above where it starts: its kind's glyph, bare, its
  name in the display face and its kind in small mono capitals
  (`Name`).
- **Authority is width.** A wash behind a line as wide as the scope of
  what it holds, so a grant visibly narrows (`Auth`).
- **Particles are what travels** (`Particle`): a grant a wavy line, its
  swing easing in and out at its vertices; a revoke the same wave
  dashed; a request dashed; an answer solid; an objection window a
  zigzag; a cascade dotted; a signed record solid, a hash link fine and
  dashed.
- **Vertices are where lines interact**: a dot where a particle leaves
  or meets a line, open where a line begins (`Dot`). Lines that cross
  without one do not interact.
- **A wait is shaded**: the time a party takes to decide, a rounded
  bar on its line (`Wait`).
- **Glyphs are what happens**: a Phosphor bold icon in a ring filled
  with the ground (`Glyph`): `check` consents, `x` says no, `hand-palm`
  objects, `hourglass-simple` stays silent, `gavel` a motion passing,
  `stamp` acts under a mandate, or the act's own icon where it says more,
  as `coins` a payment, `coffee` a cofounder's first act, `prohibit` in a dashed ring an act refused,
  `link-break` a mandate ending, `seal-check` a signed record received,
  `handshake` a party joining. A line's name wears its kind's icon, or
  its own where it has one, as `wallet` a treasurer. `src/lang/glyphs.ts` holds Phosphor's paths, vendored so the
  package depends on the brand alone; `cella check site` compares each
  with `@phosphor-icons/core`'s own and refuses one that differs.
  The same check type-checks the package by its own `tsconfig.json`,
  which the repository's leaves it to.
- **Boxes are records**: a rounded box filled with the ground, dashed
  while pending; a span, a faint wash, groups what happens together, as
  one transaction.
- **Labels** are three: a line's name in Urbanist, a kind in Geist
  Mono's small capitals, a particle's word in Inter italic, a code, a
  hash or a limit, in Geist Mono. Each is haloed by the ground, so it
  reads over the lines it crosses.

Every mark is drawn in `currentColor`, so what the diagram stands on
sets its ink: the text's on the paper, a band's light ink on a band.
`--dg-ground` is that surface, which a ring and a halo fill, the panel
unset. Three tones back a particle's kind with colour, `--dg-grant`
(grants and authority), `--dg-no` (revokes, cascades and refusals) and
`--dg-ask` (requests and answers), each the ink unset: the site's
`Diagram` sets them to the success, error and help text roles on the
paper and leaves them the ink on a band. Sizes are the viewBox's, 440
wide; a diagram fills its column, so it draws at about its own size on
a desktop and some four fifths of it on a phone.
