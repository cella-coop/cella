import type { Db, Form } from '@cella/org-db'
import { kinds } from '../drivers/decision.ts'
import { stances, type Arg, type Motion, type Propose, type Rule } from '../models/decision.ts'

// What the New form sends, read into a proposal: the decision, and at most
// one motion, its kind's arguments in fields named `arg.<name>`, read as
// the kind declares them.
export async function propose(form: Form, db: Db): Promise<Propose> {
  const kind = form.get('kind')
  const motions: Motion[] = []
  if (kind) {
    const declared = (await kinds(db)).find((k) => k.kind === kind)
    if (!declared) {
      throw new Error(`no decision decides “${kind}”`)
    }
    motions.push({ kind, args: args(form, declared.fields) })
  }
  const rule = form.get('rule')
  if (!(rule in stances)) {
    throw new Error(`a decision is taken by consent or by majority, not “${rule}”`)
  }
  if (!form.get('deadline')) {
    throw new Error('a decision needs a deadline')
  }
  return {
    circle: form.get('circle'),
    title: form.get('title'),
    rule: rule as Rule,
    deadline: form.get('deadline'),
    body: form.get('body'),
    motions,
  }
}

// A motion's arguments, each as its kind types it; an empty one is left
// out, for the kind's rule to refuse if it needs it.
export function args(form: Form, fields: Arg[]): Motion['args'] {
  const out: Motion['args'] = {}
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
