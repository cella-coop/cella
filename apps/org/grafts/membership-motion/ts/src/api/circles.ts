// The graft's writes and reactions, its reads, and its slice, which the
// shell mounts.
import { action, type Slice } from '@cella/org-db'
import { arrange, hide, show } from '@cella/org-circle/api'
import { circles, forms as motionForms } from '@cella/org-motion/api'
import { apply } from '../handlers/apply.ts'
import { carried } from '../handlers/carried.ts'
import { close } from '../handlers/close.ts'
import { propose } from '../handlers/propose.ts'
import { put } from '../handlers/put.ts'
import { roll, turnout } from '../drivers/roll.ts'
import { changes } from '../drivers/changes.ts'
import { amending, appointing, featuring, organization, ruling, standing } from '../drivers/asking.ts'
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
export { changes } from '../drivers/changes.ts'
export type { Shown } from '../models/changes.ts'
export { amending, appointing, featuring, organization, ruling, standing } from '../drivers/asking.ts'
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
// Organization page, the coop's particulars replaced, and from a
// circle's features page, its features.
export const slice: Slice = {
  name: 'membership-motion/circles',
  extends: {
    motions: {
      list: turnout,
      // Its roll and outcome, and what its actions change, each as its diff
      // shows it.
      item: async (db, motion, actor) => {
        const r = await roll(db, motion, actor)
        return r && { ...r, changes: await changes(db, motion) }
      },
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
  // Settings' Organization page: the coop's particulars, which only the
  // assembly's motion replaces, and the scope's address and timezone; and
  // each circle's features page, a page of the circle, the root's laying
  // out the coop's features and another's choosing the groups it shows
  // and the features it hides, which a holder of `arrange-features` over
  // it changes at once, and anyone else proposes to the circle whose
  // motion changes them; and on each,
  // the changes to propose gathered across them, proposed as one motion
  // (`basket`).
  settings: {
    organization: {
      read: (db) => organization(db),
      actions: {
        propose: action('motion:motion:propose', (form, _, deps) => forms.particulars(form, deps.db), propose),
        basket: action('motion:motion:propose', (form, _, deps) => forms.basket(form, deps.db), propose),
      },
    },
    features: {
      read: async (db, _, circle) => (circle ? featuring(db, circle) : null),
      actions: {
        arrange: action('circle:feature:arrange', (form, circle) => ({ circle: circle ?? '', features: form.get('features') }), arrange),
        show: action('circle:group:show', (form, circle) => ({ circle: circle ?? '', group: form.get('group'), shown: form.get('shown') === 'yes' }), show),
        hide: action('circle:feature:hide', (form, circle) => ({ circle: circle ?? '', feature: form.get('feature'), hidden: form.get('hidden') === 'yes' }), hide),
        propose: action('motion:motion:propose', (form, _, deps) => motionForms.propose(form, deps.db), propose),
        basket: action('motion:motion:propose', (form, _, deps) => forms.basket(form, deps.db), propose),
      },
    },
    rules: {
      read: async (db, _, circle) => (circle ? ruling(db, circle) : null),
      actions: {
        propose: action('motion:motion:propose', (form, circle, deps) => forms.settings(form, circle ?? '', deps.db), propose),
        basket: action('motion:motion:propose', (form, _, deps) => forms.basket(form, deps.db), propose),
      },
    },
  },
  on: {
    'motion:motion:close': async (request, deps) => carried((request as { motion: string }).motion, deps),
  },
}
