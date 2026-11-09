import type { Canon, Comment, Named } from '@cella/org-body/models'

export const statuses = ['backlog', 'todo', 'doing', 'done'] as const
export type Status = (typeof statuses)[number]

export const priorities = ['urgent', 'high', 'normal', 'low'] as const
export type Priority = (typeof priorities)[number]

export interface Task {
  id: string
  title: string
  status: Status
  priority: Priority
  due: string | null
  created: string
  completed: string | null
}

export interface Create {
  title: string
  priority?: Priority
  due?: string
  status?: Exclude<Status, 'done'>
}

export interface Created {
  task: string
  created: string
}

// A move between the statuses short of done; done is a completion.
export interface Move {
  task: string
  status: Exclude<Status, 'done'>
}

export interface Complete {
  task: string
}

export interface Moved {
  task: string
  status: Status
  completed: string | null
}

// A task as its page reads it: its body as a Loro snapshot in base64,
// which the browser's editor opens, and its canonical form, which the
// page draws until it does; null both where it has none yet. Its
// comments, oldest first, the people who may read it, whom a mention
// may name, whether the reader may discuss it, posting, resolving and
// reacting, and whether its circle has reactions on.
export interface Page extends Task {
  snapshot: string | null
  canon: Canon | null
  comments: Comment[]
  readers: Named[]
  discuss: boolean
  reactions: boolean
}

// An editor's save of a task's body: the merged snapshot as its browser
// holds it, and who contributed since the last save, by address.
export interface Save {
  task: string
  snapshot: Uint8Array
  contributors: string[]
}

export interface Saved {
  task: string
  circle: string
}
