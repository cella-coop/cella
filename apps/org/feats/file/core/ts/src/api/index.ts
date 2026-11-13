// The feat's public write, the spec a graft composes to store a file in
// its own write, its reads, and its slice, which the shell mounts.
import { action, type Slice } from '@cella/org-db'
import { upload } from '../handlers/index.ts'
import { content, file, files, listing } from '../drivers/file.ts'
import * as forms from './forms.ts'
import { contract } from './contract.ts'

export { committed, request, storing, upload, uploading } from '../handlers/index.ts'
export { content, file, files } from '../drivers/file.ts'
export * as forms from './forms.ts'

// The files the co-op keeps, each one's bytes for whoever may open them,
// and a file of the co-op's own uploaded from the collection's page.
export const slice: Slice = {
  name: 'file',
  queries: contract,
  collections: {
    files: {
      list: listing,
      item: file,
      content,
      index: async (db) => (await files(db)).map((f) => ({ id: f.id, title: f.name, sub: `${f.id}, ${f.type}` })),
      actions: {
        upload: action('file:file:upload', (form) => forms.store(form, 'file', 'none', null), upload),
      },
    },
  },
}
