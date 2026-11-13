// The graft's writes and reactions, its reads, and its slice, which the
// shell mounts.
import { action, type Slice } from '@cella/org-db'
import { circles, forms as motionForms } from '@cella/org-motion/api'
import { apply } from '../handlers/apply.ts'
import { carried } from '../handlers/carried.ts'
import { close } from '../handlers/close.ts'
import { propose } from '../handlers/propose.ts'
import { put } from '../handlers/put.ts'
import { roll, turnout } from '../drivers/roll.ts'
import { amending, appointing, organization, standing } from '../drivers/asking.ts'
import { stances } from '../drivers/asks.ts'
import * as forms from './forms.ts'

export { apply, type Applied } from '../handlers/apply.ts'
export { carried } from '../handlers/carried.ts'
export { close } from '../handlers/close.ts'
export type { Admitted } from '../handlers/carried.ts'
export { found } from '../handlers/found.ts'
export type { Founded, Founding } from '../models/founding.ts'
export { propose } from '../handlers/propose.ts'
export { put } from '../handlers/put.ts'
export { roll, turnout } from '../drivers/roll.ts'
export { amending, appointing, organization, standing } from '../drivers/asking.ts'
export { stances } from '../drivers/asks.ts'

// A motion's roll and outcome on its page and its turnout in the list;
// its proposal, replaced by one that fixes its roll in the same verdict,
// and its close by one that counts its roll; and, in the close's
// transaction, what it decides, carried out, its admissions among them.
// On a member's page, proposing their
// admission, suspension or exclusion, and on an employee's own, applying
// to join; on a circle's, a seat in it, what the motion feat proposes
// about its powers, or, from its Settings tab, its amendment; on a
// mandate's, its change or its revocation; and from Settings'
// Organization page, the co-op's particulars replaced.
export const slice: Slice = {
  name: 'membership-motion/circles',
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
      item: async (db, circle) => {
        const seats = await appointing(db, circle)
        const terms = await amending(db, circle)
        return seats && terms ? { ...seats, amending: terms } : null
      },
      actions: {
        propose: action('motion:motion:propose', (form, _, deps) => motionForms.propose(form, deps.db), propose),
        appoint: action('motion:motion:propose', (form, id, deps) => forms.appointing(form, id ?? '', deps.db), put),
        put: action('motion:motion:propose', (form, id, deps) => circles.about(form, id ?? '', deps.db), async (input, deps) => propose(await circles.putting(input, deps.db), deps)),
      },
    },
    mandates: {
      actions: {
        put: action('motion:motion:propose', (form, id, deps) => circles.revised(form, id ?? '', deps.db), async (input, deps) => propose(await circles.putting(input, deps.db), deps)),
      },
    },
  },
  // Settings' Organization page: the co-op's particulars, which only the
  // assembly's motion replaces, and the scope's address and timezone.
  settings: {
    organization: {
      read: (db) => organization(db),
      actions: {
        propose: action('motion:motion:propose', (form, _, deps) => forms.particulars(form, deps.db), propose),
      },
    },
  },
  on: {
    'motion:motion:close': async (request, deps) => carried((request as { motion: string }).motion, deps),
  },
}
