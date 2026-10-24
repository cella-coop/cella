import type { Action, Collection, Extension, Reaction, Slice } from '@cella/org-db'
import type { Permission } from '@cella/org-ops'
import { slice as log } from '@cella/org-log/api'
import { devices, slice as key } from '@cella/org-key/api'
import { slice as member } from '@cella/org-member/api'
import { slice as circle } from '@cella/org-circle/api'
import { slice as decision } from '@cella/org-decision/api'
import { slice as document } from '@cella/org-document/api'
import { slice as client } from '@cella/org-client/api'
import { slice as invoice } from '@cella/org-invoice/api'
import { slice as account } from '@cella/org-account/api'
import { slice as transaction } from '@cella/org-transaction/api'
import { slice as circleMember } from '@cella/org-graft-circle-member/api'
import { slice as circleDecisionMember } from '@cella/org-graft-circle-decision-member/api'
import { slice as decisionMember } from '@cella/org-graft-decision-member/api'
import { slice as decisionDocument } from '@cella/org-graft-decision-document/api'
import { slice as clientInvoice } from '@cella/org-graft-client-invoice/api'
import { slice as invoiceTransaction } from '@cella/org-graft-invoice-transaction/api'
import { slice as accountTransaction } from '@cella/org-graft-account-transaction/api'

// The server sides the shell mounts: each feat's collections, each graft's
// extensions of the feats it joins, and the root's own, which joins feats
// no graft joins, such as a member's devices.
const root: Slice = {
  name: 'org',
  extends: {
    members: { item: (db, address) => devices(db, address) },
  },
}

export const slices: Slice[] = [
  member,
  circle,
  decision,
  document,
  client,
  invoice,
  account,
  transaction,
  key,
  log,
  circleMember,
  circleDecisionMember,
  decisionMember,
  decisionDocument,
  clientInvoice,
  invoiceTransaction,
  accountTransaction,
  root,
]

export interface Mounted {
  owner: Slice
  collection: Collection
  extensions: { slice: Slice; extension: Extension }[]
}

const collections = new Map<string, Mounted>()
for (const s of slices) {
  for (const [name, collection] of Object.entries(s.collections ?? {})) {
    if (collections.has(name)) {
      throw new Error(`${s.name} and ${collections.get(name)?.owner.name} both own the collection ${name}`)
    }
    collections.set(name, { owner: s, collection, extensions: [] })
  }
}

// A graft extends only the collections of the feats it joins; the root
// may join any.
for (const s of slices) {
  for (const [name, extension] of Object.entries(s.extends ?? {})) {
    const mounted = collections.get(name)
    if (!mounted) {
      throw new Error(`${s.name} extends ${name}, which no slice owns`)
    }
    if (s !== root && !s.name.split('-').includes(mounted.owner.name)) {
      throw new Error(`${s.name} extends ${name}, ${mounted.owner.name}'s, which it does not join`)
    }
    for (const write of Object.keys(extension.actions ?? {})) {
      const other = mounted.extensions.find((e) => e.extension.actions?.[write])
      if (other) {
        throw new Error(`${s.name} and ${other.slice.name} both replace ${name}'s write ${write}`)
      }
    }
    mounted.extensions.push({ slice: s, extension })
  }
}

export const mounted = (name: string) => collections.get(name)

// A write the collection's pages offer: an extension's, which replaces
// the owner's of the same name, as a graft that posts an invoice's issue
// replaces the invoice feat's issue; else the owner's.
export function action(name: string, write: string): Action | undefined {
  const m = collections.get(name)
  if (!m) {
    return undefined
  }
  return m.extensions.map((e) => e.extension.actions?.[write]).find((a) => a) ?? m.collection.actions?.[write]
}

// Every action name, for the routes' action tables.
export const writes = [
  ...new Set(
    [...collections.values()].flatMap((m) => [
      ...Object.keys(m.collection.actions ?? {}),
      ...m.extensions.flatMap((e) => Object.keys(e.extension.actions ?? {})),
    ]),
  ),
]

// The reactions to a settled op, from every slice.
export const reactions = (op: Permission): Reaction[] => slices.flatMap((s) => s.on?.[op] ?? [])
