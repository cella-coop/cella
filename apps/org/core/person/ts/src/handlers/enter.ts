import type { Db } from '@cella/org-db'
import type { Enter } from '../models/person.ts'

// Brings someone in, inside a feat's write: an invitation, a hire or a
// person contact names a person by the address they sign with, and makes
// them one if no one holds it yet, with the email and phone it gives.
// Someone already known keeps their name and details, so a worker
// invited to join, or a member a client's contact, is the same person,
// not a second one. Whether the person is new tells the feat's payload
// whether it commits to what it gave.
export async function entering(tx: Db, input: Enter): Promise<{ person: string; new: boolean }> {
  const { rowCount } = await tx.query(
    'INSERT INTO person.person (address, name, email, phone) VALUES ($1, $2, $3, $4) ON CONFLICT (address) DO NOTHING',
    [input.address, input.name, input.email ?? null, input.phone ?? null],
  )
  return { person: input.address, new: rowCount === 1 }
}
