// A record icon picker's own state, new for each: the search narrowing
// its grid to the curated icons whose name matches it, and the slug
// chosen so far, from its initial value.
export class PickerState {
  query = $state('')
  chosen: string | null = $state(null)

  constructor(initial: string | null) {
    this.chosen = initial
  }

  pick(slug: string | null) {
    this.chosen = slug
    this.query = ''
  }
}
