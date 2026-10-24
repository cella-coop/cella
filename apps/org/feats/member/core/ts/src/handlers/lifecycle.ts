import type { Outcome } from '@cella/org-ops'
import { personal, write, type Deps, type Write } from '@cella/org-db'
import type { ops } from '../models/ops.ts'
import type { End, Ended, Invite, Invited } from '../models/member.ts'

type Op = keyof typeof ops
type Out<O extends Op, T> = Promise<Outcome<(typeof ops)[O], T>>

// The invitation as a write a graft may extend in its transaction, as
// key-member does with the invitee's first device: a new member, invited
// on the verdict date, holding nothing. The name is personal data: the log
// commits to it and the vault keeps it; `member.invites` checks the write
// made the row.
export function inviting(input: Invite): Write<Invited> {
  return {
    op: 'member:member:invite' satisfies Op,
    request: input,
    state: async (tx) => {
      const taken = await tx.query('SELECT FROM member.member WHERE address = $1', [input.address])
      if (taken.rowCount) {
        throw new Error(`${input.address} is a member's address already`)
      }
      const { rows } = await tx.query<{ invited: string }>(
        `INSERT INTO member.member (address, name, status, invited) VALUES ($1, $2, 'invited', cella.verdict_date())
         RETURNING to_char(invited, 'YYYY-MM-DD') AS invited`,
        [input.address, input.name],
      )
      return { member: input.address, invited: rows[0].invited }
    },
    payload: (v) => ({ ...v, name: personal('member.member.name', input.address, input.name) }),
  }
}

export async function invite(input: Invite, deps: Deps): Out<'member:member:invite', Invited> {
  return write(deps, inviting(input))
}

// A suspension or an exit, each citing the decision that asks it. The
// status moves only along its lifecycle (`member.moves`); `member.ends`
// checks the write moved it, the decision-member graft's rule that the
// cited decision asks it, circle-decision-member's that it carried.
// An exit is the hook the books hang on: it sets `status` to `exited` and
// `exited` to the verdict date in its transaction, so a graft freezing
// the member's capital attaches a trigger to that update, or a rule to
// `member:member:exit`, and settles or is refused with it.
function ending<O extends 'member:member:suspend' | 'member:member:exit'>(op: O, input: End): Write<Ended> {
  // The status a write leaves, and the column dating it, are one name.
  const status = op === 'member:member:suspend' ? 'suspended' : 'exited'
  return {
    op,
    request: input,
    state: async (tx) => {
      const { rows } = await tx.query<{ on: string }>(
        `UPDATE member.member SET status = $2, ${status} = cella.verdict_date()
         WHERE address = $1
         RETURNING to_char(${status}, 'YYYY-MM-DD') AS on`,
        [input.member, status],
      )
      return { member: input.member, on: rows[0]?.on ?? '' }
    },
    payload: (v) => ({ member: v.member, decision: input.decision }),
  }
}

export async function suspend(input: End, deps: Deps): Out<'member:member:suspend', Ended> {
  return write(deps, ending('member:member:suspend', input))
}

export async function exit(input: End, deps: Deps): Out<'member:member:exit', Ended> {
  return write(deps, ending('member:member:exit', input))
}
