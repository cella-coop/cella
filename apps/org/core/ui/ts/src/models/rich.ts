// A comment's rich text: the Markdown subset every comment box writes and
// every comment is drawn from, kept as text in the comment's own column.
// Bold `**x**`, italic `*x*`, inline code `` `x` ``, a link `[x](url)`,
// bullet (`- `) and numbered (`1. `) lists and quotes (`> `); a single
// line break is a break, a blank line a new paragraph, so a plain comment
// written before reads as it did. A feat's own tokens, as `@[address]`
// mentions and `[[document]]` links, are plain text here, which the
// feat's drawing of text splits. Nothing in it is HTML: it is parsed into
// the nodes below, and drawn by them alone.

export type Inline =
  | { kind: 'text'; text: string }
  | { kind: 'bold' | 'italic'; children: Inline[] }
  | { kind: 'code'; text: string }
  | { kind: 'link'; href: string; children: Inline[] }
  | { kind: 'break' }

export type Block =
  | { kind: 'paragraph' | 'quote'; children: Inline[] }
  | { kind: 'bullet' | 'numbered'; start: number; items: Inline[][] }

const punct = /[\\`*_[\]()>#+\-.!~|{}]/

// Where a link may point: the web, mail, or a path in the app.
export const safe = (href: string): boolean => /^(https?:\/\/|mailto:)/i.test(href) || /^\/(?!\/)/.test(href)

type Line = { kind: 'blank' } | { kind: 'line' | 'quote'; text: string } | { kind: 'bullet' | 'numbered'; text: string; n: number }

function line(raw: string): Line {
  if (!raw.trim()) {
    return { kind: 'blank' }
  }
  const bullet = /^\s{0,3}[-*+]\s+(.*)$/.exec(raw)
  if (bullet) {
    return { kind: 'bullet', text: bullet[1], n: 1 }
  }
  const numbered = /^\s{0,3}(\d{1,9})[.)]\s+(.*)$/.exec(raw)
  if (numbered) {
    return { kind: 'numbered', text: numbered[2], n: Number(numbered[1]) }
  }
  const quote = /^\s{0,3}>\s?(.*)$/.exec(raw)
  if (quote) {
    return { kind: 'quote', text: quote[1] }
  }
  return { kind: 'line', text: raw }
}

// A text's blocks: its lines grouped by kind, a blank line ending each.
export function parse(md: string): Block[] {
  const out: Block[] = []
  let last: Line['kind'] = 'blank'
  for (const l of md.replace(/\r\n?/g, '\n').split('\n').map(line)) {
    const prev = out.at(-1)
    if (l.kind === 'blank') {
      last = 'blank'
      continue
    }
    const same = last === l.kind && prev
    last = l.kind
    if (l.kind === 'bullet' || l.kind === 'numbered') {
      if (same && prev.kind === l.kind) {
        prev.items.push(inline(l.text))
      } else {
        out.push({ kind: l.kind, start: l.n, items: [inline(l.text)] })
      }
    } else {
      const kind = l.kind === 'quote' ? 'quote' : 'paragraph'
      if (same && prev.kind === kind) {
        prev.children.push({ kind: 'break' }, ...inline(l.text))
      } else {
        out.push({ kind, children: inline(l.text) })
      }
    }
  }
  return out
}

// Where an emphasis opened at `from` closes: the next `mark` after a
// non-space, unescaped, and for a single `*` not half of a `**`.
function closing(s: string, from: number, mark: string): number {
  for (let j = from + 1; j < s.length; j++) {
    if (s[j] === '\\') {
      j++
      continue
    }
    if (s[j] === '`') {
      const end = s.indexOf('`', j + 1)
      if (end > j) {
        j = end
        continue
      }
    }
    if (!s.startsWith(mark, j) || /\s/.test(s[j - 1])) {
      continue
    }
    if (mark === '*' && (s[j + 1] === '*' || s[j - 1] === '*')) {
      if (s.startsWith('**', j)) {
        j++
      }
      continue
    }
    return j
  }
  return -1
}

