import { confluent, ordered, type Actions } from '@cella/org-actions'

export const actions = {
  // finance drafts the statutes' terms for the members to adopt: a
  // register, the latest draft standing until they are adopted
  'patronage:terms:draft': confluent({ power: 'distribute-surplus' }),
  // the members' motion adopts the statutes' terms for the work share,
  // once
  'patronage:terms:adopt': ordered({ decide: 'majority', check: 'decided' }),
  // finance drafts a year's split for the assembly to approve: a register,
  // the latest draft standing until it is approved
  'patronage:distribution:draft': confluent({ power: 'distribute-surplus' }),
  // the assembly's motion approves a year's split, once its year is
  // closed, and its parts are made in that write
  'patronage:distribution:approve': ordered({ decide: 'majority', check: 'decided' }),
  // the approved split posted to the books and the shares it buys
  // credited, once
  'patronage:distribution:distribute': ordered({ power: 'distribute-surplus' }),
} satisfies Actions
