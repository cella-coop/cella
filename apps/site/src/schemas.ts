// What the site's text holds (content.config.ts, lib/text.ts): what every
// page shares, a page's frontmatter, a post's, and the photos the pages'
// components place.
import { z } from 'astro/zod'

export const STATUSES = ['error', 'warning', 'success', 'info', 'help'] as const
export type Status = (typeof STATUSES)[number]

const link = z.object({ label: z.string(), href: z.string() })

// What every page shares: the site's title and description, the header's
// links, the theme toggle's label, the footer, the blog's labels, the
// forms' words, and the credit under a photo, whose {name} is the
// photographer's, linked to their profile, and whose {unsplash} is
// `unsplash`, linked to the photo.
export const site = z.object({
  title: z.string(),
  description: z.string(),
  // A page's tab title, whose {page} is the page's and {site} the site's.
  titled: z.string(),
  nav: z.array(link).default([]),
  // The address people write to, shown in the footer and wherever a page
  // places `<Email />`, hidden from harvesters (src/lib/email.ts).
  email: z.string().optional(),
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
  // what it says once sent or failed. A form's words are needed only
  // where a page places it, which refuses to build without them.
  signup: z
    .object({
      label: z.string(),
      placeholder: z.string(),
      pilot: z.string(),
      submit: z.string(),
      done: z.string(),
      failed: z.string(),
    })
    .optional(),
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
  }).optional(),
  // The mark under a diagram, which says it was made by a model.
  diagram: z.object({ mark: z.string() }),
  photo: z.object({ credit: z.string(), unsplash: z.string() }),
})

// A page's frontmatter: its tab title, its description for search and
// sharing, and whether it is `unlisted`, kept from search engines and
// never linked from the header, for a page sent by its address alone.
// Everything else on it is its body, the components it places.
export const page = z.object({
  title: z.string(),
  description: z.string().optional(),
  unlisted: z.boolean().default(false),
})

// A vendored photo engraved in one of the five inks, inside a cluster of
// cells: its name, its caption, what it shows, read aloud, and its ink
// where the page's turn should not choose it.
export type Figure = {
  photo: string
  caption?: string
  alt?: string
  ink?: Status
}
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
