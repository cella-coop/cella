// The plate's drawing (index.md, the plate): the technical half of a
// specimen plate, after a neo-Swiss poster: an axis with its scale, orbits,
// construction lines, registration marks and a node, in hairlines of the
// text's ink, and one line and the node's ring in the band's tone. It is
// drawn on a 1440 by 900 field the page slices to its band, its strokes a
// hair at any size. Its only marks are numbers and letters a figure wears.

type Pt = [number, number]

const W = 1440
const H = 900

/** The axis, the node on it and the tone's line through the node. */
const AXIS = 600
const NODE: Pt = [AXIS, 560]
const ORBIT: Pt = [1050, 330]

const line = (a: Pt, b: Pt, cls: string) => `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" class="${cls}"/>`
const circle = (c: Pt, r: number, cls: string) => `<circle cx="${c[0]}" cy="${c[1]}" r="${r}" class="${cls}"/>`
const mark = (c: Pt, s = 7) => line([c[0] - s, c[1]], [c[0] + s, c[1]], 'ink') + line([c[0], c[1] - s], [c[0], c[1] + s], 'ink')
const label = (c: Pt, text: string, cls = 'note') => `<text x="${c[0]}" y="${c[1]}" class="${cls}">${text}</text>`

/** The point at t along the tone's line, from its foot through the node. */
const toneAt = (t: number): Pt => {
  const foot: Pt = [430, H + 20]
  const dir: Pt = [NODE[0] - foot[0], NODE[1] - foot[1]]
  return [foot[0] + dir[0] * t, foot[1] + dir[1] * t]
}

export function drawing(): string {
  const parts: string[] = []
  // construction: a few long hairlines across the field, dashed
  parts.push(line([0, 160], [W, 160], 'faint'))
  parts.push(line([0, NODE[1]], [W, NODE[1]], 'faint'))
  parts.push(line([160, 0], [160, H], 'faint'))
  parts.push(line([0, H], [W * 0.62, 0], 'faint dash'))
  // the orbits, round the picture's upper side
  for (const r of [170, 250, 340]) {
    parts.push(circle(ORBIT, r, 'ink dash'))
  }
  parts.push(circle(ORBIT, 6, 'ink fill'))
  parts.push(line([ORBIT[0] - 380, ORBIT[1]], [ORBIT[0] + 380, ORBIT[1]], 'faint'))
  // the axis and its scale
  parts.push(line([AXIS, 0], [AXIS, H], 'ink strong'))
  for (let y = NODE[1] + 30, k = 0; y < H; y += 12, k++) {
    parts.push(line([AXIS - (k % 5 ? 5 : 11), y], [AXIS, y], 'ink'))
  }
  // the tone's line, through the node and on across the picture
  parts.push(line(toneAt(0), toneAt(2.4), 'tone strong'))
  parts.push(circle(NODE, 46, 'tone soft'))
  parts.push(circle(NODE, 15, 'ink fill'))
  parts.push(line([NODE[0] - 6, NODE[1]], [NODE[0] + 6, NODE[1]], 'paper'))
  parts.push(line([NODE[0], NODE[1] - 6], [NODE[0], NODE[1] + 6], 'paper'))
  // a second line, its own frame, the node's twin up the tone's line
  const twin = toneAt(1.6)
  parts.push(circle(twin, 5, 'tone fill'))
  parts.push(line(NODE, [NODE[0] + 260, NODE[1] - 470], 'ink'))
  // registration marks and their numbers
  for (const c of [[AXIS, 300], [AXIS, 410], [240, 160], [1290, 760], [880, 160]] as Pt[]) {
    parts.push(mark(c))
  }
  parts.push(label([twin[0] + 12, twin[1] + 4], '1'))
  parts.push(label([toneAt(2.1)[0] + 12, toneAt(2.1)[1] + 4], '2'))
  parts.push(label([ORBIT[0] + 258, ORBIT[1] - 8], '2,30'))
  parts.push(label([AXIS + 10, 296], '01'))
  parts.push(label([AXIS + 10, 406], '02'))
  parts.push(label([ORBIT[0] + 14, ORBIT[1] - 14], 'x', 'note big'))
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${parts.join('')}</svg>`
}