// A line's runs.
export function inline(s: string): Inline[] {
  const out: Inline[] = []
  let text = ''
  const push = () => {
    if (text) {
      out.push({ kind: 'text', text })
      text = ''
    }
  }
  let i = 0
  while (i < s.length) {
    const c = s[i]
    if (c === '\\' && i + 1 < s.length && punct.test(s[i + 1])) {
      text += s[i + 1]
      i += 2
      continue
    }
    if (c === '`') {
      const end = s.indexOf('`', i + 1)
      if (end > i + 1) {
        push()
        out.push({ kind: 'code', text: s.slice(i + 1, end) })
        i = end + 1
        continue
      }
    }
    if (c === '*') {
      const mark = s.startsWith('**', i) ? '**' : '*'
      const from = i + mark.length
      if (from < s.length && !/\s/.test(s[from])) {
        const end = closing(s, from - 1, mark)
        if (end > from) {
          push()
          out.push({ kind: mark === '**' ? 'bold' : 'italic', children: inline(s.slice(from, end)) })
          i = end + mark.length
          continue
        }
      }
    }
    // A link, but never a feat's `[[…]]` or `@[…]`.
    if (c === '[' && s[i + 1] !== '[' && s[i - 1] !== '[' && s[i - 1] !== '@') {
      const m = /^\[([^\]\n]+)\]\(([^)\s]+)\)/.exec(s.slice(i))
      if (m && safe(m[2])) {
        push()
        out.push({ kind: 'link', href: m[2], children: inline(m[1]) })
        i += m[0].length
        continue
      }
    }
    if (c === '\n') {
      push()
      out.push({ kind: 'break' })
      i++
      continue
    }
    text += c
    i++
  }
  push()
  return out
}

const entities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
export const escape = (s: string): string => s.replace(/[&<>"']/g, (c) => entities[c])

function runs(items: Inline[]): string {
  return items
    .map((n) => {
      switch (n.kind) {
        case 'text':
          return escape(n.text)
        case 'break':
          return '<br>'
        case 'code':
          return `<code>${escape(n.text)}</code>`
        case 'bold':
          return `<b>${runs(n.children)}</b>`
        case 'italic':
          return `<i>${runs(n.children)}</i>`
        case 'link':
          return `<a href="${escape(n.href)}">${runs(n.children)}</a>`
      }
    })
    .join('')
}

// A text as the editor's markup, every character escaped: what a paste
// of Markdown, or a box opened on a draft, puts in the editor.
export function html(md: string): string {
  return parse(md)
    .map((b) => {
      switch (b.kind) {
        case 'paragraph':
          return `<p>${runs(b.children)}</p>`
        case 'quote':
          return `<blockquote>${runs(b.children)}</blockquote>`
        case 'bullet':
          return `<ul>${b.items.map((i) => `<li>${runs(i)}</li>`).join('')}</ul>`
        case 'numbered':
          return `<ol${b.start === 1 ? '' : ` start="${b.start}"`}>${b.items.map((i) => `<li>${runs(i)}</li>`).join('')}</ol>`
      }
    })
    .join('')
}

// What a paste of `md` puts at the caret: a single paragraph as its runs,
// so it joins the line it lands in, else its blocks.
export function pasted(md: string): string {
  const blocks = parse(md)
  return blocks.length === 1 && blocks[0].kind === 'paragraph' ? runs(blocks[0].children) : html(md)
}

// A suggestion a box offers for what is typed: shown by its label, and
// put in the text as its token, as a person's `@[address]`.
export interface Suggestion {
  label: string
  token: string
  sub?: string
}

export type Trigger = '@' | '[['

// The suggestion being asked for at the caret, from the text before it on
// its line: an `@` after a space or at the start, with up to two words
// after it, as a name is typed, or a `[[` and what follows it; with how
// many characters it spans. Null where none is.
export function asked(before: string): { trigger: Trigger; query: string; length: number } | null {
  const at = /(?:^|[\s(])@([^\s@[\]]*(?: [^\s@[\]]*)?)$/.exec(before.replace(/ /g, ' '))
  if (at) {
    return { trigger: '@', query: at[1], length: at[1].length + 1 }
  }
  const link = /\[\[([^\]\n]*)$/.exec(before)
  if (link) {
    return { trigger: '[[', query: link[1], length: link[1].length + 2 }
  }
  return null
}

function words(items: Inline[]): string {
  return items.map((n) => (n.kind === 'break' ? ' ' : 'text' in n ? n.text : words(n.children))).join('')
}

// A text with its marks gone, on one line, as a preview reads it.
export function plain(md: string): string {
  return parse(md)
    .map((b) => ('items' in b ? b.items.map(words).join(' ') : words(b.children)))
    .join(' ')
}

// Text typed as it is, escaped so no character of it reads as a mark.
export const literal = (s: string): string => s.replace(/[\\`*]/g, '\\$&')

// A line typed as it is that would read as a list item or a quote,
// escaped so it reads as a line.
export const unlisted = (s: string): string =>
  s
    .replace(/^(\s*)([-+])(\s)/, '$1\\$2$3')
    .replace(/^(\s*\d+)([.)])(\s)/, '$1\\$2$3')
    .replace(/^(\s*)>/, '$1\\>')
