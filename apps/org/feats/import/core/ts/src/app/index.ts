import { icons, type App } from '@cella/org-ui'
import type { Listed, Run } from '../models/run.ts'
import Create from './blocks/Create.svelte'
import Lines from './blocks/Lines.svelte'
import { Body } from '@cella/org-body/app'

// The feat's client side: the imports made, a file imported or tried in a
// dry run from the list, and each import's page, which opens on its lines,
// then its notes.
export const app: App = {
  name: 'import',
  collections: {
    imports: {
      view: {
        group: 'platform',
        subgroup: 'Organization',
        title: 'Imports',
        caption: 'Members, contacts, the books, invoices, time, projects and tasks brought in from other tools',
        icon: icons.FileArrowUp,
        create: Create,
        columns: [
          { key: 'name', label: 'File', kind: 'title', role: 'title', value: (r: Listed) => r.name },
          { key: 'id', label: 'Id', kind: 'mono', role: 'hidden', value: (r: Listed) => r.id },
          { key: 'kind', label: 'Kind', kind: 'badge', role: 'meta', value: (r: Listed) => r.kind },
          { key: 'dry', label: 'Run', kind: 'badge', role: 'meta', value: (r: Listed) => r.dry, tone: (r: Listed) => (r.dry === 'dry run' ? 'neutral' : 'positive') },
          { key: 'settled', label: 'Settled', kind: 'number', role: 'meta', value: (r: Listed) => r.settled },
          { key: 'refused', label: 'Refused', kind: 'number', role: 'meta', value: (r: Listed) => r.refused, tone: (r: Listed) => (r.refused ? 'negative' : 'neutral') },
          { key: 'day', label: 'On', kind: 'date', role: 'meta', value: (r: Listed) => r.day },
          { key: 'actor', label: 'By', kind: 'person', role: 'hidden', value: (r: Listed) => r.actor },
        ],
        // By kind, the latest first.
        look: { by: 'kind', sort: { field: 'day', dir: 'desc' } },
        empty: 'Nothing imported yet. Bring in a file from another tool with New, a dry run first.',
      },
      page: {
        eyebrow: 'Import',
        title: (r: Run) => r.name,
        subtitle: (r: Run) => `${r.id}, ${r.kind}, ${r.dry ? 'a dry run' : 'imported'}`,
        // What it imported is its reference's.
        properties: (r: Run) => [
          { label: 'Run', value: r.dry ? 'dry run, undone' : 'imported', kind: 'badge', tone: r.dry ? 'neutral' : 'positive' },
          { label: 'On', value: r.day, kind: 'date', lead: r.dry ? 'tried' : 'imported' },
          { label: 'By', value: r.actor, kind: 'person', lead: 'by' },
        ],
        activity: (r: Run) => [{ at: r.day, text: r.dry ? 'tried in a dry run' : 'imported', who: r.actor }],
        layout: 'panels',
        body: Body,
        blocks: [Lines],
      },
    },
  },
}
