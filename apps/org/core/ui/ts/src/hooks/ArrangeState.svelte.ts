// An arrangement's own state beside its value: the accordions just made
// and still empty, which no listing can hold until a choice is dragged
// into one, and each one's name as typed.
export class ArrangeState {
  empty = $state<string[]>([])

  // A new accordion, empty, named apart from every other.
  make(taken: string[]) {
    const all = new Set([...taken, ...this.empty])
    let name = 'New accordion'
    for (let n = 2; all.has(name); n++) {
      name = `New accordion ${n}`
    }
    this.empty.push(name)
  }

  // An empty accordion renamed, or dropped where the name is blank or
  // another empty one's, which it joins.
  rename(group: string, name: string) {
    const to = name.trim()
    this.empty = to && (to === group || !this.empty.includes(to)) ? this.empty.map((g) => (g === group ? to : g)) : this.empty.filter((g) => g !== group)
  }

  // An accordion a choice now fills, which no longer waits empty.
  filled(group: string) {
    this.empty = this.empty.filter((g) => g !== group)
  }
}
