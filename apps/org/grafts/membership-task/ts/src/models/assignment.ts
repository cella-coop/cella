export interface Person {
  address: string
  name: string
}

// Who does a task, and whom it may go to.
export interface Assigned {
  assignee: Person | null
  members: Person[]
}
