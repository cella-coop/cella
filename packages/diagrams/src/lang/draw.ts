// The language's geometry (index.md, the language): the paths its
// particles travel, as SVG path data. Pure functions of their ends, so a
// diagram is the same on every build.

const fixed = (v: number) => v.toFixed(1)

// The unit normal of a segment and its length.
const frame = (x1: number, y1: number, x2: number, y2: number) => {
  const len = Math.hypot(x2 - x1, y2 - y1)
  return { len, nx: -(y2 - y1) / len, ny: (x2 - x1) / len }
}

/** A grant's wavy line: a sine of fixed wavelength and amplitude whose
 * swing eases in and out at its ends, so it leaves and meets its
 * vertices cleanly. */
export function wave(x1: number, y1: number, x2: number, y2: number, amp = 3.8, length = 13) {
  const { len, nx, ny } = frame(x1, y1, x2, y2)
  const n = Math.max(8, Math.round(len / 1.2))
  const ease = Math.min(10, len / 4)
  let d = ''
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const l = t * len
    const a = amp * Math.min(1, l / ease, (len - l) / ease) * Math.sin((l * 2 * Math.PI) / length)
    d += `${i ? 'L' : 'M'}${fixed(x1 + (x2 - x1) * t + nx * a)} ${fixed(y1 + (y2 - y1) * t + ny * a)}`
  }
  return d
}

/** An objection window's zigzag: straight at its ends, sharp between. */
export function zig(x1: number, y1: number, x2: number, y2: number, amp = 4, step = 8) {
  const { len, nx, ny } = frame(x1, y1, x2, y2)
  const n = Math.max(4, Math.round(len / step))
  let d = ''
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const a = i === 0 || i === n ? 0 : i % 2 ? amp : -amp
    d += `${i ? 'L' : 'M'}${fixed(x1 + (x2 - x1) * t + nx * a)} ${fixed(y1 + (y2 - y1) * t + ny * a)}`
  }
  return d
}

/** A straight line, for a request, an answer, a cascade or a record. */
export const straight = (x1: number, y1: number, x2: number, y2: number) => `M${fixed(x1)} ${fixed(y1)}L${fixed(x2)} ${fixed(y2)}`

/** A circle's worldline: two rails, `gap` apart, from `y1` to `y2`. */
export const rails = (x: number, y1: number, y2: number, gap = 4.4) =>
  `M${fixed(x - gap / 2)} ${fixed(y1)}V${fixed(y2)}M${fixed(x + gap / 2)} ${fixed(y1)}V${fixed(y2)}`

/** A point `back` units short of `(x2, y2)` along the segment from
 * `(x1, y1)`, so a line can stop at a glyph's ring instead of crossing it. */
export function short(x1: number, y1: number, x2: number, y2: number, back: number): [number, number] {
  const len = Math.hypot(x2 - x1, y2 - y1)
  const t = Math.max(0, (len - back) / len)
  return [x1 + (x2 - x1) * t, y1 + (y2 - y1) * t]
}
