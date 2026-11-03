// The graft's writes and reactions, its reads, and its slice, which the
// shell mounts.
import { action, type Slice } from '@cella/org-db'
import { forms as motionForms } from '@cella/org-motion/api'
import { about, putting } from '@cella/org-graft-circle-motion/api'
import { apply } from '../handlers/apply.ts'
import { carried } from '../handlers/carried.ts'
import { close } from '../handlers/close.ts'
import { propose } from '../handlers/propose.ts'
import { put } from '../handlers/put.ts'
import { roll, turnout } from '../drivers/roll.ts'
import { appointing, standing } from '../drivers/asking.ts'
import { stances } from '../drivers/inbox.ts'
import * as forms from './forms.ts'

export { apply, type Applied } from '../handlers/apply.ts'
export { carried } from '../handlers/carried.ts'
export { close, type Admitted } from '../handlers/close.ts'
export { found } from '../handlers/found.ts'
export type { Founded, Founding } from '../models/founding.ts'
export { propose } from '../handlers/propose.ts'
export { put } from '../handlers/put.ts'
export { roll, turnout } from '../drivers/roll.ts'
export { appointing, standing } from '../drivers/asking.ts'
export { stances } from '../drivers/inbox.ts'

// A motion's roll and outcome on its page and its turnout in the list;
// its proposal, replaced by one that fixes its roll in the same verdict,
// and its close by one that admits and seats; and, once a close settles,
// what else it decides, carried out. On a member's page, proposing their
// admission, suspension or exclusion, and on an employee's own, applying
// to join; on a circle's, a seat in it, or what
// circle-motion proposes about its place and powers.
export const slice: Slice = {
  name: 'circle-membership-motion',
  extends: {
    motions: {
      list: turnout,
      item: roll,
      actions: {
        propose: action('motion:motion:propose', (form, _, deps) => motionForms.propose(form, deps.db), propose),
        close: action('motion:motion:close', (_, id) => ({ motion: id ?? '' }), close),
      },
    },
    people: {
      item: (db, member, actor) => standing(db, member, actor),
      actions: {
        propose: action('motion:motion:propose', (form, id) => forms.standing(form, id ?? ''), put),
        apply: action('membership:member:apply', (form, id) => forms.applying(form, id ?? ''), apply),
      },
    },
    // The stances waiting on the acting member, in their inbox.
    inbox: { rows: stances },
    circles: {
      item: (db, circle) => appointing(db, circle),
      actions: {
        appoint: action('motion:motion:propose', (form, id, deps) => forms.appointing(form, id ?? '', deps.db), put),
        put: action('motion:motion:propose', (form, id, deps) => about(form, id ?? '', deps.db), async (input, deps) => propose(await putting(input, deps.db), deps)),
      },
    },
  },
  on: {
    'motion:motion:close': async (request, deps) => carried((request as { motion: string }).motion, deps),
  },
}
