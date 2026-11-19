// A worker's week of time, as the grid enters it: its days from Monday,
// each open to time once it has come and while they are employed; a row
// for each project not archived, the ones they booked to lately first,
// and one for the coop's own time, booked to no project; the circles
// each row's time may be worked for; and the minutes already logged in
// each cell.
export interface Day {
  day: string
  // Whether time may be logged on it: it has come, and they are employed.
  open: boolean
}

export interface Row {
  // A project's id, or '' for the coop's own time.
  project: string
  title: string
  // The circles the worker sits in that week, as the row offers them:
  // the project's first where they sit in it, the root's for the
  // coop's own time.
  circles: { id: string; name: string }[]
}

export interface Week {
  worker: string
  monday: string
  days: Day[]
  rows: Row[]
  // Minutes logged, by row and day: `logged[project][day]`.
  logged: Record<string, Record<string, number>>
}

// What the grid sends: for each cell typed into, the hours it adds, and
// the circle its row names, none where it names none.
export interface Cell {
  project: string
  day: string
  minutes: number
  circle?: string
}

// A cell's field name in the grid's form, and back; and the field naming
// a row's circle.
export const cell = (project: string, day: string) => `cell.${project || '_'}.${day}`
export const circle = (project: string) => `circle.${project || '_'}`

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
