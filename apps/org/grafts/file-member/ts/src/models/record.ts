import type { Store } from '@cella/org-file/models'

// A record filed for a member: the file, about them.
export interface Attach {
  member: string
  file: Store
}

export interface Attached {
  member: string
  file: string
}

// The records on a member's file, each a file who may opens.
export interface OnFile {
  id: string
  name: string
  type: string
  size: number
  uploaded: string
  uploader: string
}
