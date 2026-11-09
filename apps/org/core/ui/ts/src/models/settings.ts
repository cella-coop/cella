// A settings page's model: each setting with its current value, the
// write that saves it directly, if any, and the motion that changes it
// otherwise; and what a Save of the fields changed does, the writes it
// posts and the motion it offers to propose instead.

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
export interface Setting {
  name: string
  label: string
  value: string
  type?: 'text' | 'number' | 'date' | 'email' | 'url'
  options?: { value: string; label: string }[]
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

// A motion offered instead of a write, the motions' New form prefilled:
// its circle, its title, its deadline and the one action it carries, with
// why no write of the reader's makes the change, and the fields it is
// about.
export interface Proposal {
  circle: string
  name: string
  title: string
  deadline: string
  kind: string
  args: { name: string; label: string | null; value: string }[]
  reasons: string[]
  fields: string[]
}

// What a Save does: each write it posts with the fields it saves, the
// motion it offers, and the fields changed it does neither for, left
// marked not saved: those of another kind of motion than the one offered,
// for a Save after it, or those no motion is declared to change.
export interface Plan {
  saves: { write: string; fields: Record<string, string> }[]
  proposal: Proposal | null
  left: string[]
}

// Whether the reader's own write saves a setting.
export const direct = (s: Setting) => !!s.write && !s.refused

// What changes a setting, as its quiet line says it.
export function changer(s: Setting, decider: Decider | null): string {
  if (direct(s)) {
    return 'You change it here'
  }
  return s.motion && decider ? `A motion of ${decider.name} changes it` : 'Nothing you may write changes it'
}

// Splits the fields changed, `typed` by name, into the writes that save
// them and the one motion that proposes the rest: the first changed
// field's kind, which every other changed field of that kind joins, its
// arguments merged and its titles joined.
export function plan(settings: Setting[], typed: Record<string, string>, decider: Decider | null): Plan {
  const changed = settings.filter((s) => s.name in typed && typed[s.name] !== s.value)
  const saves = new Map<string, Record<string, string>>()
  for (const s of changed.filter(direct)) {
    saves.set(s.write!, { ...saves.get(s.write!), [s.name]: typed[s.name] })
  }
  const moved = changed.filter((s) => !direct(s))
  const kind = decider ? moved.find((s) => s.motion)?.motion?.kind : undefined
  const joining = moved.filter((s) => kind && s.motion?.kind === kind)
  const args = new Map<string, Proposal['args'][number]>()
  for (const s of joining) {
    for (const [name, value] of Object.entries(s.motion!.args(typed[s.name], s.value))) {
      args.set(name, { name, label: s.motion!.labels?.[name] ?? null, value })
    }
  }
  const says = (s: Setting) => s.motion!.says?.(typed[s.name], s.value) ?? `Change ${s.label.toLowerCase()} from “${s.value}” to “${typed[s.name]}”`
  const proposal: Proposal | null = kind && decider
    ? {
        circle: decider.circle,
        name: decider.name,
        title: joining.map(says).join('; '),
        deadline: decider.deadline,
        kind,
        args: [...args.values()],
        reasons: [...new Set(joining.map((s) => s.refused ?? `${s.label} has no write of its own: only a motion of ${decider.name} changes it`))],
        fields: joining.map((s) => s.name),
      }
    : null
  return {
    saves: [...saves].map(([write, fields]) => ({ write, fields })),
    proposal,
    left: moved.filter((s) => !joining.includes(s)).map((s) => s.name),
  }
}
