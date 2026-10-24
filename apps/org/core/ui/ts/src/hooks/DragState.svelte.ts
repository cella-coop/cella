import { cancel, drop, idle, lifted, over, slot, start, step, type Drag, type Mode, type Move } from '../models/drag.ts'

// The drag under way on a page, if any: which list and item it lifted,
// where the item would land, and what to announce, so any component can
// show the drop indicator and the dimmed item. Its moves are
// `models/drag.ts`'s, which tests run without a browser.
export class DragState {
  drag: Drag = $state(idle())
  announcement = $state('')

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
