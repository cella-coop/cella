import type { Db, Form } from '@cella/org-db'
import type { Asking } from '../models/asking.ts'

const when = (form: Form) => {
  if (!form.get('deadline')) {
    throw new Error('a motion needs a deadline')
  }
  return { deadline: form.get('deadline'), body: form.get('body') }
}

// A proposal from a member's page: to admit them with their shares, to
// suspend them, to end their membership or, once they have left, to erase
// their personal data.
export function standing(form: Form, member: string): Asking {
  const kind = form.get('kind')
  if (kind === 'admit') {
    const shares = Number(form.get('shares'))
    if (!Number.isInteger(shares) || shares <= 0) {
      throw new Error(`“${form.get('shares')}” is not a whole number of shares`)
    }
    return { kind, args: { member, shares }, ...when(form) }
  }
  if (kind === 'suspend' || kind === 'exit' || kind === 'erase') {
    return { kind, args: { member }, ...when(form) }
  }
  throw new Error('choose what to propose')
}

// A proposal from a circle's page: to seat a member in it, in a role or as
// a plain member, or to end a seat held there, named by its position.
export async function appointing(form: Form, circle: string, db: Db): Promise<Asking> {
  const kind = form.get('kind')
  if (kind === 'seat') {
    const role = form.get('role')
    return { kind, args: { circle, member: form.get('member'), ...(role ? { role } : {}) }, ...when(form) }
  }
  if (kind === 'unseat') {
    const { rows } = await db.query<{ member: string; role: string | null }>(
      'SELECT member, role FROM circle_membership.position WHERE id::text = $1 AND circle = $2 AND until IS NULL',
      [form.get('seat'), circle],
    )
    if (!rows[0]) {
      throw new Error('choose a seat held in this circle')
    }
    return { kind, args: { circle, member: rows[0].member, ...(rows[0].role ? { role: rows[0].role } : {}) }, ...when(form) }
  }
  throw new Error('choose what to propose')
}
