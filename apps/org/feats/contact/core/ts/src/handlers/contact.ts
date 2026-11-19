import type { Outcome } from '@cella/org-actions'
import { erasure, personal, write, type Db, type Deps } from '@cella/org-db'
import { entering } from '@cella/org-person/api'
import type { actions } from '../models/actions.ts'
import type { Add, Archive, Changed, Erase, Erased, Fields, Update } from '../models/contact.ts'

type Action = keyof typeof actions

// The columns a write may set, in a fixed order; nothing else reaches SQL.
const columns = ['kind', 'name', 'form', 'email', 'phone', 'address', 'parent', 'tags', 'client', 'archived'] as const

// Those registered as personal data in `cella.personal`: the log commits
// to their values under fresh salts, and the vault keeps them.
const personals = new Set<string>(['name', 'email', 'phone', 'address'])

// What of a person contact is core person's, and none of the contact's.
const core = ['name', 'email', 'phone'] as const

const given = (fields: Fields) => columns.filter((c) => fields[c] !== undefined)

const value = (fields: Fields, c: (typeof columns)[number]) =>
  c === 'address' && fields.address ? JSON.stringify(fields.address) : fields[c]

// Sets the given fields. At rung 1 the server applies writes in receipt
// order, so the last write to a field wins it, field by field.
async function set(tx: Db, id: string, fields: Fields): Promise<Changed> {
  const names = given(fields)
  if (names.length) {
    const sets = names.map((c, i) => `${c} = $${i + 2}`).join(', ')
    const { rowCount } = await tx.query(`UPDATE contact.contact SET ${sets} WHERE id = $1`, [id, ...names.map((c) => value(fields, c))])
    if (!rowCount) {
      throw new Error(`no contact ${id}`)
    }
  }
  return { contact: id, fields: names }
}

// What the log commits to: the fields changed and their values, each
// personal one marked for the notary to commit to.
const changed = (fields: Fields) => (v: Changed) => ({
  ...v,
  fields: [...v.fields],
  values: Object.fromEntries(
    given(fields).map((c) => [c, personals.has(c) ? personal(`contact.contact.${c}`, v.contact, fields[c] ?? null) : (fields[c] ?? null)]),
  ),
})

// Adds a company with its own name, or a person, who is a core person by
// the address `person` names: one the coop knows already keeps their
// name, email and phone, and one new to it is brought in with those the
// write gives, in its transaction, its payload committing to them as
// core's. `contact.person_is_core` refuses a person naming no address.
export async function add(input: Add, deps: Deps): Promise<Outcome<(typeof actions)['contact:contact:add'], Changed>> {
  const { id, person, ...given } = input
  const fields: Fields = person ? Object.fromEntries(Object.entries(given).filter(([c]) => !(core as readonly string[]).includes(c))) : given
  // Whether the contact brought a new person in, so its payload commits
  // to what it gave them.
  let fresh = false
  return write(deps, {
    op: 'contact:contact:add' satisfies Action,
    request: input,
    state: async (tx) => {
      if (person) {
        fresh = (await entering(tx, { address: person, name: input.name, email: input.email, phone: input.phone })).new
      }
      await tx.query('INSERT INTO contact.contact (id, kind, person, name) VALUES ($1, $2, $3, $4)', [
        id,
        input.kind ?? 'company',
        person ?? null,
        person ? null : input.name,
      ])
      const out = await set(tx, id, fields)
      return person ? { ...out, fields: [...out.fields, 'person'] } : out
    },
    payload: (v) => {
      const logged = changed(fields)(v)
      if (!person) {
        return logged
      }
      return {
        ...logged,
        values: { ...logged.values, person },
        ...(fresh
          ? { entered: Object.fromEntries(core.map((c) => [c, personal(`person.person.${c}`, person, input[c] ?? null)])) }
          : {}),
      }
    },
  })
}

export async function update(input: Update, deps: Deps): Promise<Outcome<(typeof actions)['contact:contact:update'], Changed>> {
  return write(deps, {
    op: 'contact:contact:update' satisfies Action,
    request: input,
    state: (tx) => set(tx, input.id, input.fields),
    payload: changed(input.fields),
  })
}

// Hides the contact from lists; it stays for the books, and the invoices
// that name it are untouched.
export async function archive(input: Archive, deps: Deps): Promise<Outcome<(typeof actions)['contact:contact:archive'], Changed>> {
  const fields: Fields = { archived: true }
  return write(deps, {
    op: 'contact:contact:archive' satisfies Action,
    request: input,
    state: (tx) => set(tx, input.id, fields),
    payload: changed(fields),
  })
}

// Erases a person's contact data and archives them: the contact's own,
// and their core person's contact details with it. The notary deletes it
// from the vault and redacts it as the write settles, and refuses any
// later value for them. `contact.erases` refuses a company.
export async function erase(input: Erase, deps: Deps): Promise<Outcome<(typeof actions)['contact:contact:erase'], Erased>> {
  return write(deps, {
    op: 'contact:contact:erase' satisfies Action,
    request: input,
    state: async (tx) => {
      await set(tx, input.id, { archived: true })
      const { rows } = await tx.query<{ person: string | null }>('SELECT person FROM contact.contact WHERE id = $1', [input.id])
      return { contact: input.id, person: rows[0]?.person ?? null }
    },
    payload: (v) => ({
      contact: v.contact,
      erasure: erasure(v.contact, ['contact']),
      ...(v.person ? { details: erasure(v.person, ['contact']) } : {}),
    }),
  })
}
