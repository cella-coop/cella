// Whether a record's Notes panel opens its body while the body is still
// blank: the record it was opened on, so the next record a reused page
// draws starts shut again.
export class NotesState {
  opened = $state<string | null>(null)

  open(record: string) {
    this.opened = record
  }

  shows(record: string, blank: boolean) {
    return !blank || this.opened === record
  }
}
