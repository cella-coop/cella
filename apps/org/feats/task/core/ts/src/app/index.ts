import { icons, type App, type Tone } from '@cella/org-ui'
import { priorities, statuses, type Priority, type Status as Stage, type Task } from '../models/task.ts'
import Create from './blocks/Create.svelte'
import Status from './blocks/Status.svelte'

const tones: Record<Stage, Tone> = { backlog: 'neutral', todo: 'accent', doing: 'warning', done: 'positive' }
const urgency: Record<Priority, Tone> = { urgent: 'negative', high: 'warning', normal: 'neutral', low: 'neutral' }

// The feat's client side: the tasks as a board by status, on which a card
// dragged between columns is the move, or into Done the completion; a new
// task; and a task's page with its status.
export const app: App = {
  name: 'task',
  collections: {
    tasks: {
      view: {
        group: 'work',
        title: 'Tasks',
        icon: icons.CheckSquare,
        create: Create,
        columns: [
          { key: 'title', label: 'Task', kind: 'title', role: 'title', value: (t: Task) => t.title },
          { key: 'id', label: 'Id', kind: 'mono', role: 'sub', value: (t: Task) => t.id },
          { key: 'priority', label: 'Priority', kind: 'badge', role: 'meta', value: (t: Task) => t.priority, tone: (t: Task) => urgency[t.priority] },
          { key: 'due', label: 'Due', kind: 'date', role: 'meta', value: (t: Task) => t.due },
          { key: 'status', label: 'Status', kind: 'badge', role: 'meta', value: (t: Task) => t.status, tone: (t: Task) => tones[t.status] },
          { key: 'created', label: 'Created', kind: 'date', role: 'hidden', value: (t: Task) => t.created },
          { key: 'completed', label: 'Completed', kind: 'date', role: 'hidden', value: (t: Task) => t.completed },
        ],
        look: { layout: 'board', by: 'status', lanes: { status: [...statuses], priority: [...priorities] }, cards: ['priority', 'due'] },
        shifts: [
          { by: 'status', to: ['backlog', 'todo', 'doing'], action: 'move' },
          { by: 'status', to: ['done'], action: 'complete' },
        ],
      },
      page: {
        eyebrow: 'Task',
        title: (t: Task) => t.title,
        subtitle: (t: Task) => t.id,
        properties: (t: Task) => [
          { label: 'Status', value: t.status, kind: 'badge', tone: tones[t.status] },
          { label: 'Priority', value: t.priority, kind: 'badge', tone: urgency[t.priority] },
          { label: 'Due', value: t.due, kind: 'date' },
          { label: 'Created', value: t.created, kind: 'date' },
          { label: 'Completed', value: t.completed, kind: 'date' },
        ],
        activity: (t: Task) => [...(t.completed ? [{ at: t.completed, text: 'completed' }] : []), { at: t.created, text: 'created' }],
        actions: Status,
      },
    },
  },
}
