import { icons, type App, type Tone } from '@cella/org-ui'
import { kinds, sized, type Class, type File, type Listed } from '../models/file.ts'
import Upload from './blocks/Upload.svelte'

const tones: Record<Class, Tone> = { none: 'neutral', 'expense-receipt': 'accent', payroll: 'warning', profile: 'positive' }

// The feat's client side: the files the co-op keeps, a file of its own
// uploaded from the list, and a file's page, opening its bytes.
export const app: App = {
  name: 'file',
  collections: {
    files: {
      view: {
        group: 'platform',
        // A file belongs to the record it is attached to, so it is no
        // stop in the sidebar; the command menu reaches the list.
        listed: false,
        title: 'Files',
        caption: 'What the co-op keeps on file: its own papers, receipts, employment and member records',
        icon: icons.Paperclip,
        create: Upload,
        columns: [
          { key: 'name', label: 'File', kind: 'title', role: 'title', value: (f: File) => f.name },
          { key: 'id', label: 'Id', kind: 'mono', role: 'sub', value: (f: File) => f.id },
          { key: 'class', label: 'Kind', kind: 'badge', role: 'meta', value: (f: Listed) => f.class, tone: (f: Listed) => tones[f.retention] },
          { key: 'size', label: 'Size', role: 'meta', value: (f: File) => sized(f.size) },
          { key: 'uploaded', label: 'Uploaded', kind: 'date', role: 'meta', value: (f: File) => f.uploaded },
          { key: 'type', label: 'Type', kind: 'mono', role: 'hidden', value: (f: File) => f.type },
          { key: 'uploader', label: 'By', kind: 'person', role: 'hidden', value: (f: File) => f.uploader },
        ],
        dashboard: [
          { kind: 'kpi', title: 'Files', measure: { op: 'count' } },
          { kind: 'chart', title: 'By kind', measure: { op: 'count' }, by: 'class' },
        ],
      },
      page: {
        eyebrow: 'File',
        title: (f: File) => f.name,
        subtitle: (f: File) => `${f.id}, ${kinds[f.class]}`,
        properties: (f: File) => [
          { label: 'Kind', value: kinds[f.class], kind: 'badge', tone: tones[f.class] },
          { label: 'Type', value: f.type, kind: 'mono' },
          { label: 'Size', value: sized(f.size) },
          { label: 'Uploaded', value: f.uploaded, kind: 'date' },
          { label: 'By', value: f.uploader, kind: 'person' },
          ...(f.subject ? [{ label: 'Concerns', value: f.subject, kind: 'person' as const }] : []),
          { label: 'BLAKE3', value: f.hash ?? 'erased', kind: 'mono' },
        ],
        related: (f: File) => (f.hash ? [{ label: 'Open', sub: f.name, href: `/files/${f.id}/content` }] : []),
        activity: (f: File) => [{ at: f.uploaded, text: 'uploaded', who: f.uploader }],
      },
    },
  },
}
