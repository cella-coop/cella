import { confluent, ordered, type Actions } from '@cella/org-actions'

// A mandate has no action of its own: it is granted and revoked as its
// policy is adopted and ended, the motion feat's actions, which the motion
// feat extends with core's `granting` and `revoking`. Creating a circle
// places it nowhere: circles never nest.
export const actions = {
  // a new circle, by the motion it cites, holding the default bundle from
  // that day; ordered, since the same motion's later actions seat people in it
  'circle:circle:create': ordered({ power: 'create-circle' }),
  // a circle's name, purpose or procedure, by the motion it cites;
  // ordered, since the procedure it sets decides the motions put to the
  // circle after it
  'circle:circle:amend': ordered({ power: 'amend-circle' }),
  // the co-op's layout of features, at its root, by the motion it cites,
  // of a circle holding `arrange-features` over the root; ordered, as
  // what a motion carries is, and since it replaces the whole layout
  'circle:circle:arrange': ordered({ power: 'arrange-features' }),
  // the co-op's layout of features, at once, by whoever holds
  // `arrange-features` over the root by a seat; ordered, since it replaces
  // the whole layout from the one its entry says it was, so two saves at
  // once do not commute
  'circle:feature:arrange': ordered({ power: 'arrange-features' }),
  // a group of the layout a circle shows or not, by the motion it cites;
  // confluent: one row, a register, so two rows' writes commute and two of
  // one leave the later, needing no order over the whole listing
  'circle:circle:show': confluent({ power: 'arrange-features' }),
  // a feature a circle hides or not, by the motion it cites; confluent, a
  // register as a group's row is
  'circle:circle:hide': confluent({ power: 'arrange-features' }),
  // a group a circle shows or not, at once by whoever holds
  // `arrange-features` over it by a seat; confluent, a register
  'circle:group:show': confluent({ power: 'arrange-features' }),
  // a feature a circle hides or not, at once by whoever holds
  // `arrange-features` over it by a seat; confluent, a register
  'circle:feature:hide': confluent({ power: 'arrange-features' }),
  // a new role in a circle, or a `*` role every working circle has, by the
  // motion it cites; ordered, since the same motion's later actions seat
  // people in it
  'circle:role:make': ordered({ power: 'amend-circle' }),
  // a role's name, duty or cap, by the motion it cites; ordered, since a
  // cap counts the seats on the day
  'circle:role:amend': ordered({ power: 'amend-circle' }),
  // who holds which role; a seat is given by the motion it cites, such
  // as the admission that seats a new member in the assembly
  'circle:seat:add': ordered({ power: 'seat-member' }),
  // who holds which role; a seat is ended by the motion it cites
  'circle:seat:remove': ordered({ power: 'seat-member' }),
  // where a role's holders sit: a role made a member of another circle
  // by the motion it cites, so whoever holds it sits there
  'circle:role:seat': ordered({ power: 'seat-member' }),
  // a role's seat in another circle, ended by the motion it cites; every
  // tenure of the role stands
  'circle:role:unseat': ordered({ power: 'seat-member' }),
  // a cosmetic setting, apart from what it arranges; at once by a holder
  // of `arrange-features` over the circle, the last writer wins
  'circle:circle:icon': confluent({ power: 'arrange-features' }),
} satisfies Actions
