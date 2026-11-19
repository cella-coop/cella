import type { Tone } from './view.ts'

// A status: a record's place in its lifecycle, one of an ordered list of
// states its feat declares in its models, each in one of five fixed
// categories. The kit reads the category, never the word, so a state
// may be called "review" or "à valider" and still read as under way: its
// pill's glyph, its tone, its group's bar, whether it is open.
export const categories = ['backlog', 'unstarted', 'started', 'completed', 'cancelled'] as const
export type Category = (typeof categories)[number]

// Each category's tone, by the house's classes: at rest, under way,
// settled. A cancelled state is at rest too, its glyph saying it ended.
export const tones: Record<Category, Tone> = {
  backlog: 'neutral',
  unstarted: 'neutral',
  started: 'accent',
  completed: 'positive',
  cancelled: 'neutral',
}

// A state: its value as its SQL CHECK lists it, its category and, where
// the house keeps one, a tone of its own (refused and rejected stay
// negative, suspended warning); its word is its value unless `label`.
export interface State<V extends string = string> {
  value: V
  category: Category
  tone?: Tone
  label?: string
}

// A feat's status: the column it is, `<table>.<column>` in the feat's own
// schema, whose CHECK `cella check feats` holds equal to `states`, and
// its states in their order, which a board's lanes and its groups follow.
export interface Lifecycle<V extends string = string> {
  column: string
  states: readonly State<V>[]
}

// The values a lifecycle lists, in its order.
export const values = <V extends string>(l: Lifecycle<V>): V[] => l.states.map((s) => s.value)

export const stateOf = <V extends string>(l: Lifecycle<V>, value: unknown): State<V> | undefined => l.states.find((s) => s.value === value)

// A state's tone: its own, else its category's.
export const toneOf = (l: Lifecycle, value: unknown): Tone => {
  const s = stateOf(l, value)
  return s ? (s.tone ?? tones[s.category]) : 'neutral'
}

// Whether a category is finished: completed or cancelled. Every other is
// open, so a filter or a count of what is open never names a value.
export const finished = (c: Category): boolean => c === 'completed' || c === 'cancelled'

// The values of a lifecycle in the given categories, in its order.
export const within = <V extends string>(l: Lifecycle<V>, ...cs: Category[]): V[] => l.states.filter((s) => cs.includes(s.category)).map((s) => s.value)

export const open = <V extends string>(l: Lifecycle<V>): V[] => l.states.filter((s) => !finished(s.category)).map((s) => s.value)

// How a state is drawn: its category's glyph, and for a started one how
// full its circle is, by its place among the started states, so two
// under way, active and review, read apart and in order.
export interface Stage {
  category: Category
  fill: number
  tone: Tone
  label: string
}

export const stage = (l: Lifecycle, value: unknown): Stage | undefined => {
  const s = stateOf(l, value)
  if (!s) {
    return undefined
  }
  const started = l.states.filter((x) => x.category === 'started')
  const fill = s.category === 'started' ? (started.indexOf(s) + 1) / (started.length + 1) : 0
  return { category: s.category, fill, tone: s.tone ?? tones[s.category], label: s.label ?? s.value }
}
