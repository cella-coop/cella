import { onMount } from 'svelte'

// What a comment quotes: the text selected in the draft, inside one block,
// as a quote's anchor is, and where its end is on screen, so the button
// that opens the comment box floats there. The box keeps the quote it was
// opened on until it is closed, or the page has a new comment (its count
// moves), which closes it. The selection is the browser's, so it is
// followed from the block's mount.
export class QuoteState {
  text = $state('')
  at = $state<{ x: number; y: number } | null>(null)
  #opened = $state<number | null>(null)
  #count: () => number
  #quote = $state('')

  constructor(count: () => number) {
    this.#count = count
    onMount(() => {
      const block = (n: Node) => (n instanceof Element ? n : n.parentElement)?.closest('[data-editor] [data-block]')
      const seen = () => {
        if (this.open) {
          return
        }
        const s = document.getSelection()
        const a = s?.anchorNode
        const f = s?.focusNode
        const here = !!s && !s.isCollapsed && !!a && !!f && !!block(a) && block(a) === block(f)
        if (!here) {
          this.text = ''
          this.at = null
          return
        }
        const rects = s.getRangeAt(0).getClientRects()
        const end = rects[rects.length - 1]
        this.text = s.toString()
        this.at = end ? { x: end.right + 8, y: end.top - 2 } : null
      }
      // The point is viewport-fixed, so it follows the page as it scrolls.
      document.addEventListener('selectionchange', seen)
      document.addEventListener('scroll', seen, true)
      return () => {
        document.removeEventListener('selectionchange', seen)
        document.removeEventListener('scroll', seen, true)
      }
    })
  }

  get open(): boolean {
    return this.#opened !== null && this.#opened === this.#count()
  }

  // The quote the box is on.
  get quote(): string {
    return this.#quote
  }

  begin() {
    this.#quote = this.text
    this.#opened = this.#count()
    this.at = null
  }

  close() {
    this.#opened = null
    this.text = ''
  }
}
