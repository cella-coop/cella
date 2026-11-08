// What a whole entry of the site's text holds, once the operator's file
// and its draft are merged (content.config.ts, lib/text.ts).
import { z } from 'astro/zod'

export const STATUSES = ['error', 'warning', 'success', 'info', 'help'] as const
export type Status = (typeof STATUSES)[number]

const link = z.object({ label: z.string(), href: z.string() })

// What every page shares: the site's title and description, the header's
// links, the theme toggle's label, the footer, the blog's labels, and the
// credit under a photo, whose {name} is the photographer's, linked to
// their profile, and whose {unsplash} is `unsplash`, linked to the photo.
export const site = z.object({
  title: z.string(),
  description: z.string(),
  // A page's tab title, whose {page} is the page's and {site} the site's.
  titled: z.string(),
  nav: z.array(link).default([]),
  // The narrow screen's menu button's label, read aloud.
  menu: z.string(),
  theme: z.object({ toggle: z.string() }),
  // The footer: the brand's line, the home page's link's label before the
  // header's links it repeats, and the note that the site shows prototype
  // work.
  footer: z.object({
    line: z.string(),
    home: z.string(),
    disclaimer: z.string(),
  }),
  blog: z.object({ empty: z.string(), back: z.string() }),
  // The compact sign-up for news: the field's label read aloud and its
  // placeholder, the box a coop that might pilot ticks, the button, and
  // what it says once sent or failed.
  signup: z.object({
    label: z.string(),
    placeholder: z.string(),
    pilot: z.string(),
    submit: z.string(),
    done: z.string(),
    failed: z.string(),
  }),
  // The contact form: its fields' labels and placeholders, the boxes for
  // the newsletter and the pilot, the button, and what it says once sent
  // or failed.
  contact: z.object({
    name: z.string(),
    namePlaceholder: z.string(),
    email: z.string(),
    emailPlaceholder: z.string(),
    note: z.string(),
    notePlaceholder: z.string(),
    list: z.string(),
    pilot: z.string(),
    submit: z.string(),
    done: z.string(),
    failed: z.string(),
  }),
  // The mark under a diagram, which says it was made by a model.
  diagram: z.object({ mark: z.string() }),
  photo: z.object({ credit: z.string(), unsplash: z.string() }),
})

// A vendored photo engraved in one of the five inks, inside a cluster of
// cells: its name, its caption, what it shows, read aloud, and its ink
// where the page's turn should not choose it.
const figure = z.object({
  photo: z.string(),
  caption: z.string().optional(),
  alt: z.string().optional(),
  ink: z.enum(STATUSES).optional(),
})

// An item: its title and its line, a step of a steps section, a row of a
// list, or in any other section a cell of its list of cells, holding the
// Phosphor icon `icon` names, or the portrait `photo` names, a person's
// picture in `src/people/`, engraved in the cell.
const item = z.object({ title: z.string(), body: z.string(), icon: z.string().optional(), photo: z.string().optional() })

// One section of a page, laid out by its kind: `hero` the page's top,
// with its title and description; `prose` its body; `features`, `steps`
// and `list` its body then its items, and any other kind with items its
// items as a list of cells under its body; `band` a strong band of one of
// the five inks, `ink`, sage unset, holding what any section may and its
// diagram, its body set large and its heading the attribution where it is
// a `quote: true`. `quote` is a band that quotes, sage unless its ink
// says; `cta` a band, coral unless its ink says. A section with a figure
// sets it beside its text, the sides trading down the page. `heading`
// may mark a closing part with stars, `*like this*`, set thin. Its file's
// name is its anchor; `order` places it.
//
// A band holds no photo: it draws the diagram of `@cella/diagrams` its
// `diagram` names, or the Phosphor icon its `icon` names, large, light on
// its colour; a band that names neither, or both, fails the build, and a
// figure on a band is dropped.
const BANDS = ['band', 'quote', 'cta']
export const section = z
  .object({
    kind: z.enum(['hero', 'prose', 'features', 'steps', 'list', 'band', 'quote', 'cta']).default('prose'),
    order: z.number().default(0),
    title: z.string().optional(),
    description: z.string().optional(),
    eyebrow: z.string().optional(),
    heading: z.string(),
    primary: link.optional(),
    secondary: link.optional(),
    action: link.optional(),
    items: z.array(item).default([]),
    figure: figure.optional(),
    diagram: z.string().optional(),
    icon: z.string().optional(),
    // a form under its words: the compact sign-up or the contact form
    form: z.enum(['signup', 'contact']).optional(),
    // its items' list counts them, and is laid out by `arrange`, a list's
    // layout (List.astro), or by what its kind implies: ruled for a list,
    // steps for steps, a column of cells else (`layout` is MDX's own word:
    // a file naming one is wrapped in that component)
    numbered: z.boolean().default(false),
    arrange: z.enum(['column', 'row', 'grid', 'ruled', 'steps']).optional(),
    // whether it carries a ghost numeral, its place among those that do
    ghost: z.boolean().default(false),
    // a band's ink, and whether it quotes
    ink: z.enum(STATUSES).optional(),
    quote: z.boolean().default(false),
  })
  .superRefine((s, ctx) => {
    if (BANDS.includes(s.kind) && !s.diagram && !s.icon) {
      ctx.addIssue({ code: 'custom', path: ['diagram'], message: `is required on a ${s.kind} band: name one of @cella/diagrams, or a Phosphor icon as \`icon\`` })
    }
    if (s.diagram && s.icon) {
      ctx.addIssue({ code: 'custom', path: ['icon'], message: 'and a diagram both name the band\'s plate: keep one' })
    }
  })
  // every band is a `band`: a quote one that quotes, sage unset, a cta one
  // coral unset; and none keeps a figure
  .transform((s) => {
    if (s.kind === 'quote') {
      return { ...s, kind: 'band' as const, quote: true, ink: s.ink ?? ('success' as const), figure: undefined }
    }
    if (s.kind === 'cta') {
      return { ...s, kind: 'band' as const, ink: s.ink ?? ('error' as const), figure: undefined }
    }
    if (s.kind === 'band') {
      return { ...s, ink: s.ink ?? ('success' as const), figure: undefined }
    }
    return s
  })

export type Section = z.infer<typeof section>
export type Figure = z.infer<typeof figure>
export type Link = z.infer<typeof link>

// A post: its title, its summary, its date and its authors. A draft post
// shows in the dev server and is left out of the build.
export const post = z.object({
  title: z.string(),
  description: z.string(),
  date: z.coerce.date(),
  authors: z.array(z.string()).default([]),
  draft: z.boolean().default(false),
})
