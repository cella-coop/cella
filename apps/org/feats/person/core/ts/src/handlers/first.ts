import type { Db } from '@cella/org-db'
import type { Enrol } from '../models/device.ts'

// Enrols a person's first device, inside a child's write: a hire or an
// invitation taken up gives someone the device they sign with from the
// start, enrolled on the verdict date by no device. A key enrolled
// already, to anyone, is refused. The child's rule checks its write
// enrolled it.
export async function enrolling(tx: Db, input: Enrol): Promise<{ enrolled: string }> {
  if ((await tx.query(`SELECT FROM person.device WHERE key = decode($1, 'hex')`, [input.key])).rowCount) {
    throw new Error('this device key is enrolled already')
  }
  const { rows } = await tx.query<{ enrolled: string }>(
    `INSERT INTO person.device (key, address, label, enrolled) VALUES (decode($1, 'hex'), $2, $3, cella.verdict_date())
     RETURNING to_char(enrolled, 'YYYY-MM-DD') AS enrolled`,
    [input.key, input.address, input.label],
  )
  return { enrolled: rows[0].enrolled }
}
