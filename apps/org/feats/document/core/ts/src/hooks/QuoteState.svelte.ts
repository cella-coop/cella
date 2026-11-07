// What a comment quotes: the text last selected in the draft, inside one
// block, as a quote's anchor is; the comment box's Quoting takes it, and
// the member may still write over it.
export class QuoteState {
  text = $state('')

  constructor() {
    $effect(() => {
      const seen = () => {
        const s = document.getSelection()
        if (!s || s.isCollapsed || !s.anchorNode || !s.focusNode) {
          return
        }
        const block = (n: Node) => (n instanceof Element ? n : n.parentElement)?.closest('[data-editor] [data-block]')
        const a = block(s.anchorNode)
        if (a && a === block(s.focusNode)) {
          this.text = s.toString()
        }
      }
      document.addEventListener('selectionchange', seen)
      return () => document.removeEventListener('selectionchange', seen)
    })
  }
}
