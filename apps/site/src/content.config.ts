// The site's text (index.md, the text): every word it shows lives in
// these collections, and the pages, layouts and components read them.
import { defineCollection } from 'astro:content'
import { glob } from 'astro/loaders'
import { z } from 'astro/zod'

const link = z.object({ label: z.string(), href: z.string() })

// A vendored photo in the house's print, a panel beside the text: its
// name, or its name and the status whose ink it wears, the photo's own
// ink unset.
const backdrop = z.union([
  z.string(),
  z.object({ photo: z.string(), ink: z.enum(['error', 'warning', 'success', 'info', 'help']).optional() }),
])

// A figure a hero or a section shows beside its text: a diagram of
// @cella/diagrams by its name, or a vendored photo with its description.
const figure = z.union([
  z.object({ diagram: z.string() }),
  z.object({ photo: z.string(), alt: z.string(), print: z.string().optional() }),
])

// A card of a features section or a step of a steps section: a Phosphor
// duotone icon by its name, in a role's colours, its title and its line.
const item = z.object({
  icon: z.string().optional(),
  role: z.enum(['accent', 'success', 'error', 'warning', 'info', 'help']).optional(),
  title: z.string(),
  body: z.string(),
})

// What every page shares: the site's title and description, the header's
// links and its action, the theme toggle's label, the footer, the blog's
// labels, and the labels the site's components print: the mark under a
// diagram, and the credit under a photo, whose {name} is the
// photographer's, linked to their profile, and whose {unsplash} is
// `unsplash`, linked to the photo's page.
const site = defineCollection({
  loader: glob({ pattern: 'site.yaml', base: './src/content' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    // A page's tab title, whose {page} is the page's and {site} the site's.
    titled: z.string(),
    nav: z.array(link).default([]),
    // The narrow screen's menu button's label, read aloud.
    menu: z.string(),
    action: link.optional(),
    theme: z.object({ toggle: z.string() }),
    footer: z.object({ line: z.string(), links: z.array(link).default([]) }),
    blog: z.object({ empty: z.string(), back: z.string() }),
    diagram: z.object({ mark: z.string() }),
    photo: z.object({ credit: z.string(), unsplash: z.string() }),
  }),
})

// One page a file, its name the page's path: `home` is `/`, `blog` heads
// the blog's index, and any other is `/<name>`. Its title and description
// and its hero: an eyebrow, a heading, a lede, two actions and a figure.
const pages = defineCollection({
  loader: glob({ pattern: '*.yaml', base: './src/content/pages' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    hero: z.object({
      eyebrow: z.string().optional(),
      heading: z.string(),
      lede: z.string().optional(),
      primary: link.optional(),
      secondary: link.optional(),
      figure: figure.optional(),
      // Printed behind the whole hero, fading under its text.
      backdrop: backdrop.optional(),
    }),
  }),
})

// One section a file, under the folder of the page it belongs to,
// `sections/<page>/<id>.mdx`, in the order `order` gives, laid out by its
// kind: `prose` its body in a column, `features` its body then a grid of
// its items, `steps` its body then its items numbered, `split` its body
// beside its figure on the side `side` gives, `cta` a band of its body and
// its action. Its id is its anchor.
const sections = defineCollection({
  loader: glob({ pattern: '*/*.mdx', base: './src/content/sections' }),
  schema: z.object({
    heading: z.string(),
    order: z.number().int(),
    kind: z.enum(['prose', 'features', 'steps', 'split', 'cta']).default('prose'),
    eyebrow: z.string().optional(),
    items: z.array(item).default([]),
    figure: figure.optional(),
    // Printed in a panel behind a split's figure.
    backdrop: backdrop.optional(),
    side: z.enum(['start', 'end']).default('end'),
    action: link.optional(),
  }),
})

// One post a file, its name its path under `/blog/`: its title, its
// summary, its date and its authors. A draft shows in the dev server and
// is left out of the build.
const blog = defineCollection({
  loader: glob({ pattern: '*.mdx', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    authors: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
})

export const collections = { site, pages, sections, blog }
