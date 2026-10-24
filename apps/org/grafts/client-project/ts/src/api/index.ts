// The graft's writes, POST /api/client-project/<op> once the server
// exists, its reads, and its slice, which the shell mounts.
import { action, type Slice } from '@cella/org-db'
import { link } from '../handlers/link.ts'
import { clientOf, commissioned, commissioner } from '../drivers/commission.ts'

export { link } from '../handlers/link.ts'
export { clientOf, commissioned, commissioner } from '../drivers/commission.ts'

// Whom a project is for, and linking it; the projects a client
// commissioned.
export const slice: Slice = {
  name: 'client-project',
  extends: {
    projects: {
      list: clientOf,
      item: commissioner,
      actions: {
        link: action('client-project:project:link', (form, id) => ({ project: id ?? '', client: form.get('client') }), link),
      },
    },
    clients: {
      item: commissioned,
    },
  },
}
