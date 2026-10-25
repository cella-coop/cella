// A PDF of text and rules, written by hand: A4 pages in Helvetica and
// Helvetica-Bold, two of the fourteen fonts every reader has, so nothing
// is embedded. Text is encoded in WinAnsi, which holds French, the euro
// sign and typographic quotes; the content is left uncompressed, and the
// same document always makes the same bytes.

// A4, in points.
export const A4 = { width: 595.28, height: 841.89 }

export interface Style {
  size?: number
  bold?: boolean
  // Where `x` stands: the text's start, or its end.
  align?: 'left' | 'right'
  // A grey from 0, black, to 1, white.
  grey?: number
}

// The advance of each printable ASCII character, in thousandths of the
// size, from Adobe's metrics for the two fonts. An accented letter takes
// its letter's; the few others WinAnsi adds are in `extra`.
const helvetica = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278,
  584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944,
  667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500,
  278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
]
const bold = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333,
  584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944,
  667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556,
  333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
]
const extra: Record<string, [number, number]> = {
  '€': [556, 556],
  '’': [222, 278],
  '‘': [222, 278],
  '“': [333, 500],
  '”': [333, 500],
  '«': [556, 556],
  '»': [556, 556],
  '–': [556, 556],
  '—': [1000, 1000],
  '…': [1000, 1000],
  '•': [350, 350],
  '°': [400, 400],
  '×': [584, 584],
  'œ': [944, 944],
  'Œ': [1000, 1000],
  'ß': [611, 611],
  ' ': [278, 278],
}

// WinAnsi's characters beyond Latin-1, by code.
const winansi: Record<string, number> = {
  '€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85, '†': 0x86, '‡': 0x87, 'ˆ': 0x88, '‰': 0x89, 'Š': 0x8a, '‹': 0x8b,
  'Œ': 0x8c, 'Ž': 0x8e, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97, '˜': 0x98, '™': 0x99,
  'š': 0x9a, '›': 0x9b, 'œ': 0x9c, 'ž': 0x9e, 'Ÿ': 0x9f,
}

// The thin and narrow spaces French figures use print as a no-break space.
const spaces = /[   ]/g

// A character's code in WinAnsi, or `?` where it has none.
function code(c: string): number {
  const n = c.codePointAt(0) ?? 63
  if ((n >= 0x20 && n < 0x7f) || (n >= 0xa0 && n <= 0xff)) {
    return n
  }
  return winansi[c] ?? 63
}

// A character's advance in thousandths of the size.
function advance(c: string, heavy: boolean): number {
  const known = extra[c]
  if (known) {
    return known[heavy ? 1 : 0]
  }
  const letter = c.normalize('NFD')[0]
  const n = letter.codePointAt(0) ?? 63
  const table = heavy ? bold : helvetica
  return n >= 0x20 && n < 0x7f ? table[n - 0x20] : table['?'.charCodeAt(0) - 0x20]
}

// How wide a text prints, in points.
export function width(text: string, style: Style = {}): number {
  const size = style.size ?? 10
  let sum = 0
  for (const c of text.replace(spaces, ' ')) {
    sum += advance(c, style.bold ?? false)
  }
  return (sum * size) / 1000
}

// A text broken into lines no wider than `room`, at its spaces; a word
// wider than the room stands on a line of its own.
export function wrap(text: string, room: number, style: Style = {}): string[] {
  const lines: string[] = []
  for (const paragraph of text.split('\n')) {
    let line = ''
    for (const word of paragraph.split(' ')) {
      const next = line ? `${line} ${word}` : word
      if (line && width(next, style) > room) {
        lines.push(line)
        line = word
      } else {
        line = next
      }
    }
    lines.push(line)
  }
  return lines
}

// A PDF string literal's body, in WinAnsi, with its delimiters escaped.
function literal(text: string): string {
  let out = ''
  for (const c of text.replace(spaces, ' ')) {
    const n = code(c)
    out += n === 0x28 || n === 0x29 || n === 0x5c ? `\\${c}` : String.fromCharCode(n)
  }
  return out
}

const num = (n: number) => String(Math.round(n * 100) / 100)

// One page: text and rules placed in points from its bottom-left corner.
export class Page {
  readonly ops: string[] = []

  text(x: number, y: number, text: string, style: Style = {}) {
    const size = style.size ?? 10
    const at = style.align === 'right' ? x - width(text, style) : x
    const grey = style.grey ?? 0
    this.ops.push(`BT ${num(grey)} g /${style.bold ? 'F2' : 'F1'} ${num(size)} Tf ${num(at)} ${num(y)} Td (${literal(text)}) Tj ET`)
  }

  // A rule from one point to another.
  rule(x1: number, y1: number, x2: number, y2: number, thickness = 0.5, grey = 0) {
    this.ops.push(`${num(grey)} G ${num(thickness)} w ${num(x1)} ${num(y1)} m ${num(x2)} ${num(y2)} l S`)
  }

  // A filled rectangle, as a band behind a table's header.
  fill(x: number, y: number, w: number, h: number, grey: number) {
    this.ops.push(`${num(grey)} g ${num(x)} ${num(y)} ${num(w)} ${num(h)} re f`)
  }
}

// A document: its pages, in order, and its title.
export class Pdf {
  readonly pages: Page[] = []
  readonly title: string

  constructor(title: string) {
    this.title = title
  }

  page(): Page {
    const p = new Page()
    this.pages.push(p)
    return p
  }

  // The file: a catalog, the page tree, the two fonts, then each page and
  // its content, and the cross-reference table that finds every object.
  bytes(): Uint8Array {
    const objects: string[] = []
    const add = (body: string) => objects.push(body)
    const kids = this.pages.map((_, i) => `${5 + i * 2} 0 R`).join(' ')
    add('<< /Type /Catalog /Pages 2 0 R >>')
    add(`<< /Type /Pages /Kids [${kids}] /Count ${this.pages.length} >>`)
    add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>')
    add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>')
    for (const [i, p] of this.pages.entries()) {
      add(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4.width} ${A4.height}] ` +
          `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${6 + i * 2} 0 R >>`,
      )
      const stream = p.ops.join('\n')
      add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`)
    }
    add(`<< /Title (${literal(this.title)}) /Producer (cella) >>`)
    const info = objects.length
    let out = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n'
    const offsets: number[] = []
    for (const [i, body] of objects.entries()) {
      offsets.push(out.length)
      out += `${i + 1} 0 obj\n${body}\nendobj\n`
    }
    const xref = out.length
    out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
    out += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')
    out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`
    return Uint8Array.from(out, (c) => c.charCodeAt(0))
  }
}
