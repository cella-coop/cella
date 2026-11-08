// A short text from the frontmatter as inline markdown (index.md, the
// text): **bold**, *italic*, [links](…) and `code`, no blocks, for an
// item's title and line, which YAML holds as plain strings. The text is
// the site's own, so its markup is trusted.
import { marked } from 'marked'

export const inline = (text: string): string => marked.parseInline(text, { async: false })
