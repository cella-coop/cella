import type { WriteState } from '@cella/org-ui'
import type { Item } from '../models/meeting.ts'

// A meeting's agenda while it is looked at: its items in their order, a
// drop shown at once, before the move it sends settles. Moves and
// removals are the meeting's writes, sent by the page's script, signed as
// the acting member, their outcome shown as any write's; the meeting comes
// back with it, so a refused move puts the item back.
export class AgendaState {
  readonly #items: () => Item[]
  readonly #meeting: () => string
  readonly #writes: WriteState
  // The order a drop asked for, by item id, until the page's data follows.
  moved: string[] | null = $state(null)

  constructor(items: () => Item[], meeting: () => string, writes: WriteState) {
    this.#items = items
    this.#meeting = meeting
    this.#writes = writes
  }

  items = $derived.by(() => {
    const items = this.#items()
    const order = this.moved
    if (!order || order.length !== items.length) {
      return items
    }
    return order.map((id) => items.find((i) => i.id === id)).filter((i) => i !== undefined)
  })

  async #send(write: string, fields: Record<string, string>) {
    await this.#writes.shown(this.#writes.send(write, Object.entries(fields), this.#meeting(), 'meetings'))
  }

  async move(from: number, to: number) {
    const list = [...this.items]
    const [item] = list.splice(from, 1)
    if (!item) {
      return
    }
    list.splice(to, 0, item)
    this.moved = list.map((i) => i.id)
    try {
      await this.#send('move', { item: item.id, to: String(to) })
    } finally {
      this.moved = null
    }
  }

  async remove(item: string) {
    await this.#send('remove', { item })
  }
}
