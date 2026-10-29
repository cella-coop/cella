// The feat's public writes, POST /api/bill/<op> once the server exists,
// the write specs and form readers a graft composes, its reads, and its
// slice, which the shell mounts.
import { action, type Slice } from '@cella/org-db'
import { approve, pay, record } from '../handlers/index.ts'
import { bill, bills, listing, offered } from '../drivers/bill.ts'
import * as forms from './forms.ts'

export { approve, approving, pay, paying, record, recording } from '../handlers/index.ts'
export { bill, bills } from '../drivers/bill.ts'
export * as forms from './forms.ts'

// The bills, a new one recorded, and on a bill's page approving and paying
// it. A graft that posts a bill to the books replaces approve and pay with
// its own, which run these in the same transaction.
export const slice: Slice = {
  name: 'bill',
  collections: {
    bills: {
      list: listing,
      about: offered,
      item: bill,
      index: async (db) => (await bills(db)).map((b) => ({ id: b.id, title: `${b.supplier}, ${b.reference}`, sub: `${b.id}, ${b.label}` })),
      actions: {
        record: action('bill:bill:record', (form) => forms.record(form), record),
        approve: action('bill:bill:approve', (_, id) => forms.act(id ?? ''), approve),
        pay: action('bill:bill:pay', (_, id) => forms.act(id ?? ''), pay),
      },
    },
  },
}
