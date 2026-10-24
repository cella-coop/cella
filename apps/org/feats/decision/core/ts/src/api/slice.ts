import { action, type Slice } from '@cella/org-db'
import { close, vote } from '../handlers/index.ts'
import { decision, decisions } from '../drivers/decision.ts'
import type { Stance } from '../models/decision.ts'

// The feat's server side as the shell mounts it: the decisions, a stance
// as the acting member, and closing a decision.
export const slice: Slice = {
  name: 'decision',
  collections: {
    decisions: {
      list: decisions,
      item: decision,
      index: async (db) => (await decisions(db)).map((d) => ({ id: d.id, title: d.title, sub: d.id })),
      actions: {
        vote: action(
          'decision:decision:vote',
          (form, id, deps) => ({ decision: id ?? '', member: deps.actor, stance: form.get('stance') as Stance }),
          vote,
        ),
        close: action('decision:decision:close', (_, id) => ({ decision: id ?? '' }), close),
      },
    },
  },
}
