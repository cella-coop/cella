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
