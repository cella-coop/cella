import { action, type Db, type Form } from '@cella/org-db'
import type { CommentPost, CommentReact, CommentResolve, Threaded } from '../models/comment.ts'
import { postComment, reactToComment, resolveComment } from '../handlers/comment.ts'
import { mentions, threaded } from '../drivers/comment.ts'

// A project's threads, written by `cella scaffold comments project`: the writes
// its page's box posts, its page's item with its threads, and the
// mentions waiting in the Inbox.

// A comment as its box posts it: its text, each mention `@[address]` in
// it, and the root it replies to in `parent`, empty for a root.
export function posting(form: Form, id: string): CommentPost {
  const text = form.get('text')
  if (!text.trim()) {
    throw new Error('a comment says something: type it in the box')
  }
  const parent = form.get('parent')
  if (parent && !/^\d+$/.test(parent)) {
    throw new Error(`“${parent}” is no comment to reply to`)
  }
  return { project: id, parent: parent ? Number(parent) : null, text }
}

// A root resolved, `resolved` set, or reopened, `resolved` empty.
export function resolving(form: Form): CommentResolve {
  const comment = form.get('comment')
  if (!/^\d+$/.test(comment)) {
    throw new Error(`“${comment}” is no comment to resolve`)
  }
  return { comment: Number(comment), resolved: form.get('resolved') === 'true' }
}

// A reaction toggled: the comment, the emoji, and `on` set to turn it on
// or empty to turn it off.
export function reacting(form: Form): CommentReact {
  const comment = form.get('comment')
  if (!/^\d+$/.test(comment)) {
    throw new Error(`“${comment}” is no comment to react to`)
  }
  return { comment: Number(comment), emoji: form.get('emoji'), on: form.get('on') === 'true' }
}

export const commentActions = {
  post: action('project:comment:post', (form, id) => posting(form, id ?? ''), postComment),
  resolve: action('project:comment:resolve', (form) => resolving(form), resolveComment),
  react: action('project:comment:react', (form) => reacting(form), reactToComment),
}

export const inbox = { rows: mentions }

export const withThreads =
  <T extends object>(read: (db: Db, id: string, query?: URLSearchParams) => Promise<T | null>) =>
  async (db: Db, id: string, query?: URLSearchParams): Promise<(T & Threaded) | null> => {
    const item = await read(db, id, query)
    return item && { ...item, ...(await threaded(db, id)) }
  }
