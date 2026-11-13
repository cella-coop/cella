// The graft's writes, POST /api/contact-project/<op> once the server
// exists, its reads, and its slice, which the shell mounts.
import { action, type Slice } from '@cella/org-db'
import { link } from '../handlers/link.ts'
import { contactOf, commissioned, commissioner } from '../drivers/commission.ts'
import { contract } from './contract.ts'

export { link } from '../handlers/link.ts'
export { contactOf, commissioned, commissioner } from '../drivers/commission.ts'

// Whom a project is for, and linking it; the projects a contact
// commissioned.
export const slice: Slice = {
  name: 'contact-project',
  queries: contract,
  extends: {
    projects: {
      list: contactOf,
      item: commissioner,
      actions: {
        link: action('contact-project:project:link', (form, id) => ({ project: id ?? '', contact: form.get('contact') }), link),
      },
    },
    contacts: {
      item: commissioned,
    },
  },
}
