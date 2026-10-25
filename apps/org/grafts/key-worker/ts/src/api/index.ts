// The graft's write, its reads and its slice, which the shell mounts: the
// hire that carries a first device, replacing the worker feat's, and on a
// worker's page every device enrolled under their address.
import { action, type Slice } from '@cella/org-db'
import { devices } from '@cella/org-key/api'
import { hired } from '@cella/org-worker/api'
import { hire } from '../handlers/hire.ts'

export { hire } from '../handlers/hire.ts'

export const slice: Slice = {
  name: 'key-worker',
  extends: {
    workers: {
      item: async (db, worker) => ({ devices: await devices(db, worker) }),
      actions: {
        hire: action('worker:worker:hire', (form) => ({ ...hired(form), key: form.get('key'), label: form.get('label').trim() }), hire),
      },
    },
  },
}
