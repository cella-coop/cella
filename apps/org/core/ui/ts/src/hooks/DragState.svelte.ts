import {
  aim,
  cancel,
  drop,
  empty,
  idle,
  land,
  lift,
  lifted,
  next,
  over,
  slot,
  start,
  step,
  type Carry,
  type Drag,
  type Mode,
  type Move,
  type Transfer,
} from '../models/drag.ts'

// The drag under way on a page, if any: which list and item it lifted,
// where the item would land, and what to announce, so any component can
// show the drop indicator and the dimmed item. Its moves are
// `models/drag.ts`'s, which tests run without a browser.
export class DragState {
  drag: Drag = $state(idle())
  carry: Carry = $state(empty())
  announcement = $state('')
  // The key of the item lifted, where its list lands it on places it
  // names (`placing`) rather than between its items.
  key: string | null = $state(null)
  // An item the keyboard moved a place at once, as a table's column by Alt
  // and an arrow: its list, its key and where it lands, so its handle
  // takes the focus back there once the list has moved it.
  moved: { list: string; key: string; to: number } | null = $state(null)

  // An item moved a place by the keyboard, announced.
  nudge(list: string, key: string, label: string, to: number, length: number) {
    this.moved = { list, key, to }
    this.announcement = `${label} moved to position ${to + 1} of ${length}.`
  }

  // Whether this item, at `i`, is where the keyboard moved it.
  landed(list: string, key: string, i: number) {
    return this.moved?.list === list && this.moved.key === key && this.moved.to === i
  }

  // Whether a list that lands its items on places is carrying one.
  placing(list: string) {
    return this.drag.list === list && this.key !== null
  }

  // Whether this list's lifted item would land on place `i`, somewhere
  // other than where it was.
  aiming(list: string, i: number) {
    return this.placing(list) && this.drag.to === i && this.drag.to !== this.drag.from
  }

  holding(list: string, key: string) {
    return this.placing(list) && this.key === key
  }


  // Whether a carried item would land in this list.
  aimed(group: string, list: string) {
    return this.carry.group === group && this.carry.target === list
  }

  carrying(group: string, id: string) {
    return this.carry.group === group && this.carry.id === id
  }

  lift(group: string, id: string, origin: string, mode: Mode, label: string) {
    this.carry = lift(group, id, origin, mode)
    if (mode === 'keyboard') {
      this.announcement = `${label} lifted from ${origin}. Left and right choose a column, Space drops it, Escape cancels.`
    }
  }

  aim(target: string | null) {
    this.carry = aim(this.carry, target)
  }

  next(lists: string[], takes: (list: string) => boolean, by: number) {
    this.carry = next(this.carry, lists, takes, by)
    this.announcement = this.carry.target ? `Over ${this.carry.target}.` : `Back over ${this.carry.origin}.`
  }

  land(): Transfer | null {
    const keyboard = this.carry.mode === 'keyboard'
    const done = land(this.carry)
    this.carry = done.carry
    if (keyboard) {
      this.announcement = done.transfer ? `Dropped in ${done.transfer.to}.` : 'Dropped where it was.'
    }
    return done.transfer
  }

  putBack() {
    const keyboard = this.carry.mode === 'keyboard'
    this.carry = empty()
    if (keyboard) {
      this.announcement = 'Move cancelled.'
    }
  }

  get lifted() {
    return lifted(this.drag)
  }

  // Whether this list shows the indicator before item `i`.
  before(list: string, i: number) {
    return this.drag.list === list && this.drag.from !== this.drag.to && slot(this.drag) === i
  }

  dragging(list: string, i: number) {
    return this.drag.list === list && this.drag.from === i
  }

  start(list: string, index: number, length: number, mode: Mode, label: string) {
    this.drag = start(list, index, length, mode)
    if (mode === 'keyboard') {
      this.announcement = `${label} lifted, position ${index + 1} of ${length}. Arrow keys move it, Space drops it, Escape cancels.`
    }
  }

  over(to: number) {
    this.drag = over(this.drag, to)
  }

  step(by: number) {
    this.drag = step(this.drag, by)
    this.announcement = `Position ${this.drag.to + 1} of ${this.drag.length}.`
  }

  drop(): Move | null {
    const keyboard = this.drag.mode === 'keyboard'
    const done = drop(this.drag)
    this.drag = done.drag
    if (keyboard) {
      this.announcement = done.move ? `Dropped at position ${done.move.to + 1}.` : 'Dropped where it was.'
    }
    return done.move
  }

  cancel() {
    const keyboard = this.drag.mode === 'keyboard'
    this.drag = cancel()
    if (keyboard) {
      this.announcement = 'Move cancelled.'
    }
  }
}
