import { icons, recordIcon, recordIcons, type App, type Tone } from '@cella/org-ui'
import type { Detail, Project, State } from '../models/project.ts'
import Archive from './blocks/Archive.svelte'
import Budget from './blocks/Budget.svelte'
import Create from './blocks/Create.svelte'
import Milestones from './blocks/Milestones.svelte'
import { Body } from '@cella/org-body/app'
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
        // A board by state, a swimlane for each circle, the soonest due
        // first (the operator, 20 Nov).
        look: { layout: 'board', columns: 'state', by: 'circle', sort: { field: 'due', dir: 'asc' }, cards: ['progress', 'due'], lanes: { state: ['active', 'done'] } },
      },
      page: {
        comment: Comments,
        eyebrow: 'Project',
        title: (p: Detail) => p.title,
        subtitle: (p: Detail) => p.id,
        summary: (p: Detail) => p.summary,
        // Its state, its circle, its client and crew (the grafts'), then
        // its dates, each placed by its kind; Created, Updated and by whom
        // sit in their own History at the drawer's foot instead, kept off
        // this page's crowded top (`history: false`, below).
        properties: (p: Detail) => [
          // Its own icon, a cosmetic setting, picked in its popover.
          { label: 'Icon', value: recordIcons.find((i) => i.slug === p.icon)?.name ?? null, icon: recordIcon(p.icon), ink: p.title, edit: { kind: 'icon' as const, write: 'icon', field: 'icon', current: p.icon } },
          { label: 'State', value: p.archived ? 'archived' : p.state, kind: 'badge', tone: p.archived ? 'neutral' : tones[p.state] },
          { label: 'Next', value: p.next, glyph: icons.ArrowRight, lead: 'next' },
          { label: 'Circle', value: p.circle, kind: 'circle' as const },
          { label: 'Started', value: p.started, kind: 'date' },
          { label: 'Due', value: p.due, kind: 'date' },
          ...(p.archived ? [{ label: 'Archived', value: p.archived, kind: 'date' as const }] : []),
        ],
        // Its budget, set on its Budget tab, and its progress where it has
        // milestones, before what the grafts spend of it.
        figures: (p: Detail) => [
          { label: 'Budget', value: p.budget, kind: 'money' },
          ...(p.total ? [{ label: 'Milestones', value: progress(p) }] : []),
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
        layout: 'body',
        body: Body,
        blocks: [
          { tab: 'milestones', block: Milestones },
          { tab: 'budget', block: Budget },
        ],
        actions: Archive,
      },
    },
  },
}
