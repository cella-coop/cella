import { onMount } from 'svelte'

// What a comment quotes, if anything: the text selected in the draft,
// inside one block, as a quote's anchor is, and where its end is on
// screen, so the button that attaches it to the comment box floats there.
// The box keeps the quote attached until it is dropped, another is
// attached, or the page has a new comment (its count moves), which posted
// it. The selection is the browser's, so it is followed from the block's
// mount.
export class QuoteState {
  text = $state('')
  at = $state<{ x: number; y: number } | null>(null)
  #count: () => number
  #quote = $state<{ text: string; count: number } | null>(null)

  constructor(count: () => number) {
    this.#count = count
    onMount(() => {
      const block = (n: Node) => (n instanceof Element ? n : n.parentElement)?.closest('[data-editor] [data-block]')
      const seen = () => {
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

  // The quote attached to the box, or null for a comment on the whole.
  get quote(): string | null {
    const q = this.#quote
    return q && q.count === this.#count() ? q.text : null
  }

  attach() {
    this.#quote = { text: this.text, count: this.#count() }
    this.at = null
  }

  drop() {
    this.#quote = null
  }
}
