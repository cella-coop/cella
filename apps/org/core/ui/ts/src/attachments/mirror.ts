import type { Attachment } from 'svelte/attachments'

// Scrollers that scroll across as one, as a board's sticky row of column
// headers over its columns: attached to what holds them, each marked
// `data-mirror`; whichever moves across, the others follow. Setting an
// offset a scroller already has fires nothing, so they never echo.
export const mirror: Attachment<HTMLElement> = (node) => {
  const all = () => [...node.querySelectorAll<HTMLElement>(':scope > [data-mirror]')]
  const onscroll = (e: Event) => {
    const from = e.target as HTMLElement
    if (!from.matches?.('[data-mirror]')) {
      return
    }
    for (const el of all()) {
      if (el !== from && el.scrollLeft !== from.scrollLeft) {
        el.scrollLeft = from.scrollLeft
      }
    }
  }
  node.addEventListener('scroll', onscroll, { capture: true, passive: true })
  return () => node.removeEventListener('scroll', onscroll, { capture: true })
}
