import type { Attachment } from 'svelte/attachments'
import { actionCell, actionPath, type ActionEnd } from '@cella/brand'

// A button drawn as one of the brand's cells (`@cella/brand`'s
// `actions.ts`), the site's row of actions at the shell's size. Its run
// is the buttons beside it on its line, siblings no further apart than a
// small gap; a run holding a filled button is drawn as one row of cells,
// its two ends pointed and each pair sharing a slanted edge across the
// middle of the gap between them, and a run of quiet buttons alone stays
// plain. Each button draws its own cell in its own svg, so the shapes
// need no container; one no longer drawn has its path cleared, since the
// cell it drew before, at another tone's padding, would show from under
// its box.
//
// The buttons beside one another are drawn together, so their layout is
// read once and their cells written after: a document keeps one
// ResizeObserver for every cell and its parent, and each parent one
// MutationObserver for its children coming and going and changing tone,
// held while it has a cell; a change marks the parent, and the next frame
// draws every parent marked, all reads first, then all writes. The tilt
// is the middle of the site's seeded range, alternating edge by edge from
// the run's inline start as the site's does, mirrored right to left; the
// gutter is its width at this size.

const TILT = 0.2
const GUTTER = 0.125
// how far apart two buttons stand and still share an edge, in px
const NEAR = 12

const f = (v: number) => v.toFixed(1)

type Parent = { cells: Set<HTMLElement>; seen: MutationObserver }
type Page = { sized: ResizeObserver; parents: Map<HTMLElement, Parent>; marked: Set<HTMLElement>; frame: number }

// A document's observers are held by the document itself, under a key
// of this module's, so the module keeps no state of its own; an
// attachment never runs on the server.
const PAGE = Symbol('cella cells')
type Held = Document & { [PAGE]?: Page }

const shaped = (el: Element): el is HTMLElement => el instanceof HTMLElement && el.dataset.cell !== undefined

// A cell's box in its parent, and where its svg stands in it, which the
// button's own padding and gap set
type Box = { el: HTMLElement; left: number; right: number; top: number; h: number; at: [number, number] }

function box(el: HTMLElement): Box {
  const outer = el.getBoundingClientRect()
  const svg = el.querySelector(':scope > svg')?.getBoundingClientRect() ?? outer
  // a scaled ancestor, as a dialog opening, scales both rectangles
  const scale = outer.width / el.offsetWidth || 1
  const at: [number, number] = [(svg.left - outer.left) / scale, (svg.top - outer.top) / scale]
  return { el, left: el.offsetLeft, right: el.offsetLeft + el.offsetWidth, top: el.offsetTop, h: el.offsetHeight, at }
}

// An element whose children stand in its parent's run, as a form that is
// its one button, drawn with no box of its own (`display: contents`).
const through = (el: Element): el is HTMLElement => el instanceof HTMLElement && el.dataset.through !== undefined

// What stands in a parent's run, in order: its children, and those of a
// child it passes through.
const items = (parent: Element): Element[] => [...parent.children].flatMap((el) => (through(el) ? items(el) : [el]))

// The parent a cell's run is read in: the nearest ancestor it is not
// passed through.
const runOf = (el: HTMLElement): HTMLElement | null => {
  let parent = el.parentElement
  while (parent && through(parent)) {
    parent = parent.parentElement
  }
  return parent
}

// A parent's cells as runs, in inline order, from one read of its layout.
// What takes no room and is no cell, as a hidden value a form posts,
// breaks no run.
function runs(parent: HTMLElement, rtl: boolean): Box[][] {
  const out: Box[][] = []
  for (const el of items(parent)) {
    if (!shaped(el) && el instanceof HTMLElement && !el.offsetWidth && !el.offsetHeight) {
      continue
    }
    if (!shaped(el) || !el.offsetWidth) {
      out.push([])
      continue
    }
    const b = box(el)
    const run = out[out.length - 1]
    const prev = run?.[run.length - 1]
    const gap = prev && (rtl ? prev.left - b.right : b.left - prev.right)
    if (prev && prev.top === b.top && prev.h === b.h && gap !== undefined && gap >= 0 && gap <= NEAR) {
      run.push(b)
    } else {
      out.push([b])
    }
  }
  return out.filter((r) => r.length)
}

