// Placing a popover against its trigger where the browser lacks CSS
// anchor positioning: below or above it, flipped when that side has no
// room, and shifted along to stay inside the viewport.
const gap = 4
const margin = 8

export function place(pop: HTMLElement, anchor: HTMLElement, side: 'bottom' | 'top') {
  const a = anchor.getBoundingClientRect()
  const p = pop.getBoundingClientRect()
  const below = a.bottom + gap
  const above = a.top - gap - p.height
  const fits = (y: number) => y >= margin && y + p.height <= window.innerHeight - margin
  const top = side === 'bottom' ? (fits(below) || !fits(above) ? below : above) : fits(above) || !fits(below) ? above : below
  const left = Math.min(Math.max(a.left, margin), window.innerWidth - margin - p.width)
  Object.assign(pop.style, { position: 'fixed', inset: 'auto', top: `${Math.max(margin, top)}px`, left: `${left}px` })
}
