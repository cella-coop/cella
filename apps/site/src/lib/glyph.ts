// A band's icon engraved (index.md, bands): Phosphor's filled glyph cut
// from rippled horizontal lines, as a photo is (engrave.ts), each line
// swelling and thinning slowly down the glyph, the ripple's phase the
// band's own by its seed. In the icon's 256 units.
import { rng } from '@cella/brand'

const SIZE = 256
const PITCH = 6.4
const WAVE = 44
const AMP = 1.3

const f = (v: number) => v.toFixed(1)

/** The lines, each a path and its width, to clip to the glyph. */
export function engravedLines(seed: number) {
  const r = rng((seed * 2654435761) >>> 0)
  const phase = r() * WAVE
  const drift = r() * Math.PI * 2
  const lines: { d: string; width: number }[] = []
  for (let y = PITCH / 2, i = 0; y < SIZE; y += PITCH, i++) {
    // a ripple made of quarter-waves, its crests alternating side
    let d = `M${f(-WAVE + phase - WAVE)} ${f(y)}`
    for (let x = -WAVE + phase - WAVE, k = 0; x < SIZE + WAVE; x += WAVE / 2, k++) {
      const crest = k % 2 ? -AMP : AMP
      d += `Q${f(x + WAVE / 4)} ${f(y + crest * 2)} ${f(x + WAVE / 2)} ${f(y)}`
    }
    // the burin's pressure: the lines swell and thin slowly down the glyph
    const width = 1.6 + 1.5 * (0.5 + 0.5 * Math.sin(i * 0.33 + drift))
    lines.push({ d, width })
  }
  return lines
}
