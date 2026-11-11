import type { Db } from '@cella/org-db'
import type { Enter } from '../models/person.ts'

// Brings someone in, inside a child's write: an invitation or a hire names
// a person by the address they sign with, and makes them one if no one
// holds it yet. Someone already known keeps their name, so a worker
// invited to join is the same person, not a second one. Whether the
// person is new tells the child's payload whether it commits to their
// name.
export async function entering(tx: Db, input: Enter): Promise<{ person: string; new: boolean }> {
  const { rowCount } = await tx.query(
    'INSERT INTO person.person (address, name) VALUES ($1, $2) ON CONFLICT (address) DO NOTHING',
    [input.address, input.name],
  )
  return { person: input.address, new: rowCount === 1 }
}
