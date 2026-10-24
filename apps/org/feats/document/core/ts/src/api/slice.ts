import { action, type Slice } from '@cella/org-db'
import { comment, edit, rewrite, version } from '../handlers/index.ts'
import { document, documents } from '../drivers/document.ts'

// The feat's server side as the shell mounts it: the documents, an edit of
// the draft as a plain text area writes it, saving a version, and a
// comment on one.
export const slice: Slice = {
  name: 'document',
  collections: {
    documents: {
      list: documents,
      item: document,
      index: async (db) => (await documents(db)).map((d) => ({ id: d.id, title: d.title, sub: d.adopted ?? 'not adopted' })),
      actions: {
        edit: action(
          'document:document:edit',
          async (form, id, deps) => ({ document: id ?? '', update: await rewrite(deps.db, id ?? '', form.get('text')) }),
          edit,
        ),
        version: action('document:document:version', (_, id) => ({ document: id ?? '' }), version),
        comment: action(
          'document:document:comment',
          (form) => ({ version: form.get('version'), quote: form.get('quote'), text: form.get('text') }),
          comment,
        ),
      },
    },
  },
}
