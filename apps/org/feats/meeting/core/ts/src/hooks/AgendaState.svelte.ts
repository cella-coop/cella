import { applyAction } from '$app/forms'
import { refreshAll } from '$app/navigation'
import { post } from '@cella/org-ui'
import type { Item } from '../models/meeting.ts'

// A meeting's agenda while it is looked at: its items in their order, a
// drop shown at once, before the move it posts settles. Moves and
// removals post to the meeting page's actions, signed as the acting
// member, their outcome shown as any write's; the page is read again, so
// a refused move puts the item back.
export class AgendaState {
  readonly #items: () => Item[]
  readonly #path: () => string
  // The order a drop asked for, by item id, until the page's data follows.
  moved: string[] | null = $state(null)

  constructor(items: () => Item[], path: () => string) {
    this.#items = items
    this.#path = path
  }

  items = $derived.by(() => {
    const items = this.#items()
    const order = this.moved
    if (!order || order.length !== items.length) {
      return items
    }
    return order.map((id) => items.find((i) => i.id === id)).filter((i) => i !== undefined)
  })

  async #post(action: string, fields: Record<string, string>) {
    const body = new FormData()
    for (const [k, v] of Object.entries(fields)) {
      body.set(k, v)
    }
    await applyAction(await post(`${this.#path()}?/${action}`, body))
    await refreshAll()
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
      await this.#post('move', { item: item.id, to: String(to) })
    } finally {
      this.moved = null
    }
  }

  async remove(item: string) {
    await this.#post('remove', { item })
  }
}
