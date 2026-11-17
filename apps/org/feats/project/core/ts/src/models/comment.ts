import type { Comment } from '@cella/org-body/models'

// A project's threads, written by `cella scaffold comments project`: as its
// page reads them, its comments oldest first, whether the reader may
// discuss it, posting, resolving and reacting, and whether its circle has
// reactions on; and the writes: a root or a reply to a root, its text the
// author's, each `@[address]` in it a mention of a core person; a root
// resolved or reopened; and a reaction toggled. Whom a mention may name is
// edit-time data, read by the comment box on its own once it mounts.

export interface Threaded {
  comments: Comment[]
  discuss: boolean
  reactions: boolean
}

export interface CommentPost {
  project: string
  // The root it replies to, or null for a root.
  parent: number | null
  text: string
}

export interface CommentPosted {
  project: string
  comment: number
  circle: string
}

export interface CommentResolve {
  comment: number
  // True to resolve the root, false to reopen it.
  resolved: boolean
}

// A reaction of the actor's to a comment, one of core body's six, turned
// on or off.
export interface CommentReact {
  comment: number
  emoji: string
  on: boolean
}

export interface CommentDone {
  comment: number
  project: string
  circle: string
}
