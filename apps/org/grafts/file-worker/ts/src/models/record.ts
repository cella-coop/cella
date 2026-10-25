import type { Store } from '@cella/org-file/models'

// A record filed for a worker: the file, about them.
export interface Attach {
  worker: string
  file: Store
}

export interface Attached {
  worker: string
  file: string
}

// The records on a worker's file, each a file who may opens.
export interface OnFile {
  id: string
  name: string
  type: string
  size: number
  uploaded: string
  uploader: string
}
