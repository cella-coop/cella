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
  // The footer: the brand's line, the sitemap's columns, each a heading
  // over its links, and the note that the site shows prototype work.
  footer: z.object({
    line: z.string(),
    columns: z.array(z.object({ heading: z.string(), links: z.array(link) })).default([]),
    disclaimer: z.string(),
  }),
  blog: z.object({ empty: z.string(), back: z.string() }),
  // The compact sign-up for news: the field's label read aloud and its
  // placeholder, the box a co-op that might pilot ticks, the button, and
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

// A card of a features section, a step of a steps section or a row of a
// list: its title and its line.
const item = z.object({ title: z.string(), body: z.string() })

// One section of a page, laid out by its kind: `hero` the page's top,
// with its title and description; `prose` its body; `features`, `steps`
// and `list` its body then its items; `quote` its body set large, its
// heading the attribution; `cta` a band of its body and its action. A
// section with a figure sets it beside its text, the sides trading down
// the page. `heading` may mark a closing part with stars, `*like this*`,
// set thin. Its file's name is its anchor; `order` places it.
//
// A band, `quote` or `cta`, holds no photo: it draws the diagram of
// `@cella/diagrams` its `diagram` names, light on its colour, and a band
// that names none fails the build; a figure on a band is dropped.
const BANDS = ['quote', 'cta']
export const section = z
  .object({
    kind: z.enum(['hero', 'prose', 'features', 'steps', 'list', 'quote', 'cta']).default('prose'),
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
    // a form under its words: the compact sign-up or the contact form
    form: z.enum(['signup', 'contact']).optional(),
  })
  .superRefine((s, ctx) => {
    if (BANDS.includes(s.kind) && !s.diagram) {
      ctx.addIssue({ code: 'custom', path: ['diagram'], message: `is required on a ${s.kind} band: name one of @cella/diagrams` })
    }
  })
  .transform((s) => (BANDS.includes(s.kind) ? { ...s, figure: undefined } : s))

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
