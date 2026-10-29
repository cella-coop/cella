// The graft's writes and reactions, its reads, and its slice, which the
// shell mounts.
import { action, type Slice } from '@cella/org-db'
import { forms as decisionForms } from '@cella/org-decision/api'
import { motion, putting } from '@cella/org-graft-circle-decision/api'
import { carried } from '../handlers/carried.ts'
import { close } from '../handlers/close.ts'
import { propose } from '../handlers/propose.ts'
import { put } from '../handlers/put.ts'
import { roll, turnout } from '../drivers/roll.ts'
import { appointing, standing } from '../drivers/asking.ts'
import { stances } from '../drivers/inbox.ts'
import * as forms from './forms.ts'

export { carried } from '../handlers/carried.ts'
export { close, type Admitted } from '../handlers/close.ts'
export { propose } from '../handlers/propose.ts'
export { put } from '../handlers/put.ts'
export { roll, turnout } from '../drivers/roll.ts'
export { appointing, standing } from '../drivers/asking.ts'
export { stances } from '../drivers/inbox.ts'

// A decision's roll and outcome on its page and its turnout in the list;
// its proposal, replaced by one that fixes its roll in the same verdict,
// and its close by one that admits and seats; and, once a close settles,
// what else it decides, carried out. On a member's page, proposing their
// admission, suspension or exit; on a circle's, a seat in it, or what
// circle-decision proposes about its place and powers.
export const slice: Slice = {
  name: 'circle-decision-membership',
  extends: {
    decisions: {
      list: turnout,
      item: roll,
      actions: {
        propose: action('decision:decision:propose', (form, _, deps) => decisionForms.propose(form, deps.db), propose),
        close: action('decision:decision:close', (_, id) => ({ decision: id ?? '' }), close),
      },
    },
    people: {
      item: (db, member) => standing(db, member),
      actions: {
        propose: action('decision:decision:propose', (form, id) => forms.standing(form, id ?? ''), put),
      },
    },
    // The stances waiting on the acting member, in their inbox.
    inbox: { rows: stances },
    circles: {
      item: (db, circle) => appointing(db, circle),
      actions: {
        appoint: action('decision:decision:propose', (form, id, deps) => forms.appointing(form, id ?? '', deps.db), put),
        put: action('decision:decision:propose', (form, id, deps) => motion(form, id ?? '', deps.db), async (input, deps) => propose(await putting(input, deps.db), deps)),
      },
    },
  },
  on: {
    'decision:decision:close': async (request, deps) => carried((request as { decision: string }).decision, deps),
  },
}
