// The graft's write, POST /api/document-membership/<op> once the server
// exists, its reads, and its slice, which the shell mounts.
import { action, type Slice } from '@cella/org-db'
import { read } from '../handlers/read.ts'
import { texts } from '../drivers/texts.ts'

export { read } from '../handlers/read.ts'
export { texts } from '../drivers/texts.ts'

// On a member's page, the texts the coop adopted and whether they read
// each, and marking one read, their own.
export const slice: Slice = {
  name: 'document-membership',
  extends: {
    people: {
      item: texts,
      actions: {
        read: action('document-membership:version:read', (form, id) => ({ member: id ?? '', version: form.get('version') }), read),
      },
    },
  },
}
