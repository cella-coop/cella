export interface Person {
  address: string
  name: string
}

// Who does a task, and whom it may go to.
export interface Assigned {
  assignee: Person | null
  members: Person[]
}

// A task a member does, as their page lists it.
export interface Doing {
  id: string
  title: string
  status: string
  priority: string
  due: string | null
}
