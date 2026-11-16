import { icons, type App, type Tone } from '@cella/org-ui'
import type { Detail, Project, State } from '../models/project.ts'
import Archive from './blocks/Archive.svelte'
import Budget from './blocks/Budget.svelte'
import Create from './blocks/Create.svelte'
import Milestones from './blocks/Milestones.svelte'
import Body from './blocks/Body.svelte'
import Comments from './blocks/Comments.svelte'

const tones: Record<State, Tone> = { active: 'accent', done: 'positive' }

const progress = (p: Project) => (p.total ? `${p.completed} / ${p.total}` : 'none')

// The feat's client side: the projects as a gallery of cards, a new
// project, and a project's page, its summary under its title, and after
// its Overview three tabs: its Tasks, which the graft joining tasks
// fills; its Milestones; and its Budget, beside which the grafts joining
// time, expenses, invoices and members' shares set what each spends of it.
export const app: App = {
  name: 'project',
  collections: {
    projects: {
      view: {
        title: 'Projects',
        icon: icons.Briefcase,
        create: Create,
        columns: [
          { key: 'title', label: 'Project', kind: 'title', role: 'title', value: (p: Project) => p.title },
          { key: 'circle', label: 'Circle', kind: 'circle', role: 'sub', record: 'circles', value: (p: Project) => p.circle },
          { key: 'progress', label: 'Milestones', role: 'meta', value: progress },
          { key: 'next', label: 'Next', role: 'hidden', value: (p: Project) => p.next },
          { key: 'budget', label: 'Budget', kind: 'money', role: 'hidden', value: (p: Project) => p.budget },
          { key: 'started', label: 'Started', kind: 'date', role: 'hidden', value: (p: Project) => p.started },
          { key: 'state', label: 'State', kind: 'badge', role: 'meta', value: (p: Project) => p.state, tone: (p: Project) => tones[p.state] },
          { key: 'due', label: 'Due', kind: 'date', role: 'meta', value: (p: Project) => p.due },
        ],
        // As Linear lists its projects: by circle, the soonest due first.
        look: { layout: 'list', by: 'circle', sort: { field: 'due', dir: 'asc' }, cards: ['circle', 'progress', 'budget'], lanes: { state: ['active', 'done'] } },
      },
      page: {
        comment: Comments,
        eyebrow: 'Project',
        title: (p: Detail) => p.title,
        subtitle: (p: Detail) => p.id,
        summary: (p: Detail) => p.summary,
        // On top, grouped: its state and progress, its circle, its lead
        // and crew (the membership-project graft's), then its dates and
        // its money; Created, Updated and by whom sit in their own
        // History at the drawer's foot instead, kept off this page's
        // crowded top (`history: false`, below).
        properties: (p: Detail) => [
          { label: 'State', value: p.archived ? 'archived' : p.state, kind: 'badge', tone: p.archived ? 'neutral' : tones[p.state], group: 'State' },
          { label: 'Milestones', value: progress(p), group: 'State' },
          { label: 'Next', value: p.next, group: 'State' },
          { label: 'Circle', value: p.circle, group: 'Circle' },
          { label: 'Started', value: p.started, kind: 'date', group: 'Dates' },
          { label: 'Due', value: p.due, kind: 'date', group: 'Dates' },
          ...(p.archived ? [{ label: 'Archived', value: p.archived, kind: 'date' as const, group: 'Dates' }] : []),
          { label: 'Budget', value: p.budget, kind: 'money', group: 'Money' },
        ],
        history: false,
        activity: (p: Detail) => [
          ...p.milestones.filter((m) => m.completed).map((m) => ({ at: m.completed ?? '', text: `completed ${m.title}` })),
          { at: p.started, text: 'started' },
        ],
        tabs: [
          { id: 'overview', label: 'Overview' },
          { id: 'tasks', label: 'Tasks' },
          { id: 'milestones', label: 'Milestones' },
          { id: 'budget', label: 'Budget' },
        ],
        blocks: [
          Body,
          { tab: 'milestones', block: Milestones },
          { tab: 'budget', block: Budget },
        ],
        actions: Archive,
      },
    },
  },
}
