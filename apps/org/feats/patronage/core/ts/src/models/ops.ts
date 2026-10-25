import { ordered, type Ops } from '@cella/org-ops'

export const ops = {
  // the members' decision adopts the statutes' terms for the work share,
  // once
  'patronage:terms:adopt': ordered({ decide: 'majority', check: 'decided' }),
  // the assembly's decision approves a year's split, once its year is
  // closed, and its parts are made in that write
  'patronage:distribution:approve': ordered({ decide: 'majority', check: 'decided' }),
  // the approved split posted to the books and the shares it buys
  // credited, once
  'patronage:distribution:distribute': ordered({ power: 'distribute-surplus' }),
} satisfies Ops
