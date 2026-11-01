import { action, type Slice } from '@cella/org-db'
import { kinds as policyKinds, register } from '@cella/org-policy'
import { close, post, propose, vote } from '../handlers/index.ts'
import { motion, motions, kinds, listing, procedures } from '../drivers/motion.ts'
import type { Stance } from '../models/motion.ts'
import * as forms from './forms.ts'

// The feat's server side as the shell mounts it: the motions, a new
// one with what it decides, a stance and a message as the acting member,
// and closing a motion.
export const slice: Slice = {
  name: 'motion',
  collections: {
    motions: {
      list: listing,
      about: async (db) => ({
        kinds: await kinds(db),
        procedures: await procedures(db),
        // The choices a policy's kind and what it replaces are offered from.
        policyKinds,
        policies: (await register(db)).filter((p) => p.ends === null).map((p) => ({ value: p.id, label: `${p.id}: ${p.sentence}` })),
      }),
      item: motion,
      index: async (db) => (await motions(db)).map((d) => ({ id: d.id, title: d.title, sub: d.id })),
      actions: {
        propose: action('motion:motion:propose', (form, _, deps) => forms.propose(form, deps.db), propose),
        vote: action(
          'motion:motion:vote',
          (form, id, deps) => ({ motion: id ?? '', member: deps.actor, stance: form.get('stance') as Stance }),
          vote,
        ),
        close: action('motion:motion:close', (_, id) => ({ motion: id ?? '' }), close),
        post: action('motion:message:post', (form, id, deps) => forms.post(form, id ?? '', deps.actor), post),
      },
    },
  },
}
