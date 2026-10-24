// A new invoice's lines while they are typed: how many, each with a key
// the form keeps across adding and removing.
export class IssueState {
  lines: { key: number }[] = $state([{ key: 1 }])
  #next = 2

  add() {
    this.lines.push({ key: this.#next++ })
  }

  remove(key: number) {
    if (this.lines.length > 1) {
      this.lines = this.lines.filter((l) => l.key !== key)
    }
  }
}
