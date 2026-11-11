// The little of fontkit and wawoff2 a card's text is set with (lib/card.ts):
// a variable face at a weight, laid out as glyphs whose outlines are paths.
declare module 'fontkit' {
  interface Path {
    scale(x: number, y: number): Path
    translate(x: number, y: number): Path
    toSVG(): string
  }
  interface Glyph {
    path: Path
  }
  interface Run {
    glyphs: Glyph[]
    positions: { xAdvance: number }[]
    advanceWidth: number
  }
  interface Font {
    unitsPerEm: number
    getVariation(axes: Record<string, number>): Font
    layout(text: string): Run
  }
  export function create(buffer: Buffer): Font
}

declare module 'wawoff2' {
  const woff2: { decompress(buffer: Uint8Array): Promise<Uint8Array> }
  export default woff2
}
