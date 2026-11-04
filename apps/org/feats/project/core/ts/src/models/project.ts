export type State = 'active' | 'done'

// A project as the collection lists it, amounts in cents: done once every
// milestone it has is complete.
export interface Project {
  id: string
  title: string
  circle: string | null
  started: string
  due: string | null
  budget: number | null
  // Milestones: how many, and how many are complete.
  total: number
  completed: number
  next: string | null
  state: State
}

export interface Milestone {
  // Its number as text, a row's key.
  id: string
  n: number
  title: string
  due: string | null
  completed: string | null
}

export interface Detail extends Project {
  summary: string
  archived: string | null
  milestones: Milestone[]
}

// What a new project may be filed under: the circles projects already
// name.
export interface Offered {
  circles: string[]
}

export interface Create {
  id?: string
  title: string
  circle?: string
  summary?: string
  due?: string
}

export interface Created {
  project: string
  // Its owning circle, which the guard reads a mandate's scope against;
  // so too below.
  circle: string
  started: string
}

export interface Add {
  project: string
  title: string
  due?: string
}

export interface Added {
  project: string
  circle: string
  n: number
}

export interface Complete {
  project: string
  n: number
}

export interface Completed {
  project: string
  circle: string
  n: number
  completed: string
}

export interface Budget {
  project: string
  // In cents; the field a mandate's limit caps.
  amount: number
}

export interface Archive {
  project: string
}

export interface Archived {
  project: string
  circle: string
  archived: string | null
}

export interface Budgeted extends Budget {
  circle: string
}
