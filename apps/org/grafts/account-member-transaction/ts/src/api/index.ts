// The graft's writes, reads and slice, which the shell mounts: a member's
// draws and their capital in the books, on their page, and drawing from
// there; what a worker's part of the work share became, on their
// statement; and a year's return to the federation, on the allocation's
// page. Subscribing on admission and employing the work share in shares
// on allocation are this graft's triggers, in the writes that admit and
// allocate.
import { action, type Form, type Slice } from '@cella/org-db'
import { draw } from '../handlers/draw.ts'
import { account } from '../drivers/draw.ts'
import { employed, figures } from '../drivers/patronage.ts'

export { draw } from '../handlers/draw.ts'
export { account } from '../drivers/draw.ts'
export { employed, figures } from '../drivers/patronage.ts'
export type { Employed, Figure, Movement } from '../models/patronage.ts'

// Euros as typed, a comma or a point, into whole cents.
export function cents(typed: string): number {
  const n = Number(typed.trim().replace(',', '.'))
  if (!typed.trim() || !Number.isFinite(n) || n <= 0) {
    throw new Error(`“${typed}” is not an amount in euros`)
  }
  return Math.round(n * 100)
}

const drawing = (form: Form, member: string | undefined) => {
  if (!member) {
    throw new Error('a draw is on a member’s account')
  }
  return { member, cents: cents(form.get('amount')) }
}

export const slice: Slice = {
  name: 'account-member-transaction',
  extends: {
    members: {
      item: account,
      actions: {
        draw: action('account:account:draw', (form, id) => drawing(form, id), draw),
      },
    },
    statements: { item: employed },
    allocations: { item: figures },
  },
}
