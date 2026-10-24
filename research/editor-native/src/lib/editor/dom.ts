import type { Run } from '../model/ops.ts'

// The bridge between a block's contenteditable and offsets into its Loro
// text. Offsets are UTF-16, as both the DOM and Loro's JS API count.

// The offset of a DOM point inside a block's editable: the length of the
// text before it. A range's toString counts text nodes only, so the <br>
// that holds an empty line counts nothing.
export function offsetIn(root: HTMLElement, node: Node, offset: number): number {
  if (!root.contains(node)) {
    return root.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_PRECEDING ? 0 : length(root)
  }
  const r = document.createRange()
  r.setStart(root, 0)
  r.setEnd(node, offset)
  return r.toString().length
}

export function length(root: HTMLElement): number {
  return root.textContent?.length ?? 0
}

// The DOM point of an offset: inside the text node that holds it, at the
// end of the earlier node on a boundary, so the caret takes the marks of
// the text before it, as typing will.
export function pointIn(root: HTMLElement, offset: number): [Node, number] {
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let left = offset
  let last: Text | null = null
  for (let n = walk.nextNode() as Text | null; n; n = walk.nextNode() as Text | null) {
    if (left <= n.length) {
      return [n, left]
    }
    left -= n.length
    last = n
  }
  return last ? [last, last.length] : [root, 0]
}

export type Sel = { anchor: number; focus: number; start: number; end: number; collapsed: boolean }

export function readSel(root: HTMLElement): Sel | null {
  const s = document.getSelection()
  if (!s || !s.anchorNode || !s.focusNode || !root.contains(s.anchorNode) || !root.contains(s.focusNode)) {
    return null
  }
  const anchor = offsetIn(root, s.anchorNode, s.anchorOffset)
  const focus = offsetIn(root, s.focusNode, s.focusOffset)
  return { anchor, focus, start: Math.min(anchor, focus), end: Math.max(anchor, focus), collapsed: anchor === focus }
}

export function writeSel(root: HTMLElement, anchor: number, focus = anchor): void {
  const s = document.getSelection()
  if (!s) {
    return
  }
  if (document.activeElement !== root) {
    root.focus({ preventScroll: true })
  }
  const [an, ao] = pointIn(root, anchor)
  const [fn, fo] = pointIn(root, focus)
  s.setBaseAndExtent(an, ao, fn, fo)
}

// Draw a text's runs: one element per mark, link outermost, then bold,
// italic and code. A trailing newline needs a <br> to show its empty line
// under white-space: pre-wrap, and an empty text needs one to hold a caret.
export function paint(root: HTMLElement, runs: Run[]): void {
  const frag = document.createDocumentFragment()
  let all = ''
  for (const r of runs) {
    all += r.text
    let n: Node = document.createTextNode(r.text)
    const m = r.marks ?? {}
    if (m.code) {
      n = wrap('code', n)
    }
    if (m.italic) {
      n = wrap('em', n)
    }
    if (m.bold) {
      n = wrap('strong', n)
    }
    if (typeof m.link === 'string') {
      const a = wrap('a', n) as HTMLAnchorElement
      a.href = m.link
      a.rel = 'noreferrer'
      n = a
    }
    frag.appendChild(n)
  }
  if (all === '' || all.endsWith('\n')) {
    frag.appendChild(document.createElement('br'))
  }
  root.replaceChildren(frag)
  root.toggleAttribute('data-empty', all === '')
}

function wrap(tag: string, child: Node): HTMLElement {
  const el = document.createElement(tag)
  el.appendChild(child)
  return el
}

// The caret's box, or the editable's own when the caret has none (an empty
// line has no client rects in Chromium).
export function caretRect(root: HTMLElement): DOMRect {
  const s = document.getSelection()
  if (s && s.rangeCount) {
    const r = s.getRangeAt(0).cloneRange()
    r.collapse(s.focusNode === r.startContainer && s.focusOffset === r.startOffset)
    const rect = r.getClientRects()[0] ?? r.getBoundingClientRect()
    if (rect && (rect.width || rect.height)) {
      return rect
    }
  }
  return root.getBoundingClientRect()
}

function line(root: HTMLElement): number {
  return parseFloat(getComputedStyle(root).lineHeight) || 20
}

export function onFirstLine(root: HTMLElement): boolean {
  return caretRect(root).top < root.getBoundingClientRect().top + line(root) * 0.75
}

export function onLastLine(root: HTMLElement): boolean {
  return caretRect(root).bottom > root.getBoundingClientRect().bottom - line(root) * 0.75
}

// The offset under a point inside an editable, for moving the caret between
// blocks at the same x.
export function offsetAt(root: HTMLElement, x: number, y: number): number {
  const d = document as Document & { caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null }
  const p = d.caretPositionFromPoint?.(x, y)
  if (p && root.contains(p.offsetNode)) {
    return offsetIn(root, p.offsetNode, p.offset)
  }
  const r = document.caretRangeFromPoint?.(x, y)
  if (r && root.contains(r.startContainer)) {
    return offsetIn(root, r.startContainer, r.startOffset)
  }
  return y < root.getBoundingClientRect().top ? 0 : length(root)
}
