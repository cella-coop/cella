// The site's text (index.md, the text): every word it shows lives in
// these collections, and the pages, layouts and components read them.
import { defineCollection } from 'astro:content'
import { glob } from 'astro/loaders'
import { z } from 'astro/zod'

// The page's title and description, the hero's line, and the labels the
// site's components print: the mark under a diagram, and the credit under
// a photo, whose {name} is the photographer's, linked to their profile,
// and whose {unsplash} is `unsplash`, linked to the photo's page.
const site = defineCollection({
  loader: glob({ pattern: 'site.yaml', base: './src/content' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    line: z.string(),
    diagram: z.object({ mark: z.string() }),
    photo: z.object({ credit: z.string(), unsplash: z.string() }),
  }),
})

// One section of the page a file, in the order `order` gives.
const sections = defineCollection({
  loader: glob({ pattern: '*.mdx', base: './src/content/sections' }),
  schema: z.object({
    heading: z.string(),
    order: z.number().int(),
  }),
})

export const collections = { site, sections }
