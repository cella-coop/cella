import type { Form } from '@cella/org-db'
import { priorities, statuses, type Create, type Move, type Priority } from '../models/task.ts'

// What the shell's forms send, read into the handlers' inputs.

const priority = (typed: string): Priority | undefined => {
  if (!typed) {
    return undefined
  }
  if (!priorities.includes(typed as Priority)) {
    throw new Error(`“${typed}” is no priority: ${priorities.join(', ')}`)
  }
  return typed as Priority
}

export const create = (form: Form): Create => ({
  title: form.get('title'),
  priority: priority(form.get('priority')),
  due: form.get('due') || undefined,
})

// The status a move names: the page's select, or the board's column a
// card was dropped in. Done is a completion, not a move.
export function move(form: Form, task: string): Move {
  const status = form.get('status') || form.get('to')
  if (!statuses.includes(status as Move['status']) || status === 'done') {
    throw new Error(`a task moves to ${statuses.filter((s) => s !== 'done').join(', ')}; done is a completion`)
  }
  return { task, status: status as Move['status'] }
}
