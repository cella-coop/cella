// seed, governance: what each decision decides, its motions, in the order
// proposed, before any stance is given on it; and the first device each
// invitation carries (key-member), whose TEST-ONLY key is derived from the
// invitee's address and the device's label, as every fixture device's is,
// so the admission that enrols it is one the tests can sign after.

import { fixture } from '../../apps/org/core/sign/ts/src/index.ts'

// A decision's motions, from decision.toml's `[[decision.motion]]`.
export async function motions(db, d) {
  for (const [i, m] of (d.motion ?? []).entries()) {
    await db.query('INSERT INTO decision.motion (decision, n, kind, args) VALUES ($1, $2, $3, $4)', [d.id, i + 1, m.kind, m.args ?? {}])
  }
  return (d.motion ?? []).length
}

// The invitations' first devices, from graft.key-member.toml.
export async function invitations(db, read) {
  const list = read('graft.key-member').invitation ?? []
  for (const i of list) {
    const { key } = await fixture(i.member, i.label)
    await db.query(`INSERT INTO key_member.invitation (member, key, label) VALUES ($1, decode($2, 'hex'), $3)`, [i.member, key, i.label])
  }
  return list.length
}
