// What a demo's countdown shows from the two spans it watches, idle and
// lifetime: the sooner of the two, as seconds left, and whether that is
// close enough to warn about. The idle span alone ever warns, its last
// two minutes, and only where it is in fact the nearer of the two: a
// lifetime ending first keeps its plain style, however little of it is
// left.
export const WARN = 120

// The sooner of the two spans left, `null` read as never.
export function nearer(idleLeft: number, lifeLeft: number | null): number {
  return Math.min(idleLeft, lifeLeft ?? Infinity)
}

// Whether the idle span is both within its last two minutes and the
// nearer of the two.
export function warns(idleLeft: number, lifeLeft: number | null): boolean {
  return idleLeft <= WARN && idleLeft <= (lifeLeft ?? Infinity)
}

// Seconds spoken as `1:59:30`.
export function spoken(seconds: number): string {
  const s = Math.floor(seconds)
  const two = (n: number) => String(n).padStart(2, '0')
  return `${Math.floor(s / 3600)}:${two(Math.floor((s % 3600) / 60))}:${two(s % 60)}`
}
