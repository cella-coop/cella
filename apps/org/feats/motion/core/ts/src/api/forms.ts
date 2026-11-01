import type { Db, Form } from '@cella/org-db'
import { kinds, procedures } from '../drivers/motion.ts'
import type { Arg, Carried, Propose } from '../models/motion.ts'
import { links, mentions, type Post } from '../models/thread.ts'

// What the New form sends, read into a proposal: the motion, and at most
// one action, its kind's arguments in fields named `arg.<name>`, read as
// the kind declares them.
export async function propose(form: Form, db: Db): Promise<Propose> {
  const kind = form.get('kind')
  const actions: Carried[] = []
  if (kind) {
    const declared = (await kinds(db)).find((k) => k.kind === kind)
    if (!declared) {
      throw new Error(`no motion decides “${kind}”`)
    }
    actions.push({ kind, args: args(form, declared.fields) })
  }
  const procedure = form.get('procedure')
  if (!(await procedures(db)).some((p) => p.id === procedure)) {
    throw new Error(`a motion is taken by a procedure of the co-op’s, not “${procedure}”`)
  }
  if (!form.get('deadline')) {
    throw new Error('a motion needs a deadline')
  }
  return {
    circle: form.get('circle'),
    title: form.get('title'),
    procedure,
    deadline: form.get('deadline'),
    body: form.get('body'),
    actions,
  }
}

// An action's arguments, each as its kind types it; an empty one is left
// out, for the kind's guard to refuse if it needs it.
export function args(form: Form, fields: Arg[]): Carried['args'] {
  const out: Carried['args'] = {}
  for (const f of fields) {
    const typed = form.get(`arg.${f.name}`).trim()
    if (!typed) {
      continue
    }
    if (f.type === 'number') {
      const n = Number(typed.replace(',', '.'))
      if (!Number.isFinite(n)) {
        throw new Error(`“${typed}” is not a number, for ${f.label.toLowerCase()}`)
      }
      out[f.name] = n
    } else {
      out[f.name] = typed
    }
  }
  return out
}

// A message as the acting member, perhaps answering another: its text,
// and the handles it mentions and the documents it links, read from it.
export function post(form: Form, motion: string, member: string): Post {
  const body = form.get('body').trim()
  if (!body) {
    throw new Error('a message says something')
  }
  const reply = form.get('reply')
  if (reply && !/^\d+$/.test(reply)) {
    throw new Error(`a reply answers a message by its number, not “${reply}”`)
  }
  return { motion, member, reply: reply ? Number(reply) : null, body, mentions: mentions(body), links: links(body) }
}
