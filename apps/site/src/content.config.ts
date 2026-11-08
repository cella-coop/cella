// The site's text (index.md, the text): every word it shows lives in these
// collections, the operator's under src/content/ and an agent's drafts
// under src/drafts/, the same files in the same places. A draft fills
// what the operator's file leaves out, field by field, and the operator's
// word always wins (lib/text.ts). Both load loose, since either may hold
// part of an entry; the merged entry is held to its schema (schemas.ts).
import { defineCollection } from 'astro:content'
import { glob } from 'astro/loaders'
import { z } from 'astro/zod'
import { post } from './schemas'

const loose = z.looseObject({})

const site = defineCollection({ loader: glob({ pattern: 'site.yaml', base: './src/content' }), schema: loose })
const siteDrafts = defineCollection({ loader: glob({ pattern: 'site.yaml', base: './src/drafts' }), schema: loose })

// A page is a folder of sections, `pages/<page>/<section>.mdx`, its hero
// `hero.mdx`; `home` is `/`, `blog` heads the blog's index.
const pages = defineCollection({ loader: glob({ pattern: '*/*.mdx', base: './src/content/pages' }), schema: loose })
const pageDrafts = defineCollection({ loader: glob({ pattern: '*/*.mdx', base: './src/drafts/pages' }), schema: loose })

// One post a file, its name its path under `/blog/`; the operator's alone.
const blog = defineCollection({ loader: glob({ pattern: '*.mdx', base: './src/content/blog' }), schema: post })

export const collections = { site, siteDrafts, pages, pageDrafts, blog }
