// The drawer's properties: which empty ones the reader asked for under
// Add property, and the one whose popover opens as it is added.
export class PropsState {
  added: string[] = $state([])
  fresh: string | null = $state(null)

  add(label: string) {
    this.added = [...this.added, label]
    this.fresh = label
  }
}
