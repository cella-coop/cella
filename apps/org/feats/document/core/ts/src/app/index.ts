import { icons, short, type App } from '@cella/org-ui'
import type { Listed, Page } from '../models/document.ts'
import Comment from './blocks/Comment.svelte'
import Create from './blocks/Create.svelte'
import Draft from './blocks/Draft.svelte'
import History from './blocks/History.svelte'
import Save from './blocks/Save.svelte'

// The feat's client side: the documents, and a document's page with its
// draft in the block editor, saved as a version from its header, the
// comments on its versions under it, and its versions in a tab.
export const app: App = {
  name: 'document',
  collections: {
    documents: {
      view: {
        title: 'Documents',
        icon: icons.FileText,
        create: Create,
        columns: [
          { key: 'title', label: 'Document', kind: 'title', role: 'title', value: (d: Listed) => d.title },
          { key: 'id', label: 'Id', kind: 'mono', role: 'hidden', value: (d: Listed) => d.id },
          { key: 'circle', label: 'Circle', kind: 'circle', role: 'hidden', value: (d: Listed) => d.circle },
          { key: 'versions', label: 'Versions', kind: 'number', role: 'hidden', value: (d: Listed) => d.versions },
          { key: 'edited', label: 'Edited', kind: 'date', role: 'meta', value: (d: Listed) => d.edited },
          {
            key: 'adopted',
            label: 'Adopted',
            kind: 'badge',
            role: 'meta',
            value: (d: Listed) => d.adopted,
            tone: (d: Listed) => (d.adopted && d.adopted !== 'not adopted' ? 'positive' : 'neutral'),
          },
        ],
        // Each circle's own texts, the latest edited first.
        look: { by: 'circle', sort: { field: 'edited', dir: 'desc' } },
      },
      page: {
        eyebrow: 'Document',
        title: (d: Page) => d.title,
        subtitle: (d: Page) => d.id,
        properties: (d: Page) => [
          { label: 'Adopted', value: d.adopted ?? 'not adopted', kind: 'badge', tone: d.adopted ? 'positive' : 'neutral' },
          { label: 'Versions', value: d.versions.length, kind: 'number' },
          { label: 'Updates', value: d.updates.length, kind: 'number' },
          { label: 'Comments', value: d.comments.length, kind: 'number' },
          { label: 'Draft hash', value: short(d.hash, 16), kind: 'mono' },
        ],
        activity: (d: Page) => [
          ...d.comments.map((c) => ({ at: c.at, who: c.author, text: `commented on ${c.version}${c.quote ? `, quoting “${c.quote}”` : ''}${c.resolved ? ', resolved' : ''}`, body: c.text })),
          ...d.updates.slice(0, 12).map((u) => ({ at: u.at, who: u.author ?? undefined, text: `${u.author ? 'edited' : 'carried over'}, receipt ${u.receipt}` })),
        ],
        // The draft is the content; its saved versions, the data central to
        // it, a tab after it.
        tabs: [
          { id: 'draft', label: 'Draft' },
          { id: 'versions', label: 'Versions' },
        ],
        blocks: [Draft, { tab: 'versions', block: History }],
        comment: Comment,
        actions: Save,
      },
    },
  },
}
