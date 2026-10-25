// A worker's week of time, as the grid enters it: its days from Monday,
// each open to time once it has come and while they are employed; a row
// for each project not archived, the ones they booked to lately first,
// and one for the co-op's own time, booked to no project; and the minutes
// already logged in each cell.
export interface Day {
  day: string
  // Whether time may be logged on it: it has come, and they are employed.
  open: boolean
}

export interface Row {
  // A project's id, or '' for the co-op's own time.
  project: string
  title: string
}

export interface Week {
  worker: string
  monday: string
  days: Day[]
  rows: Row[]
  // Minutes logged, by row and day: `logged[project][day]`.
  logged: Record<string, Record<string, number>>
}

// What the grid sends: for each cell typed into, the hours it adds.
export interface Cell {
  project: string
  day: string
  minutes: number
}

// A cell's field name in the grid's form, and back.
export const cell = (project: string, day: string) => `cell.${project || '_'}.${day}`

export function cells(names: [string, string][], minutes: (typed: string) => number): Cell[] {
  const out: Cell[] = []
  for (const [name, typed] of names) {
    const m = /^cell\.([a-z0-9-]+|_)\.(\d{4}-\d{2}-\d{2})$/.exec(name)
    if (m && typed.trim()) {
      out.push({ project: m[1] === '_' ? '' : m[1], day: m[2], minutes: minutes(typed) })
    }
  }
  return out
}

// The hours a number of minutes reads as, at most two decimals.
export const hours = (minutes: number) => Math.round((minutes / 60) * 100) / 100
