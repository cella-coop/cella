// The graft's reactions, run when the decision feat's events arrive, its
// reads, and its slice, which the shell mounts.
import { done, type Done, type Slice } from '@cella/org-db'
import { closed } from '../handlers/closed.ts'
import { roll, turnout } from '../drivers/roll.ts'

export { closed, type Admission } from '../handlers/closed.ts'
export { roll, turnout } from '../drivers/roll.ts'

// A decision's roll and outcome on its page and its turnout in the list;
// and, when a close settles, the admissions it carries and their seats.
export const slice: Slice = {
  name: 'circle-decision-member',
  extends: {
    decisions: { list: turnout, item: roll },
  },
  on: {
    'decision:decision:close': async (request, deps) => {
      const out: Done[] = []
      for (const a of await closed((request as { decision: string }).decision, deps)) {
        out.push(done('member:member:admit', a.admitted))
        if (a.seated) {
          out.push(done('circle-member:position:add', a.seated))
        }
      }
      return out
    },
  },
}
