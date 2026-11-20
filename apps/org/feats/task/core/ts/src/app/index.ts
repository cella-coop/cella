import { icons, open, within, type App } from '@cella/org-ui'
import { status } from '../models/status.ts'
import { priorities, statuses, type Page, type Priority, type Task } from '../models/task.ts'
import { Body } from '@cella/org-body/app'
import Comments from './blocks/Comments.svelte'
import Create from './blocks/Create.svelte'
import Complete from './blocks/Complete.svelte'

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
          { key: 'status', label: 'Status', kind: 'status', states: status, role: 'meta', value: (t: Task) => t.status },
          { key: 'created', label: 'Created', kind: 'date', role: 'hidden', value: (t: Task) => t.created },
          { key: 'completed', label: 'Completed', kind: 'date', role: 'hidden', value: (t: Task) => t.completed },
        ],
        look: { layout: 'board', by: 'status', lanes: { priority: [...priorities] }, cards: ['priority', 'due', 'created'] },
        shifts: [
          { by: 'status', to: open(status), action: 'move' },
          { by: 'status', to: within(status, 'completed'), action: 'complete' },
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
            kind: 'status',
            states: status,
            edit: {
              kind: 'pick' as const,
              write: 'move',
              field: 'status',
              current: t.status,
              // Done is a completion, which sets its day.
              writes: { done: 'complete' },
              options: statuses.map((s) => ({ value: s, label: s, kind: 'status' as const, states: status })),
            },
          },
          {
            label: 'Priority',
            value: t.priority,
            kind: 'priority',
            edit: {
              kind: 'pick' as const,
              write: 'set',
              field: 'priority',
              extra: [['set', 'priority']],
              current: t.priority,
              options: priorities.map((p) => ({ value: p, label: p, kind: 'priority' as const })),
            },
          },
          { label: 'Due', value: t.due, kind: 'date', edit: { kind: 'date' as const, write: 'set', field: 'due', extra: [['set', 'due']], current: t.due } },
          { label: 'Created', value: t.created, kind: 'date' },
          { label: 'Completed', value: t.completed, kind: 'date' },
        ],
        activity: (t: Task) => [...(t.completed ? [{ at: t.completed, text: 'completed' }] : []), { at: t.created, text: 'created' }],
        layout: 'body',
        body: Body,
        comment: Comments,
        actions: Complete,
      },
    },
  },
}
