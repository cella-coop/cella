import type { Form } from '@cella/org-db'
import { b64 } from '@cella/org-body/models'
import { priorities, statuses, type Create, type Move, type Priority, type Save } from '../models/task.ts'
import type { Post, React, Resolve } from '../models/comment.ts'

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

// An editor's save of a task's body, as its browser posts it: the merged
// snapshot in base64 in `snapshot`, the hash of the saved body it merged
// in `base`, and one `contributor` an address.
export function save(form: Form, task: string): Save {
  const snapshot = form.get('snapshot')
  if (!snapshot) {
    throw new Error('a save carries the body’s snapshot')
  }
  return { task, snapshot: b64.decode(snapshot), base: form.get('base'), contributors: form.all('contributor') }
}

// A comment as its box posts it: its text, each mention `@[address]` in
// it, and the root it replies to in `parent`, empty for a root.
export function post(form: Form, task: string): Post {
  const text = form.get('text')
  if (!text.trim()) {
    throw new Error('a comment says something: type it in the box')
  }
  const parent = form.get('parent')
  if (parent && !/^\d+$/.test(parent)) {
    throw new Error(`“${parent}” is no comment to reply to`)
  }
  return { task, parent: parent ? Number(parent) : null, text }
}

// A root resolved, `resolved` set, or reopened, `resolved` empty.
export function resolve(form: Form): Resolve {
  const comment = form.get('comment')
  if (!/^\d+$/.test(comment)) {
    throw new Error(`“${comment}” is no comment to resolve`)
  }
  return { comment: Number(comment), resolved: form.get('resolved') === 'true' }
}

// A reaction toggled: the comment, the emoji, and `on` set to turn it on
// or empty to turn it off.
export function react(form: Form): React {
  const comment = form.get('comment')
  if (!/^\d+$/.test(comment)) {
    throw new Error(`“${comment}” is no comment to react to`)
  }
  return { comment: Number(comment), emoji: form.get('emoji'), on: form.get('on') === 'true' }
}
