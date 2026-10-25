import { action, type Slice } from '@cella/org-db'
import { close, post, propose, vote } from '../handlers/index.ts'
import { decision, decisions, kinds, procedures } from '../drivers/decision.ts'
import type { Stance } from '../models/decision.ts'
import * as forms from './forms.ts'

// The feat's server side as the shell mounts it: the decisions, a new
// one with what it decides, a stance and a message as the acting member,
// and closing a decision.
export const slice: Slice = {
  name: 'decision',
  collections: {
    decisions: {
      list: decisions,
      about: async (db) => ({ kinds: await kinds(db), procedures: await procedures(db) }),
      item: decision,
      index: async (db) => (await decisions(db)).map((d) => ({ id: d.id, title: d.title, sub: d.id })),
      actions: {
        propose: action('decision:decision:propose', (form, _, deps) => forms.propose(form, deps.db), propose),
        vote: action(
          'decision:decision:vote',
          (form, id, deps) => ({ decision: id ?? '', member: deps.actor, stance: form.get('stance') as Stance }),
          vote,
        ),
        close: action('decision:decision:close', (_, id) => ({ decision: id ?? '' }), close),
        post: action('decision:message:post', (form, id, deps) => forms.post(form, id ?? '', deps.actor), post),
      },
    },
  },
}
