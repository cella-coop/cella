// A record's threads, as every feat that has comments draws them: a root
// comment with its flat replies under it, one level, and its resolve on
// the root. A comment's text is its author's free text; a mention in it
// is `@[address]`, a reference to a core person by the pseudonym every
// entry names them by, which the thread draws by their name as it stands.
// The feat keeps the comments, their mentions and their writes; this
// knows no feat.

// A person a comment mentions, with their name as it stands now: null
// where the co-op knows no one by the address, `redacted` once erased.
export interface Named {
  person: string
  name: string | null
}

// A comment as a feat reads it: `id` is the receipt of its post, `parent`
// the root it replies to, `resolved` a root's day of resolve.
export interface Comment {
  id: number
  author: string
  name: string | null
  parent: number | null
  text: string
  mentions: Named[]
  posted: string
  resolved: string | null
}

// A root and its replies, oldest first.
export interface Thread {
  root: Comment
  replies: Comment[]
}

// A piece of a comment's text: plain text, or a person mentioned by
// address.
export type Part = { text: string } | { mention: string }

const token = /@\[([^\]\s]+)\]/g

export function parts(text: string): Part[] {
  const out: Part[] = []
  let at = 0
  for (const m of text.matchAll(token)) {
    if (m.index > at) {
      out.push({ text: text.slice(at, m.index) })
    }
    out.push({ mention: m[1].toLowerCase() })
    at = m.index + m[0].length
  }
  if (at < text.length) {
    out.push({ text: text.slice(at) })
  }
  return out
}

// The addresses a text mentions, each once, in the order given, as the
// feat's post keeps them, one mention row each.
export const mentioned = (text: string): string[] => [...new Set(parts(text).flatMap((p) => ('mention' in p ? [p.mention] : [])))]

// What a mention reads: the person's name, or `erased` once it is, or
// their address where the co-op knows no one by it.
export function label(named: Named | undefined, person: string): string {
  if (named?.name === 'redacted') {
    return 'erased'
  }
  return named?.name ?? person
}

// A comment as its box posts it: what was typed, each `@name` of a person
// picked from the mention picker turned into their `@[address]`, the
// longest name first so one never takes another's start; a name typed by
// hand that no one picked stays text.
export function composed(typed: string, picked: Named[]): { text: string; mentions: string[] } {
  let text = typed
  for (const p of [...picked].filter((p) => p.name).sort((a, b) => (b.name ?? '').length - (a.name ?? '').length)) {
    text = text.split(`@${p.name}`).join(`@[${p.person}]`)
  }
  return { text, mentions: mentioned(text) }
}

// The `@` being typed at the end of a box's text, which the picker
// answers: the words after it, or none where no `@` is being typed.
export function asking(typed: string): string | null {
  const m = /(?:^|\s)@([^\s@[\]]*(?: [^\s@[\]]*)?)$/.exec(typed)
  return m ? m[1] : null
}

// A record's comments as threads, oldest root first, each with its
// replies oldest first; a reply whose root is not there is dropped.
export function threads(comments: Comment[]): Thread[] {
  const sorted = [...comments].sort((a, b) => a.id - b.id)
  const roots = new Map(sorted.filter((c) => c.parent === null).map((c) => [c.id, { root: c, replies: [] as Comment[] }]))
  for (const c of sorted) {
    if (c.parent !== null) {
      roots.get(c.parent)?.replies.push(c)
    }
  }
  return [...roots.values()]
}
