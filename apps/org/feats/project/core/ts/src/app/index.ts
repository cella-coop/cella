import { icons, type App, type Tone } from '@cella/org-ui'
import type { Detail, Project, State } from '../models/project.ts'
import Archive from './blocks/Archive.svelte'
import Budget from './blocks/Budget.svelte'
import Create from './blocks/Create.svelte'
import Milestones from './blocks/Milestones.svelte'

const tones: Record<State, Tone> = { active: 'accent', done: 'positive' }

const progress = (p: Project) => (p.total ? `${p.completed} / ${p.total}` : 'none')

// The feat's client side: the projects as a gallery of cards, a new
// project, and a project's page, its summary under its title, its
// milestones and its budget in tabs of their own after its Overview; the
// grafts that join a project's tasks, time, expenses and invoices add
// theirs.
export const app: App = {
  name: 'project',
  collections: {
    projects: {
      view: {
        group: 'work',
        title: 'Projects',
        icon: icons.Briefcase,
        create: Create,
        columns: [
          { key: 'title', label: 'Project', kind: 'title', role: 'title', value: (p: Project) => p.title },
          { key: 'circle', label: 'Circle', kind: 'badge', role: 'sub', value: (p: Project) => p.circle },
          { key: 'progress', label: 'Milestones', role: 'meta', value: progress },
          { key: 'next', label: 'Next', role: 'hidden', value: (p: Project) => p.next },
          { key: 'budget', label: 'Budget', kind: 'money', role: 'meta', value: (p: Project) => p.budget },
          { key: 'started', label: 'Started', kind: 'date', role: 'hidden', value: (p: Project) => p.started },
          { key: 'due', label: 'Due', kind: 'date', role: 'hidden', value: (p: Project) => p.due },
          { key: 'state', label: 'State', kind: 'badge', role: 'meta', value: (p: Project) => p.state, tone: (p: Project) => tones[p.state] },
        ],
        look: { layout: 'gallery', cards: ['circle', 'progress', 'budget'], lanes: { state: ['active', 'done'] } },
      },
      page: {
        eyebrow: 'Project',
        title: (p: Detail) => p.title,
        subtitle: (p: Detail) => p.id,
        summary: (p: Detail) => p.summary,
        properties: (p: Detail) => [
          { label: 'State', value: p.archived ? 'archived' : p.state, kind: 'badge', tone: p.archived ? 'neutral' : tones[p.state] },
          { label: 'Circle', value: p.circle },
          { label: 'Milestones', value: progress(p) },
          { label: 'Next', value: p.next },
          { label: 'Budget', value: p.budget, kind: 'money' },
          { label: 'Started', value: p.started, kind: 'date' },
          { label: 'Due', value: p.due, kind: 'date' },
          ...(p.archived ? [{ label: 'Archived', value: p.archived, kind: 'date' as const }] : []),
        ],
        activity: (p: Detail) => [
          ...p.milestones.filter((m) => m.completed).map((m) => ({ at: m.completed ?? '', text: `completed ${m.title}` })),
          { at: p.started, text: 'started' },
        ],
        tabs: [
          { id: 'overview', label: 'Overview' },
          { id: 'milestones', label: 'Milestones' },
          { id: 'budget', label: 'Budget' },
        ],
        blocks: [
          { tab: 'milestones', block: Milestones },
          { tab: 'budget', block: Budget },
        ],
        actions: Archive,
      },
    },
  },
}
