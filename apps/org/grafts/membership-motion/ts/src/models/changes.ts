// A change a motion's action makes, as its diff shows it: an arrangement
// as its tree, or a value, from the one it replaces, none where that is
// not known, to the one it carries.
export interface Shown {
  key: string
  shape: 'arrangement' | 'value'
  label: string
  was: string | null
  value: string
}
