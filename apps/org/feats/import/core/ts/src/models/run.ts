// What one line of an imported file came to: where it was read, what it
// is, the write it made and its outcome, with its log entry or why it was
// refused. `failed` is a line no write was made for.
export interface Line {
  line: number
  label: string
  op: string
  state: 'settled' | 'pending' | 'refused' | 'failed'
  entry?: number
  reason?: string
}

// A file imported, or tried in a dry run, and what its lines came to.
export interface Run {
  id: string
  kind: string
  name: string
  actor: string
  day: string
  dry: boolean
  settled: number
  refused: number
  lines: Line[]
}

// A run to record, as the root's import makes it.
export interface Recording {
  kind: string
  name: string
  dry: boolean
  lines: Line[]
}

export interface Recorded {
  run: string
  kind: string
  dry: boolean
  settled: number
  refused: number
}

// A kind of file the co-op imports, as the slices that read it name it.
export interface Kind {
  kind: string
  title: string
  formats: string
}
