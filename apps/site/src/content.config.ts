// The site's text (index.md, the text): every word it shows lives in these
// collections, the operator's under src/content/ and an agent's drafts
// under src/drafts/, the same files in the same places. A page is one MDX
// file the operator's whole once it exists, its draft standing only for
// one they have not written; the site's shared text, site.yaml, is merged
// field by field, the operator's word winning (lib/text.ts).
import { defineCollection } from 'astro:content'
import { glob } from 'astro/loaders'
import { z } from 'astro/zod'
import { page, post } from './schemas'

const loose = z.looseObject({})

const site = defineCollection({ loader: glob({ pattern: 'site.yaml', base: './src/content' }), schema: loose })
const siteDrafts = defineCollection({ loader: glob({ pattern: 'site.yaml', base: './src/drafts' }), schema: loose })

// A page is a file, `pages/<name>.mdx`; `home` is `/`, `blog` heads the
// blog's index, every other is `/<name>`.
const pages = defineCollection({ loader: glob({ pattern: '*.mdx', base: './src/content/pages' }), schema: page })
const pageDrafts = defineCollection({ loader: glob({ pattern: '*.mdx', base: './src/drafts/pages' }), schema: page })

// One post a file, its name its path under `/blog/`; the operator's alone.
const blog = defineCollection({ loader: glob({ pattern: '*.mdx', base: './src/content/blog' }), schema: post })

export const collections = { site, siteDrafts, pages, pageDrafts, blog }
