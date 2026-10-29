import type { Outcome } from '@cella/org-ops'
import { personal, write, type Db, type Deps, type Write } from '@cella/org-db'
import { enrolling, entering } from '@cella/org-person/api'
import type { ops } from '../models/ops.ts'
import type { Accept, Accepted, End, Ended, Invite, Invited, Link } from '../models/member.ts'

type Op = keyof typeof ops
type Out<O extends Op, T> = Promise<Outcome<(typeof ops)[O], T>>

// The invitation: a person invited on the verdict date, holding nothing,
// and the link it is taken up by, if it comes with one. Someone the co-op
// knows already, as a worker, is the same person and keeps their name;
// someone new becomes a person, and their name is personal data, which
// the log commits to and the vault keeps. `membership.invites` checks the
// write made the row and `membership.carries` that the link its payload
// names is the member's. A link that is not 32 bytes in hex is refused
// before it reaches the notary.
export function inviting(input: Invite): Write<Invited> {
  const link = input.link ? digest(input.link) : undefined
  // Whether the invitation brought a new person in, so its payload commits
  // to their name.
  let fresh = false
  return {
    op: 'membership:member:invite' satisfies Op,
    request: input,
    state: async (tx) => {
      const taken = await tx.query('SELECT FROM membership.member WHERE address = $1', [input.address])
      if (taken.rowCount) {
        throw new Error(`${input.address} is a member's address already`)
      }
      fresh = (await entering(tx, { address: input.address, name: input.name })).new
      const { rows } = await tx.query<{ invited: string }>(
        `INSERT INTO membership.member (address, status, invited) VALUES ($1, 'invited', cella.verdict_date())
         RETURNING to_char(invited, 'YYYY-MM-DD') AS invited`,
        [input.address],
      )
      if (link) {
        await linked(tx, input.address, link)
      }
      return { member: input.address, invited: rows[0].invited, ...(link ? { link } : {}) }
    },
    payload: (v) => ({ ...v, ...(fresh ? { name: personal('person.person.name', input.address, input.name) } : {}) }),
  }
}

export async function invite(input: Invite, deps: Deps): Out<'membership:member:invite', Invited> {
  return write(deps, inviting(input))
}

// A link's digest as a write carries it: 32 bytes in hex.
export function digest(link: string): string {
  const d = link.trim().toLowerCase()
  if (!/^[0-9a-f]{64}$/.test(d)) {
    throw new Error('an invitation link is 32 bytes in hex')
  }
  return d
}

async function linked(tx: Db, member: string, link: string) {
  await tx.query(`INSERT INTO membership.link (digest, member, made) VALUES (decode($1, 'hex'), $2, cella.verdict_date())`, [link, member])
}

// A new link for someone invited, under the power to invite, as a lost
// link is replaced or an imported member is first given one; someone the
// co-op never invited is refused before the notary, and `membership.links`
// checks the rest.
export function linking(input: Link): Write<Link> {
  const link = digest(input.link)
  return {
    op: 'membership:member:link' satisfies Op,
    request: input,
    state: async (tx) => {
      if (!(await tx.query('SELECT FROM membership.member WHERE address = $1', [input.member])).rowCount) {
        throw new Error(`no one invited is ${input.member}`)
      }
      await linked(tx, input.member, link)
      return { member: input.member, link }
    },
    payload: (v) => ({ ...v }),
  }
}

export async function link(input: Link, deps: Deps): Out<'membership:member:link', Link> {
  return write(deps, linking(input))
}

// An invitation taken up by its link, signed by the first device it
// enrols: the device is the invitee's, enrolled on the verdict date by no
// device, so the keyring finds it in this write's own state, and the
// acceptance keeps its label. A secret no link of theirs is the digest
// of, or an invitation taken up already, is refused before the notary;
// `membership.accepts` checks the rest.
export function accepting(input: Accept): Write<Accepted> {
  const secret = digest(input.secret)
  const key = input.key.trim().toLowerCase()
  if (!/^[0-9a-f]{64}$/.test(key)) {
    throw new Error('a device key is 32 bytes in hex')
  }
  const label = input.label.trim() || 'first device'
  return {
    op: 'membership:member:accept' satisfies Op,
    request: input,
    state: async (tx) => {
      const { rows } = await tx.query<{ link: string }>(
        `SELECT encode(digest, 'hex') AS link FROM membership.link WHERE digest = sha256(decode($1, 'hex')) AND member = $2`,
        [secret, input.member],
      )
      if (!rows[0]) {
        throw new Error(`this link is not an invitation of ${input.member}`)
      }
      if ((await tx.query('SELECT FROM membership.invitation WHERE member = $1', [input.member])).rowCount) {
        throw new Error(`${input.member} has taken up their invitation already`)
      }
      await enrolling(tx, { key, address: input.member, label })
      const accepted = await tx.query<{ accepted: string }>(
        `INSERT INTO membership.invitation (member, key, label, accepted) VALUES ($1, decode($2, 'hex'), $3, cella.verdict_date())
         RETURNING to_char(accepted, 'YYYY-MM-DD') AS accepted`,
        [input.member, key, label],
      )
      return { member: input.member, link: rows[0].link, key, accepted: accepted.rows[0].accepted }
    },
    // The label is the invitee's wording and stays out.
    payload: (v) => ({ ...v }),
  }
}

export async function accept(input: Accept, deps: Deps): Out<'membership:member:accept', Accepted> {
  return write(deps, accepting(input))
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
