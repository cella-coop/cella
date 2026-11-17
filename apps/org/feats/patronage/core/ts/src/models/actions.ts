import { confluent, ordered, type Actions } from '@cella/org-actions'

export const actions = {
  // the work share rule a passed motion adopted copied into its terms,
  // once
  'patronage:terms:adopt': ordered({ decide: 'majority', power: 'adopt-policy' }),
  // finance drafts a year's split for the assembly to approve: a register,
  // the latest draft standing until it is approved
  'patronage:distribution:draft': confluent({ power: 'distribute-surplus' }),
  // the assembly's motion approves a year's split, once its year is
  // closed, and its parts are made in that write
  'patronage:distribution:approve': ordered({ decide: 'majority', power: 'approve-distribution' }),
  // the approved split posted to the books, once; it follows the approval,
  // citing its motion
  'patronage:distribution:distribute': ordered({ power: 'approve-distribution' }),
  // what an associate's part buys in shares credited to their capital,
  // once; it follows the distribution, citing the motion that approved it
  'patronage:part:employ': ordered({ power: 'approve-distribution' }),
  // each save carries the whole merged snapshot, so the later receipt holds every edit before it;
  // one body per collection, so each needs its own verb: the entity plays no part in /api/<feat>/<verb>
  'patronage:body:save-distribution': confluent({ power: 'discuss' }),
  'patronage:body:save-terms': confluent({ power: 'discuss' }),
} satisfies Actions
