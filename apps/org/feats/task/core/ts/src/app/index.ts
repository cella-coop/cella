import { icons, type App, type Tone } from '@cella/org-ui'
import { priorities, statuses, type Page, type Priority, type Status as Stage, type Task } from '../models/task.ts'
import Body from './blocks/Body.svelte'
import Comments from './blocks/Comments.svelte'
import Create from './blocks/Create.svelte'
import Complete from './blocks/Complete.svelte'

const tones: Record<Stage, Tone> = { backlog: 'neutral', todo: 'neutral', doing: 'accent', done: 'positive' }

// The feat's client side: the tasks as a board by status, on which a card
// dragged between columns is the move, or into Done the completion; a new
// task; and a task's page with its status in its header, its body in
// its content, edited live over core body's session, its threads under
// its Activity, and no tab of its own.
export const app: App = {
  name: 'task',
  collections: {
    tasks: {
      view: {
        title: 'Tasks',
        icon: icons.CheckSquare,
        create: Create,
        columns: [
          { key: 'title', label: 'Task', kind: 'title', role: 'title', value: (t: Task) => t.title },
          { key: 'id', label: 'Id', kind: 'mono', role: 'hidden', value: (t: Task) => t.id },
          { key: 'circle', label: 'Circle', kind: 'circle', role: 'hidden', value: (t: Task & { circle?: string }) => t.circle },
          { key: 'priority', label: 'Priority', kind: 'priority', role: 'meta', value: (t: Task) => t.priority },
          { key: 'due', label: 'Due', kind: 'date', role: 'meta', value: (t: Task) => t.due },
          { key: 'status', label: 'Status', kind: 'badge', role: 'meta', value: (t: Task) => t.status, tone: (t: Task) => tones[t.status] },
          { key: 'created', label: 'Created', kind: 'date', role: 'hidden', value: (t: Task) => t.created },
          { key: 'completed', label: 'Completed', kind: 'date', role: 'hidden', value: (t: Task) => t.completed },
        ],
        look: { layout: 'board', by: 'status', lanes: { status: [...statuses], priority: [...priorities] }, cards: ['priority', 'due', 'created'] },
        shifts: [
          { by: 'status', to: ['backlog', 'todo', 'doing'], action: 'move' },
          { by: 'status', to: ['done'], action: 'complete' },
        ],
      },
      page: {
        eyebrow: 'Task',
        title: (t: Page) => t.title,
        subtitle: (t: Task) => t.id,
        properties: (t: Task) => [
          {
            label: 'Status',
            value: t.status,
            kind: 'badge',
            tone: tones[t.status],
            edit: {
              kind: 'pick' as const,
              write: 'move',
              field: 'status',
              current: t.status,
              // Done is a completion, which sets its day.
              writes: { done: 'complete' },
              options: statuses.map((s) => ({ value: s, label: s, kind: 'badge' as const, tone: tones[s] })),
            },
          },
          { label: 'Priority', value: t.priority, kind: 'priority' },
          { label: 'Due', value: t.due, kind: 'date' },
          { label: 'Created', value: t.created, kind: 'date' },
          { label: 'Completed', value: t.completed, kind: 'date' },
        ],
        activity: (t: Task) => [...(t.completed ? [{ at: t.completed, text: 'completed' }] : []), { at: t.created, text: 'created' }],
        blocks: [Body],
        comment: Comments,
        actions: Complete,
      },
    },
  },
}
