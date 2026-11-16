// A settings page's model: each setting with its current value, the
// write that saves it directly, if any, and the motion that changes it
// otherwise; the fields a write posts as a setting saves, and the motion
// offered for a change no write of the reader's makes.

// The motion that changes a setting: its kind, the arguments it carries,
// from the value typed and the one it replaces, those the reader may
// change before proposing labelled as the New form labels them and the
// rest carried as they are, and what its title says of the change.
export interface Moved {
  kind: string
  args: (value: string, was: string) => Record<string, string>
  labels?: Record<string, string>
  says?: (value: string, was: string) => string
}

// A setting as a page declares it: its field, its value in force, the
// page action that saves it, if one does, and, where the reader's write
// would be refused, why, in its guard's own words, as the guard says it
// before anything is written; and the motion that changes it otherwise.
// One that declares `choices` is an arrangement (`Arrange`), its value a
// listing of them (`models/arrange.ts`).
export interface Setting {
  name: string
  label: string
  value: string
  type?: 'text' | 'number' | 'date' | 'email' | 'url'
  options?: { value: string; label: string }[]
  choices?: { value: string; label: string }[]
  rows?: number
  write?: string
  refused?: string
  motion?: Moved
}

// The circle that decides the page's motions (`motion.decider`), and the
// deadline the procedure its requirements fix asks for.
export interface Decider {
  circle: string
  name: string
  deadline: string
}

// The motion offered for a change no write of the reader's makes, the
// motions' New form prefilled: its circle, its title, its deadline and
// the one action it carries; why the change needs it, in the guard's own
// words where a write would be refused; and the change it proposes, the
// setting's label, its value in force and the one typed.
export interface Proposal {
  circle: string
  name: string
  title: string
  deadline: string
  kind: string
  args: { name: string; label: string | null; value: string }[]
  reason: string
  field: string
  change: { label: string; was: string; value: string }
}

// Whether the reader's own write saves a setting.
export const direct = (s: Setting) => !!s.write && !s.refused

// What changes a setting, as its quiet line says it.
export function changer(s: Setting, decider: Decider | null): string {
  if (direct(s)) {
    return 'You change it here'
  }
  return s.motion && decider ? `${decider.name} changes it by motion` : 'Nothing you may write changes it'
}

// What a setting's write posts: each setting of the form that the same
// write saves directly and that differs from its value in force, with
// its value as typed. One left as it is never posts, so a write logs
// only what it changes, and a contact detail never set stays unset.
export function posted(settings: Setting[], s: Setting, value: (s: Setting) => string): Record<string, string> {
  return Object.fromEntries(settings.filter((o) => direct(o) && o.write === s.write && value(o) !== o.value).map((o) => [o.name, value(o)]))
}

// The motion proposing a setting's change to `value`, or none where no
// motion is declared to change it or no circle decides it.
export function proposal(s: Setting, value: string, decider: Decider | null): Proposal | null {
  if (!s.motion || !decider) {
    return null
  }
  const m = s.motion
  return {
    circle: decider.circle,
    name: decider.name,
    title: m.says?.(value, s.value) ?? `Change ${s.label.toLowerCase()} from “${s.value}” to “${value}”`,
    deadline: decider.deadline,
    kind: m.kind,
    args: Object.entries(m.args(value, s.value)).map(([name, v]) => ({ name, label: m.labels?.[name] ?? null, value: v })),
    reason: s.refused ?? `${s.label} has no write of its own: ${decider.name} changes it by motion`,
    field: s.name,
    change: { label: s.label, was: s.value, value },
  }
}
