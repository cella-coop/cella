import type { Outcome } from '@cella/org-ops'
import { write, type Db, type Deps } from '@cella/org-db'
import type { ops } from '../models/ops.ts'
import type { Add, Archive, Changed, Fields, Update } from '../models/client.ts'

type Op = keyof typeof ops

// The columns a write may set, in a fixed order; nothing else reaches SQL.
const columns = ['kind', 'name', 'form', 'email', 'phone', 'address', 'parent', 'tags', 'note', 'status'] as const

const given = (fields: Fields) => columns.filter((c) => fields[c] !== undefined)

const value = (fields: Fields, c: (typeof columns)[number]) =>
  c === 'address' && fields.address ? JSON.stringify(fields.address) : fields[c]

// Sets the given fields. At rung 1 the server applies writes in receipt
// order, so the last write to a field wins it, field by field.
async function set(tx: Db, id: string, fields: Fields): Promise<Changed> {
  const names = given(fields)
  if (names.length) {
    const sets = names.map((c, i) => `${c} = $${i + 2}`).join(', ')
    const { rowCount } = await tx.query(`UPDATE client.client SET ${sets} WHERE id = $1`, [id, ...names.map((c) => value(fields, c))])
    if (!rowCount) {
      throw new Error(`no client ${id}`)
    }
  }
  return { client: id, fields: names }
}

const changed = (v: Changed) => ({ ...v, fields: [...v.fields] })

export async function add(input: Add, deps: Deps): Promise<Outcome<(typeof ops)['client:client:add'], Changed>> {
  return write(deps, {
    op: 'client:client:add' satisfies Op,
    state: async (tx) => {
      await tx.query('INSERT INTO client.client (id, name) VALUES ($1, $2)', [input.id, input.name])
      const { id, ...fields } = input
      return set(tx, id, fields)
    },
    payload: changed,
  })
}

export async function update(input: Update, deps: Deps): Promise<Outcome<(typeof ops)['client:client:update'], Changed>> {
  return write(deps, {
    op: 'client:client:update' satisfies Op,
    state: (tx) => set(tx, input.id, input.fields),
    payload: changed,
  })
}

// Hides the client from lists; it stays for the books, and the invoices
// that name it are untouched.
export async function archive(input: Archive, deps: Deps): Promise<Outcome<(typeof ops)['client:client:archive'], Changed>> {
  return write(deps, {
    op: 'client:client:archive' satisfies Op,
    state: (tx) => set(tx, input.id, { status: 'archived' }),
    payload: changed,
  })
}
