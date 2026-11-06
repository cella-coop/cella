// OKLCH to sRGB, as the explorer converts: an out-of-gamut colour is cut
// in chroma at its lightness and hue, by bisection, as a browser maps it,
// so a colour written as hex is the one CSS shows for its oklch().

export type Oklch = [l: number, c: number, h: number]

export const clamp = (x: number, a = 0, b = 1): number => Math.min(b, Math.max(a, x))

function linear([L, C, H]: Oklch): [number, number, number] {
  const h = (H * Math.PI) / 180
  const a = C * Math.cos(h)
  const b = C * Math.sin(h)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
}

const inGamut = (rgb: number[]): boolean => rgb.every((v) => v >= -0.0005 && v <= 1.0005)

/** The colour in linear sRGB, mapped into gamut. */
export function mapped([L, C, H]: Oklch): [number, number, number] {
  const rgb = linear([L, C, H])
  if (inGamut(rgb)) {
    return rgb
  }
  let lo = 0
  let hi = C
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2
    if (inGamut(linear([L, mid, H]))) {
      lo = mid
    } else {
      hi = mid
    }
  }
  const [r, g, b] = linear([L, lo, H]).map((v) => clamp(v))
  return [r, g, b]
}

const encode = (x: number): number => (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055)

/** The colour as 8-bit sRGB. */
export function rgb8(colour: Oklch): [number, number, number] {
  const [r, g, b] = mapped(colour).map((v) => Math.round(clamp(encode(v)) * 255))
  return [r, g, b]
}

export function hex(colour: Oklch): string {
  return `#${rgb8(colour).map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

/** WCAG's relative luminance, and the contrast of two colours. */
export function luminance(colour: Oklch): number {
  const [r, g, b] = mapped(colour)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrast(a: Oklch, b: Oklch): number {
  const x = luminance(a)
  const y = luminance(b)
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}
