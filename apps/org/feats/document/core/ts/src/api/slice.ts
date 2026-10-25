import { action, type Deps, type Slice } from '@cella/org-db'
import { comment, create, edit, version } from '../handlers/index.ts'
import { document, documents, listing } from '../drivers/document.ts'
import { b64, type Edit } from '../models/document.ts'
import { live, publish } from './live.ts'

// An edit, and once it settles, its update relayed to everyone with the
// document open.
async function relayed(input: Edit, deps: Deps) {
  const out = await edit(input, deps)
  if (out.state === 'settled') {
    publish(input.document, out.value.receipt, input.update)
  }
  return out
}

// The feat's server side as the shell mounts it: the documents, a new
// one, an edit as the editor posts it (a Loro update, in base64), saving
// a version, a comment on one, and the live stream of a document's edits.
export const slice: Slice = {
  name: 'document',
  collections: {
    documents: {
      list: listing,
      item: document,
      index: async (db) => (await documents(db)).map((d) => ({ id: d.id, title: d.title, sub: d.adopted ?? 'not adopted' })),
      actions: {
        create: action('document:document:create', (form) => ({ title: form.get('title') }), create),
        edit: action('document:document:edit', (form, id) => ({ document: id ?? '', update: b64.decode(form.get('update')) }), relayed),
        version: action('document:document:version', (_, id) => ({ document: id ?? '' }), version),
        comment: action(
          'document:document:comment',
          (form) => ({ version: form.get('version'), quote: form.get('quote'), text: form.get('text') }),
          comment,
        ),
      },
      streams: { live },
    },
  },
}
