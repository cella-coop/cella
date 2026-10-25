import { icons, short, type App } from '@cella/org-ui'
import type { Listed, Page } from '../models/document.ts'
import Create from './blocks/Create.svelte'
import Draft from './blocks/Draft.svelte'
import History from './blocks/History.svelte'
import Save from './blocks/Save.svelte'

// The feat's client side: the documents, and a document's page with its
// draft in the block editor, saved as a version from its header, its
// versions and the comments on them.
export const app: App = {
  name: 'document',
  collections: {
    documents: {
      view: {
        group: 'governance',
        title: 'Documents',
        icon: icons.FileText,
        create: Create,
        columns: [
          { key: 'title', label: 'Document', kind: 'title', role: 'title', value: (d: Listed) => d.title },
          { key: 'id', label: 'Id', kind: 'mono', role: 'sub', value: (d: Listed) => d.id },
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
        activity: (d: Page) =>
          d.updates.slice(0, 12).map((u) => ({ at: u.at, who: u.author ?? undefined, text: `${u.author ? 'edited' : 'carried over'}, receipt ${u.receipt}` })),
        blocks: [Draft, History],
        actions: Save,
      },
    },
  },
}

// A document read, not edited, from its canonical form: a version on the
// page of the decision that adopts it.
export { default as Reader } from '../components/Reader.svelte'
