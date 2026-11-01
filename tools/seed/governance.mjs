// seed, governance: what each motion decides, its actions, in the order
// proposed, before any stance is given on it; and each invitation taken up
// (membership's), with the first device it enrolled, whose TEST-ONLY key is
// derived from the invitee's address and the device's label, as every
// fixture device's is, so the tests can sign as the invitee.

import { fixture } from '../../apps/org/core/sign/ts/src/index.ts'

// A motion's actions, from motion.toml's `[[motion.action]]`.
export async function actions(db, d) {
  for (const [i, m] of (d.action ?? []).entries()) {
    await db.query('INSERT INTO motion.action (motion, n, kind, args) VALUES ($1, $2, $3, $4)', [d.id, i + 1, m.kind, m.args ?? {}])
  }
  return (d.action ?? []).length
}

// The policies a closed motion adopted, from its actions of kind `policy`:
// each kept in the register as `policy.adopt` keeps it, protected by the
// procedure it names, if any, taking the default it names, if any,
// adopted the day the motion closed and applying from then, or from the
// day it names; a
// procedure policy's values copied into the procedure they make, a
// mandate policy's into the mandate it grants, as circle-motion's
// `adopt` does, and a rule of the capital's or the work share's terms
// into them, as account-motion and motion-patronage carry them. Returns
// how many.
export async function adopted(db, d) {
  const closed = new Date(d.closed).toISOString().slice(0, 10)
  let n = 0
  for (const [i, m] of (d.action ?? []).entries()) {
    if (m.kind !== 'policy') {
      continue
    }
    const a = m.args
    const applies = a.from && a.from > closed ? a.from : closed
    const { rows } = await db.query('SELECT policy.adopt($1, $2, $3, $4, $5, $6, $7::date, $8::date, $9, $10, $11) AS id', [
      d.circle, a.kind, a.wording, a.friendly ?? null, d.id, i + 1, applies, a.until ?? null, a.replaces ?? null, a.protected ?? null, a.takes ?? null,
    ])
    await db.query('UPDATE policy.policy SET adopted = $2 WHERE id = $1', [rows[0].id, closed])
    await db.query('SELECT motion.procedure_from($1)', [rows[0].id])
    await db.query('SELECT circle.mandate_from($1)', [rows[0].id])
    await db.query('SELECT account.terms_from($1)', [rows[0].id])
    await db.query('SELECT patronage.terms_from($1)', [rows[0].id])
    n++
  }
  return n
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
