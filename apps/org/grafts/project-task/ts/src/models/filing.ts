export interface Place {
  project: string
  title: string
  milestone: number | null
  phase: string | null
}

// Where a task is filed, and where it may be: each live project and its
// milestones.
export interface Filed {
  place: Place | null
  options: { value: string; label: string }[]
}

// A task of a project, as the project's page lists it.
export interface Listed {
  id: string
  title: string
  status: string
  priority: string
  due: string | null
  phase: string | null
}

// A project's tasks, and the milestones a new one may be filed under.
export interface Tasks {
  tasks: Listed[]
  milestones: { value: string; label: string }[]
  archived: boolean
}
