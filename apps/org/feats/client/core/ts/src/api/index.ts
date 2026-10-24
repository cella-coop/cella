// The feat's public writes, POST /api/client/<op> once the server exists,
// its reads, and its slice, which the shell mounts.
import { action, type Slice } from '@cella/org-db'
import { update } from '../handlers/index.ts'
import { client, clients } from '../drivers/client.ts'

export { add, archive, update } from '../handlers/index.ts'
export { client, clients } from '../drivers/client.ts'

export const slice: Slice = {
  name: 'client',
  collections: {
    clients: {
      list: clients,
      item: client,
      index: async (db) => (await clients(db)).map((c) => ({ id: c.id, title: c.name, sub: c.form ?? c.kind })),
      actions: {
        note: action('client:client:update', (form, id) => ({ id: id ?? '', fields: { note: form.get('note') } }), update),
      },
    },
  },
}
