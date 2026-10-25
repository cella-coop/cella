// A decision's deliberation, as the feat reads it: its messages, each its
// author's, posted while the decision is open, and their text in parts.

// A message, ordered by its receipt; `reply` is the receipt of the message
// it answers. `mentions` holds each handle its text gives, `links` each
// document it links, as typed: the grafts that join members and documents
// resolve them.
export interface Message {
  receipt: number
  member: string
  reply: number | null
  body: string
  mentions: string[]
  links: string[]
  at: string
}

export interface Post {
  decision: string
  member: string
  reply: number | null
  body: string
  mentions: string[]
  links: string[]
}

export interface Posted {
  message: number
}

// A piece of a message's text: plain text, a member mentioned by handle
// (`@amina`, the start of their address, or a whole address), or a
// document linked by its id (`[[internal-rules]]`). A handle starts after
// a space or at the start, so an address in the text is no mention.
export type Part = { text: string } | { mention: string } | { link: string }

const token = /(?<![\w.@])@([a-z0-9][a-z0-9._-]*(?:@[a-z0-9-]+(?:\.[a-z0-9-]+)+)?)|\[\[([a-z0-9][a-z0-9@._-]*)\]\]/gi

export function parts(body: string): Part[] {
  const out: Part[] = []
  let at = 0
  for (const m of body.matchAll(token)) {
    const handle = m[1]?.replace(/[._-]+$/, '')
    if (m.index > at) {
      out.push({ text: body.slice(at, m.index) })
    }
    if (handle) {
      out.push({ mention: handle.toLowerCase() })
      at = m.index + 1 + handle.length
    } else {
      out.push({ link: m[2].toLowerCase() })
      at = m.index + m[0].length
    }
  }
  if (at < body.length) {
    out.push({ text: body.slice(at) })
  }
  return out
}

// The handles a text mentions and the documents it links, each once, in
// the order given.
export const mentions = (body: string): string[] => [...new Set(parts(body).flatMap((p) => ('mention' in p ? [p.mention] : [])))]
export const links = (body: string): string[] => [...new Set(parts(body).flatMap((p) => ('link' in p ? [p.link] : [])))]

// A thread in reading order: each message after the one it answers and
// its earlier replies, at its depth.
export function threaded(messages: Message[]): (Message & { depth: number })[] {
  const under = new Map<number | null, Message[]>()
  for (const m of [...messages].sort((a, b) => a.receipt - b.receipt)) {
    const key = m.reply !== null && messages.some((x) => x.receipt === m.reply) ? m.reply : null
    under.set(key, [...(under.get(key) ?? []), m])
  }
  const out: (Message & { depth: number })[] = []
  const walk = (parent: number | null, depth: number) => {
    for (const m of under.get(parent) ?? []) {
      out.push({ ...m, depth })
      walk(m.receipt, depth + 1)
    }
  }
  walk(null, 0)
  return out
}
