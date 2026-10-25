import type { Outcome } from '@cella/org-ops'
import { personal, write, type Deps, type Write } from '@cella/org-db'
import { entering } from '@cella/org-person/api'
import type { ops } from '../models/ops.ts'
import type { End, Ended, Invite, Invited } from '../models/member.ts'

type Op = keyof typeof ops
type Out<O extends Op, T> = Promise<Outcome<(typeof ops)[O], T>>

// The invitation: a person invited on the verdict date, holding nothing,
// with the first device it carries, which their admission enrols. Someone
// the co-op knows already, as a worker, is the same person and keeps their
// name; someone new becomes a person, and their name is personal data,
// which the log commits to and the vault keeps. The payload commits to the
// key, so the log says which device the admission enrolled; the label
// stays out. `membership.invites` checks the write made the row and
// `membership.carries` that it carries the key. A key that is not 32
// bytes in hex, or one another invitation carries, is refused before it
// reaches the notary.
export function inviting(input: Invite): Write<Invited> {
  const key = input.key.trim().toLowerCase()
  // Whether the invitation brought a new person in, so its payload commits
  // to their name.
  let fresh = false
  if (!/^[0-9a-f]{64}$/.test(key)) {
    throw new Error('a device key is 32 bytes in hex, as the invitee’s device shows it')
  }
  return {
    op: 'membership:member:invite' satisfies Op,
    request: input,
    state: async (tx) => {
      const taken = await tx.query('SELECT FROM membership.member WHERE address = $1', [input.address])
      if (taken.rowCount) {
        throw new Error(`${input.address} is a member's address already`)
      }
      const carried = await tx.query(`SELECT member FROM membership.invitation WHERE key = decode($1, 'hex')`, [key])
      if (carried.rowCount) {
        throw new Error('another invitation carries this device key')
      }
      fresh = (await entering(tx, { address: input.address, name: input.name })).new
      const { rows } = await tx.query<{ invited: string }>(
        `INSERT INTO membership.member (address, status, invited) VALUES ($1, 'invited', cella.verdict_date())
         RETURNING to_char(invited, 'YYYY-MM-DD') AS invited`,
        [input.address],
      )
      await tx.query(`INSERT INTO membership.invitation (member, key, label) VALUES ($1, decode($2, 'hex'), $3)`, [
        input.address,
        key,
        input.label.trim(),
      ])
      return { member: input.address, invited: rows[0].invited, key }
    },
    payload: (v) => ({ ...v, ...(fresh ? { name: personal('person.person.name', input.address, input.name) } : {}) }),
  }
}

export async function invite(input: Invite, deps: Deps): Out<'membership:member:invite', Invited> {
  return write(deps, inviting(input))
}

// A suspension or an exit, each citing the decision that asks it. The
// status moves only along its lifecycle (`membership.moves`); `membership.ends`
// checks the write moved it, the decision-membership graft's rule that the
// cited decision asks it, circle-decision-membership's that it carried.
// An exit is the hook the books hang on: it sets `status` to `exited` and
// `exited` to the verdict date in its transaction, so a graft freezing
// the member's capital attaches a trigger to that update, or a rule to
// `membership:member:exit`, and settles or is refused with it.
function ending<O extends 'membership:member:suspend' | 'membership:member:exit'>(op: O, input: End): Write<Ended> {
  // The status a write leaves, and the column dating it, are one name.
  const status = op === 'membership:member:suspend' ? 'suspended' : 'exited'
  return {
    op,
    request: input,
    state: async (tx) => {
      const { rows } = await tx.query<{ on: string }>(
        `UPDATE membership.member SET status = $2, ${status} = cella.verdict_date()
         WHERE address = $1
         RETURNING to_char(${status}, 'YYYY-MM-DD') AS on`,
        [input.member, status],
      )
      return { member: input.member, on: rows[0]?.on ?? '' }
    },
    payload: (v) => ({ member: v.member, decision: input.decision }),
  }
}

export async function suspend(input: End, deps: Deps): Out<'membership:member:suspend', Ended> {
  return write(deps, ending('membership:member:suspend', input))
}

export async function exit(input: End, deps: Deps): Out<'membership:member:exit', Ended> {
  return write(deps, ending('membership:member:exit', input))
}
