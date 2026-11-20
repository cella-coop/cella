import { choosable, end, ruled, step, typed, type Entry, type Item } from '../models/menu.ts'

// Where a menu opens: a point, and where it ends instead where it would
// pass the window's right or bottom edge (`fit` in `models/menu.ts`).
export interface Point {
  x: number
  y: number
  before?: number
  above?: number
}

// A level of an open menu: the menu itself, then each submenu open from
// the item the level before it is on; where it opens, and the item the
// keyboard or the pointer is on, -1 for none yet, as a menu opened by the
// pointer is.
export interface Level {
  at: Point
  active: number
}

const press = 500
const slop = 8

// A context menu's state: the levels open, the target its focus returns
// to, the letters typed in a run, and a long press under way. The moves
// are `models/menu.ts`'s; what is drawn and where is `ContextMenu`'s.
export class MenuState {
  levels: Level[] = $state([])
  // Opened by the keyboard, so the item it lands on is marked at once.
  keyed = $state(false)
  readonly #items: () => Entry[]
  #target: HTMLElement | null = null
  #typed = ''
  #quiet: ReturnType<typeof setTimeout> | undefined
  #pressing: { timer: ReturnType<typeof setTimeout>; x: number; y: number } | null = null
  // A long press just opened it, so the release's click is the press's
  // and not the target's.
  #pressed = false

  constructor(items: () => Entry[]) {
    this.#items = items
  }

  get open() {
    return this.levels.length > 0
  }

  // The entries of level `k`: the menu's, or those of the submenu the
  // level before it is on.
  entries(k: number): Entry[] {
    let es = this.#items()
    for (let i = 0; i < k; i++) {
      const on = es[this.levels[i]?.active ?? -1]
      es = on && !ruled(on) ? (on.items ?? []) : []
    }
    return es
  }

  // Opens it at `at`, the focus returning to `target` as it closes; by
  // the keyboard on its first item, by the pointer on none.
  show(at: Point, target: HTMLElement | null, keyed: boolean) {
    this.#target = target
    this.keyed = keyed
    this.levels = [{ at, active: keyed ? end(this.entries(0), 'first') : -1 }]
  }

  // Shuts every level; the focus goes back to the target, but where the
  // pointer took it elsewhere.
  close(restore = true) {
    if (!this.open) {
      return
    }
    this.levels = []
    this.#typed = ''
    if (restore) {
      this.#target?.focus()
    }
  }

  // The level the keyboard moves in: the deepest one on an item, so a
  // submenu the pointer opened, on none yet, leaves it in its parent.
  get depth() {
    return Math.max(0, this.levels.findLastIndex((l) => l.active >= 0))
  }

  // The item of level `k` holding the focus: the one it is on, else its
  // first, unmarked, so the keyboard has somewhere to start.
  focus(k: number): number {
    const l = this.levels[k]
    return !l ? -1 : l.active >= 0 ? l.active : end(this.entries(k), 'first')
  }

  #set(k: number, active: number) {
    this.levels = [...this.levels.slice(0, k), { ...this.levels[k]!, active }]
  }

  move(by: number) {
    const k = this.depth
    this.keyed = true
    this.#set(k, step(this.entries(k), this.levels[k]!.active, by))
  }

  to(which: 'first' | 'last') {
    const k = this.depth
    this.keyed = true
    this.#set(k, end(this.entries(k), which))
  }

  // A letter typed: the run so far reaches its item; a pause of half a
  // second starts a new run.
  type(key: string) {
    clearTimeout(this.#quiet)
    this.#typed += key
    this.#quiet = setTimeout(() => (this.#typed = ''), 500)
    const k = this.depth
    this.keyed = true
    this.#set(k, typed(this.entries(k), this.levels[k]!.active, this.#typed))
  }

  // The pointer on item `i` of level `k`: deeper levels shut, and its
  // submenu opens at `at` where it has one it may open.
  hover(k: number, i: number, at?: Point) {
    const it = this.entries(k)[i]
    const sub = !!it && !ruled(it) && !!it.items && !it.disabled
    if (this.levels[k]?.active === i && this.levels.length === k + (sub ? 2 : 1)) {
      return
    }
    this.levels = [...this.levels.slice(0, k), { ...this.levels[k]!, active: i }]
    if (at && sub) {
      this.levels = [...this.levels, { at, active: -1 }]
    }
  }

  // Opens the submenu of the item the deepest level is on, by the
  // keyboard, on its first item.
  enter(at: Point): boolean {
    const k = this.depth
    const it = this.entries(k)[this.levels[k]!.active]
    if (!it || ruled(it) || !it.items || it.disabled) {
      return false
    }
    this.keyed = true
    this.levels = [...this.levels.slice(0, k + 1), { at, active: end(it.items, 'first') }]
    return true
  }

  // Shuts the deepest submenu, the keyboard back on the item that opened
  // it; on the menu itself, nothing.
  leave(): boolean {
    if (this.levels.length < 2) {
      return false
    }
    this.levels = this.levels.slice(0, this.depth === this.levels.length - 1 ? -1 : this.depth + 1)
    return true
  }

  // Chooses item `i` of level `k`: a submenu opens; an item that does
  // something shuts the menu, the focus back on its target, and then
  // does it; one disabled does nothing.
  choose(k: number, i: number, at?: Point) {
    const it = this.entries(k)[i]
    if (!choosable(it)) {
      return
    }
    if (it.items) {
      this.#set(k, i)
      this.levels = this.levels.slice(0, k + 1)
      if (at) {
        this.enter(at)
      }
      return
    }
    this.close()
    ;(it as Item).onselect?.()
  }

  // A finger held on the target opens it where it rests, once it has
  // stayed long enough without moving; a release or a move first lets it
  // go, so a tap still follows a link and a drag still drags.
  hold(e: PointerEvent, target: HTMLElement | null) {
    if (e.pointerType !== 'touch') {
      return
    }
    this.release()
    const { clientX: x, clientY: y } = e
    this.#pressing = {
      x,
      y,
      timer: setTimeout(() => {
        this.#pressing = null
        this.#pressed = true
        this.show({ x, y, above: y }, target, false)
      }, press),
    }
  }

  drift(e: PointerEvent) {
    if (this.#pressing && Math.hypot(e.clientX - this.#pressing.x, e.clientY - this.#pressing.y) > slop) {
      this.release()
    }
  }

  release() {
    if (this.#pressing) {
      clearTimeout(this.#pressing.timer)
      this.#pressing = null
    }
  }

  // Whether the click now landing is a long press's release, which it
  // swallows once.
  swallow(): boolean {
    const was = this.#pressed
    this.#pressed = false
    return was
  }
}
