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
// listing of them (`models/arrange.ts`), `grouped` where every choice on
// show sits in an accordion. A `toggle` is a switch, its value `yes` or
// `no`, drawn `depth` 1 under the setting before it; one that declares
// `post` posts the fields it gives for its value in place of its own, and
// alone. `help` says how to use it, as an icon whose tooltip says it.
export interface Setting {
  name: string
  label: string
  value: string
  type?: 'text' | 'number' | 'date' | 'email' | 'url' | 'toggle'
  options?: { value: string; label: string }[]
  choices?: { value: string; label: string }[]
  grouped?: boolean
  depth?: 0 | 1
  disabled?: boolean
  post?: (value: string) => Record<string, string>
  help?: string
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

// Who changes a setting, as the icon beside its label says it: a circle
// by motion, the reader's change waiting among the changes to propose to
// it, a host, or nothing the reader may write; in a few words, its name,
// and in its tooltip why. None where the reader's own write saves it,
// which the field says by saving.
export interface Who {
  kind: 'motion' | 'proposed' | 'host' | 'locked' | 'help'
  label: string
  text?: string
}

export function who(s: Setting, decider: Decider | null, proposed = false): Who | null {
  if (direct(s)) {
    return null
  }
  if (!s.motion || !decider) {
    return { kind: 'locked', label: 'Nothing you may write changes this', ...(s.refused ? { text: s.refused } : {}) }
  }
  if (proposed) {
    return { kind: 'proposed', label: `Proposed to ${decider.name}`, text: `Your change waits among the changes to propose to ${decider.name}, in the sidebar, until you propose or discard it.` }
  }
  return { kind: 'motion', label: `${decider.name} changes this by motion`, ...(s.refused ? { text: s.refused } : {}) }
}

// The settings a setting's write saves: each of the form that the same
// write saves directly and that differs from its value in force; one
// that declares `post`, alone.
export function saving(settings: Setting[], s: Setting, value: (s: Setting) => string): Setting[] {
  if (s.post) {
    return direct(s) && value(s) !== s.value ? [s] : []
  }
  return settings.filter((o) => !o.post && direct(o) && o.write === s.write && value(o) !== o.value)
}

// What a setting's write posts: each setting it saves (`saving`) with its
// value as typed, or the fields its `post` gives for it. One left as it
// is never posts, so a write logs only what it changes, and a contact
// detail never set stays unset.
export function posted(settings: Setting[], s: Setting, value: (s: Setting) => string): Record<string, string> {
  return Object.fromEntries(saving(settings, s, value).flatMap((o) => Object.entries(o.post ? o.post(value(o)) : { [o.name]: value(o) })))
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
