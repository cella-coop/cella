import { icons, type App, type Tone } from '@cella/org-ui'
import { kinds, sized, type Class, type File, type Listed } from '../models/file.ts'
import Upload from './blocks/Upload.svelte'
import Kept from './blocks/Kept.svelte'
import { Body } from '@cella/org-body/app'

const tones: Record<Class, Tone> = { none: 'neutral', 'expense-receipt': 'accent', payroll: 'warning', profile: 'positive' }

// The feat's client side: the files the coop keeps, a file of its own
// uploaded from the list, and a file's page, which opens on the file and
// opening its bytes, then its notes.
export const app: App = {
  name: 'file',
  collections: {
    files: {
      view: {
        group: 'platform',
        subgroup: 'Organization',
        // A file belongs to the record it is attached to, so it is no
        // stop in the sidebar; the command menu reaches the list.
        listed: false,
        title: 'Files',
        caption: 'What the coop keeps on file: its own papers, receipts, employment and member records',
        icon: icons.Paperclip,
        create: Upload,
        columns: [
          { key: 'name', label: 'File', kind: 'title', role: 'title', value: (f: File) => f.name },
          { key: 'id', label: 'Id', kind: 'mono', role: 'hidden', value: (f: File) => f.id },
          { key: 'uploader', label: 'By', kind: 'person', role: 'sub', value: (f: File) => f.uploader },
          { key: 'class', label: 'Kind', kind: 'badge', role: 'meta', value: (f: Listed) => f.class, tone: (f: Listed) => tones[f.retention] },
          { key: 'size', label: 'Size', role: 'meta', value: (f: File) => sized(f.size) },
          { key: 'uploaded', label: 'Uploaded', kind: 'date', role: 'meta', value: (f: File) => f.uploaded },
          { key: 'type', label: 'Type', kind: 'mono', role: 'hidden', value: (f: File) => f.type },
          { key: 'subject', label: 'Concerns', kind: 'person', role: 'hidden', of: 'people', value: (f: File) => f.subject },
        ],
        // By kind, the latest uploaded first.
        look: { by: 'class', sort: { field: 'uploaded', dir: 'desc' }, lanes: { class: ['expense-receipt', 'payroll', 'profile', 'none'] } },
      },
      page: {
        layout: 'panels',
        body: Body,
        blocks: [Kept],
        eyebrow: 'File',
        title: (f: File) => f.name,
        subtitle: (f: File) => `${f.id}, ${kinds[f.class]}`,
        properties: (f: File) => [
          { label: 'Kind', value: kinds[f.class], kind: 'badge', tone: tones[f.class] },
          { label: 'Type', value: f.type, kind: 'mono', glyph: icons.FileText },
          { label: 'Uploaded', value: f.uploaded, kind: 'date' },
          { label: 'By', value: f.uploader, kind: 'person', lead: 'by' },
          ...(f.subject ? [{ label: 'Concerns', value: f.subject, kind: 'person' as const, lead: 'concerns' }] : []),
          { label: 'BLAKE3', value: f.hash ?? 'erased', kind: 'mono', glyph: icons.Fingerprint, lead: 'blake3' },
        ],
        related: (f: File) => (f.hash ? [{ label: 'Open', sub: f.name, href: `/files/${f.id}/content` }] : []),
        activity: (f: File) => [{ at: f.uploaded, text: 'uploaded', who: f.uploader }],
      },
    },
  },
}
