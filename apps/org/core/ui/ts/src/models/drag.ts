// Reordering a list by dragging, as plain data: which list and item a
// drag lifted, where it would land, and whether the pointer or the
// keyboard carries it. `to` is the index the item will have once moved,
// so dropping where it was is no move at all. The UI core's DragState
// holds one of these as state; `sortable` drives it from the DOM. Any
// list of any item type: only indexes move here. A list that nests lands
// its items on places instead (`placing`).

export type Mode = 'pointer' | 'keyboard'

export interface Drag {
  list: string | null
  from: number
  to: number
  length: number
  mode: Mode | null
}

export interface Move {
  from: number
  to: number
}

export const idle = (): Drag => ({ list: null, from: -1, to: -1, length: 0, mode: null })

export const lifted = (d: Drag) => d.list !== null

export function start(list: string, index: number, length: number, mode: Mode): Drag {
  const i = Math.max(0, Math.min(index, length - 1))
  return { list, from: i, to: i, length, mode }
}

// To an index, held within the list.
export function over(d: Drag, to: number): Drag {
  return lifted(d) ? { ...d, to: Math.max(0, Math.min(to, d.length - 1)) } : d
}

// By some places, as an arrow key moves it.
export const step = (d: Drag, by: number): Drag => over(d, d.to + by)

// The move a drop makes, none when it lands where it was, and the drag
// done either way.
export function drop(d: Drag): { drag: Drag; move: Move | null } {
  const move = lifted(d) && d.to !== d.from ? { from: d.from, to: d.to } : null
  return { drag: idle(), move }
}

export const cancel = (): Drag => idle()

// Where a list shows the drop indicator: before the item at this index,
// or after the last when it is the length.
export const slot = (d: Drag) => (d.to > d.from ? d.to + 1 : d.to)

// Carrying an item between lists, as a board's cards between columns:
// which item, the list it came from, and the list it would land in, if
// that list takes it.
export interface Carry {
  group: string | null
  id: string
  origin: string
  target: string | null
  mode: Mode | null
}

export interface Transfer {
  id: string
  from: string
  to: string
}

export const empty = (): Carry => ({ group: null, id: '', origin: '', target: null, mode: null })

export const lift = (group: string, id: string, origin: string, mode: Mode): Carry => ({ group, id, origin, target: null, mode })

export const aim = (c: Carry, target: string | null): Carry => (c.group ? { ...c, target } : c)

// What a drop carries where, none when it lands nowhere that takes it or
// back where it came from, and the carry done either way.
export function land(c: Carry): { carry: Carry; transfer: Transfer | null } {
  const transfer = c.group && c.target && c.target !== c.origin ? { id: c.id, from: c.origin, to: c.target } : null
  return { carry: empty(), transfer }
}

// The next list along that takes the item, by some places, wrapping, as
// an arrow key aims it; where it came from counts as a place.
export function next(c: Carry, lists: string[], takes: (list: string) => boolean, by: number): Carry {
  const open = lists.filter((l) => l === c.origin || takes(l))
  if (!c.group || !open.length) {
    return c
  }
  const at = open.indexOf(c.target ?? c.origin)
  const to = open[(((at + by) % open.length) + open.length) % open.length]
  return { ...c, target: to === c.origin ? null : to }
}

// The items in their new order.
export function reorder<T>(items: T[], from: number, to: number): T[] {
  if (from < 0 || from >= items.length || to < 0 || to >= items.length) {
    return items
  }
  const out = [...items]
  const [item] = out.splice(from, 1)
  out.splice(to, 0, item)
  return out
}
