// seed, governance: what each decision decides, its motions, in the order
// proposed, before any stance is given on it; and each invitation taken up
// (membership's), with the first device it enrolled, whose TEST-ONLY key is
// derived from the invitee's address and the device's label, as every
// fixture device's is, so the tests can sign as the invitee.

import { fixture } from '../../apps/org/core/sign/ts/src/index.ts'

// A decision's motions, from decision.toml's `[[decision.motion]]`.
export async function motions(db, d) {
  for (const [i, m] of (d.motion ?? []).entries()) {
    await db.query('INSERT INTO decision.motion (decision, n, kind, args) VALUES ($1, $2, $3, $4)', [d.id, i + 1, m.kind, m.args ?? {}])
  }
  return (d.motion ?? []).length
}

// The invitations taken up, from membership.toml's `[[invitation]]`: each
// enrolled its first device on the day it was accepted, by no device.
export async function invitations(db, read) {
  const list = read('membership').invitation ?? []
  for (const i of list) {
    const { key } = await fixture(i.member, i.label)
    const accepted = new Date(i.accepted).toISOString().slice(0, 10)
    await db.query(`INSERT INTO person.device (key, address, label, enrolled) VALUES (decode($2, 'hex'), $1, $3, $4)`, [i.member, key, i.label, accepted])
    await db.query(`INSERT INTO membership.invitation (member, key, label, accepted) VALUES ($1, decode($2, 'hex'), $3, $4)`, [i.member, key, i.label, accepted])
  }
  return list.length
}
