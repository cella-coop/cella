// A task's comments, as the task feat writes them: a root, or a reply to
// a root of the same task, its text the author's, each `@[address]` in it
// a mention of a core person; and a root resolved or reopened.

export interface Post {
  task: string
  // The root it replies to, or null for a root.
  parent: number | null
  text: string
}

export interface Posted {
  task: string
  comment: number
  circle: string
}

export interface Resolve {
  comment: number
  // True to resolve the root, false to reopen it.
  resolved: boolean
}

export interface Resolved {
  comment: number
  task: string
  circle: string
}