type Plan = { el: HTMLElement; d?: string; at?: [number, number] }

// What each cell of a run draws: nothing, in a run with no filled button.
function plan(run: Box[], rtl: boolean): Plan[] {
  if (!run.some((b) => b.el.dataset.cell === 'fill')) {
    return run.map((b) => ({ el: b.el }))
  }
  return run.map((b, i) => {
    const w = b.right - b.left
    const h = b.h
    // the edge before cell k in inline order, between it and the cell
    // before it, its middle in the middle of the gap
    const edge = (k: number): ActionEnd => {
      const [a, c] = rtl ? [run[k], run[k - 1]] : [run[k - 1], run[k]]
      return { tilt: (k % 2 ? 1 : -1) * (rtl ? -1 : 1) * h * TILT, gutter: h * GUTTER, at: (c.left - a.right) / 2 }
    }
    const start: ActionEnd = i === 0 ? { point: 0.5 } : edge(i)
    const end: ActionEnd = i === run.length - 1 ? { point: 0.5 } : edge(i + 1)
    const [left, right] = rtl ? [end, start] : [start, end]
    return { el: b.el, d: actionPath(actionCell(0, w, h, left, right), h, f), at: b.at }
  })
}

function draw(page: Page) {
  page.frame = 0
  const marked = [...page.marked].filter((p) => p.isConnected)
  page.marked.clear()
  const plans = marked.flatMap((parent) => {
    const cells = [...(page.parents.get(parent)?.cells ?? [])]
    if (!cells.some((c) => c.dataset.cell === 'fill')) {
      return cells.map((el): Plan => ({ el }))
    }
    const rtl = getComputedStyle(parent).direction === 'rtl'
    const drawn = runs(parent, rtl).flatMap((run) => plan(run, rtl))
    // a cell out of every run, hidden or no longer shaped, is plain
    const planned = new Set(drawn.map((p) => p.el))
    return [...drawn, ...cells.filter((c) => !planned.has(c)).map((el): Plan => ({ el }))]
  })
  for (const { el, d, at } of plans) {
    const path = el.querySelector(':scope > svg > path')
    if (d && at && path) {
      // drawn in the button's box, moved back to where its svg stands
      path.setAttribute('d', d)
      path.setAttribute('transform', `translate(${f(-at[0])} ${f(-at[1])})`)
      el.dataset.drawn = ''
    } else {
      path?.removeAttribute('d')
      delete el.dataset.drawn
    }
  }
}

function mark(page: Page, parent: HTMLElement) {
  page.marked.add(parent)
  if (!page.frame) {
    page.frame = requestAnimationFrame(() => draw(page))
  }
}

function pageOf(doc: Held): Page {
  const known = doc[PAGE]
  if (known) {
    return known
  }
  const page: Page = {
    sized: new ResizeObserver((entries) => {
      for (const { target } of entries) {
        const parent = page.parents.has(target as HTMLElement) ? (target as HTMLElement) : runOf(target as HTMLElement)
        if (parent && page.parents.has(parent)) {
          mark(page, parent)
        }
      }
    }),
    parents: new Map(),
    marked: new Set(),
    frame: 0,
  }
  doc[PAGE] = page
  return page
}

export const cell: Attachment<HTMLElement> = (el) => {
  const parent = runOf(el)
  if (!shaped(el) || !parent) {
    return
  }
  const page = pageOf(el.ownerDocument)
  let held = page.parents.get(parent)
  if (!held) {
    const seen = new MutationObserver(() => mark(page, parent))
    seen.observe(parent, { childList: true, subtree: parent !== el.parentElement })
    held = { cells: new Set(), seen }
    page.parents.set(parent, held)
    page.sized.observe(parent, { box: 'border-box' })
  }
  held.cells.add(el)
  held.seen.observe(el, { attributes: true, attributeFilter: ['data-cell'] })
  page.sized.observe(el, { box: 'border-box' })
  mark(page, parent)
  const own = held
  return () => {
    page.sized.unobserve(el)
    own.cells.delete(el)
    delete el.dataset.drawn
    if (!own.cells.size) {
      own.seen.disconnect()
      page.sized.unobserve(parent)
      page.parents.delete(parent)
      page.marked.delete(parent)
    } else {
      mark(page, parent)
    }
  }
}
