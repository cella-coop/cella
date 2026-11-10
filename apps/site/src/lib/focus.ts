// What a photo is of (index.md, figures): the regions a figure's cluster
// grows its largest cells round, whole and centred. The operator's own,
// a photo's sidecar `focus`, where given; otherwise found at build, in
// tiers, the best a figure's cut shows taken: its faces with the people
// no face was found on, then its hands at work, its people, and where
// none of them shows, the peaks of its interest, its detail. Faces, hands
// and people are found by Human's detectors, their weights shipped in
// its package, run on TensorFlow's WASM backend: offline, no native
// build. Found once and cached as the engravings are.
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import sharp from 'sharp'
import type { Focus as BoxFocus, Grid } from '@cella/brand'
import { ratio } from './engrave'
import { interest, VERSION as INTEREST } from './interest'

/** A region of a photo: its centre in fractions of its width and height,
 * its radius in fractions of its width. */
export type Focus = { x: number; y: number; r: number }

/** A region found in a photo, what found it and how sure it is. */
export type Found = Focus & { kind: 'face' | 'person' | 'hand' | 'detail'; score: number }

const CACHE = join(process.cwd(), '.astro/focus')
// A change to how a photo's focus is found bumps it, as one to how its
// interest is measured bumps that, so none stale is reused
const VERSION = 6

// How sure a detector must be for its face, person or hand to count. A
// face less sure than SURE counts only on skin, held by a person found
// round it; a person less sure than PERSON only vouches for a face
const FACE = 0.3
const SURE = 0.45
const PERSON = 0.35
const VOUCH = 0.25
const HAND = 0.5

const file = (name: string, ext: string) => {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
    throw new Error(`invalid photo name: ${name}`)
  }
  return join(process.cwd(), 'src/photos', `${name}.${ext}`)
}

/** Every region found in a photo, faces, people, hands and its detail. */
export async function found(name: string): Promise<Found[]> {
  const cached = join(CACHE, `${name}-${statSync(file(name, 'jpg')).mtimeMs}-${VERSION}.${INTEREST}.json`)
  if (existsSync(cached)) {
    return JSON.parse(readFileSync(cached, 'utf8')) as Found[]
  }
  const out = [...(await detect(name)), ...peaks(await interest(name))]
  mkdirSync(CACHE, { recursive: true })
  writeFileSync(cached, JSON.stringify(out))
  return out
}

/** A tier of a photo's focus: its regions, taken where one of its leads
 * shows, so the people round a face count only beside it. */
type Tier = { regions: Focus[]; leads: Focus[] }

/** A photo's focus in tiers, the best first: its sidecar's alone, or the
 * faces found in it with the people no face was found on, its hands at
 * work, its people, its detail. */
async function tiers(name: string): Promise<Tier[]> {
  const meta = JSON.parse(readFileSync(file(name, 'json'), 'utf8')) as { focus?: Focus[] }
  if (meta.focus?.length) {
    return [{ regions: meta.focus, leads: meta.focus }]
  }
  const all = await found(name)
  const of = (kind: Found['kind']) => all.filter((f) => f.kind === kind).map(({ x, y, r }) => ({ x, y, r }))
  const [faces, people, hands, detail] = [of('face'), of('person'), of('hand'), of('detail')]
  return [
    { regions: [...faces, ...people], leads: faces },
    { regions: hands, leads: hands },
    { regions: people, leads: people },
    { regions: detail, leads: detail },
  ].filter((t) => t.leads.length)
}

/** A photo's focus: its sidecar's, or the best tier found in it. */
export async function focus(name: string): Promise<Focus[]> {
  return (await tiers(name))[0]?.regions ?? []
}

/** A photo's focus in a figure's box, w by h, that the photo covers as the
 * figure lays it, centred and cut to fill: the best tier one of whose
 * leads the box shows, a region shown when its middle lies inside the
 * box by a quarter of its radius; a region the box cuts more of is left
 * out, as is one a third the size of the largest shown. So a cut that
 * loses a photo's faces to its edges holds its hands. */
export async function focusIn(name: string, w: number, h: number): Promise<BoxFocus[]> {
  const [r, all] = await Promise.all([ratio(name), tiers(name)])
  const tall = Math.max(h, w / r)
  const [pw, ox, oy] = [tall * r, (w - tall * r) / 2, (h - tall) / 2]
  const box = (f: Focus) => ({ x: ox + f.x * pw, y: oy + f.y * tall, r: f.r * pw })
  const shows = (f: BoxFocus) => Math.min(f.x, w - f.x, f.y, h - f.y) > f.r / 4
  for (const { regions, leads } of all) {
    if (leads.map(box).some(shows)) {
      // the crowd behind a photo's subject is not what it is of: a region
      // a third the size of the largest shown is left to the small cells
      const shown = regions.map(box).filter(shows)
      const top = Math.max(...shown.map((f) => f.r))
      return shown.filter((f) => f.r >= top / 3)
    }
  }
  return []
}

// The photo is read 1024 wide, as the detectors' own inputs are smaller
const READ = 1024

type Box = { box: number[]; score: number }
type Human = {
  load: () => Promise<void>
  detect: (input: unknown) => Promise<{ face: Box[]; hand: Box[]; object: (Box & { label: string })[] }>
  tf: { tensor4d: (data: Int32Array, shape: number[], dtype: string) => { dispose: () => void } }
}

let human: Promise<Human> | undefined
// one photo at a time through the detectors
let queue: Promise<unknown> = Promise.resolve()

/** The faces, people and hands Human finds in a photo. */
async function detect(name: string): Promise<Found[]> {
  human ??= load()
  const run = queue.then(async () => {
    const model = await human!
    const { data, info } = await sharp(readFileSync(file(name, 'jpg'))).resize({ width: READ }).removeAlpha().raw().toBuffer({ resolveWithObject: true })
    const { width: w, height: h } = info
    const input = model.tf.tensor4d(Int32Array.from(data), [1, h, w, 3], 'int32')
    try {
      const result = await model.detect(input)
      const people = result.object.filter((o) => o.label === 'person' && o.score >= VOUCH)
      // a face's box, x y w h in pixels, as the circle round the face in
      // it: the detector's box is half as tall again as the face. One it
      // is unsure of counts only on skin, held by a person: a cup, a
      // watch or a map is no face. A person as large as the photo holds
      // nothing
      const holds = (box: number[], f: Focus) => box[2] * box[3] < 0.8 * w * h && within(f, box, w, h)
      const circle = ([x, y, bw, bh]: number[], score: number, kind: Found['kind']) => ({ kind, score, x: (x + bw / 2) / w, y: (y + bh / 2) / h, r: (Math.max(bw, bh) * 0.38) / w })
      const faces = result.face
        .filter((f) => f.score >= FACE)
        .map((f) => ({ ...circle(f.box, f.score, 'face'), skin: skin(data, w, h, f.box) }))
        .filter((f) => f.score >= SURE || (f.skin >= 0.2 && people.some((p) => holds(p.box, f))))
        .map(({ skin: _, ...f }) => f)
      // a hand at work, the circle round its box, a little wider
      const hands = result.hand.filter((o) => o.score >= HAND).map((o) => ({ ...circle(o.box, o.score, 'hand'), r: (Math.max(o.box[2], o.box[3]) * 0.6) / w }))
      // a person's head, the top of their box, unless a face was found in
      // it or the box runs off the photo's top, where their head is cut off
      const heads = people
        .filter((o) => o.score >= PERSON && o.box[1] > h * 0.02)
        .map((o) => {
          const [x, y, bw, bh] = o.box
          const r = Math.min(bw, bh) * 0.35
          return { kind: 'person' as const, score: o.score, x: (x + bw / 2) / w, y: (y + Math.min(bh * 0.2, r * 1.2)) / h, r: r / w, box: o.box }
        })
        .filter((p) => !faces.some((f) => within(f, p.box, w, h)))
        .map(({ box: _, ...p }) => p)
      return [...faces, ...heads, ...hands]
    } finally {
      input.dispose()
    }
  })
  queue = run.catch(() => undefined)
  return run
}

/** Whether a region's centre lies within a box in pixels. */
function within(f: Focus, [x, y, bw, bh]: number[], w: number, h: number) {
  return f.x * w >= x && f.x * w <= x + bw && f.y * h >= y && f.y * h <= y + bh
}

/** The share of a box's middle, its inner three fifths, whose colour is
 * like skin, in the photo's pixels, RGB, w by h. Skin sits in a narrow
 * band of chroma whatever its tone, as interest.ts reads it. */
function skin(data: Buffer, w: number, h: number, [bx, by, bw, bh]: number[]) {
  let [hit, all] = [0, 0]
  for (let y = Math.max(0, Math.round(by + bh * 0.2)); y < Math.min(h, by + bh * 0.8); y += 2) {
    for (let x = Math.max(0, Math.round(bx + bw * 0.2)); x < Math.min(w, bx + bw * 0.8); x += 2) {
      const i = (y * w + x) * 3
      const [r, g, b] = [data[i], data[i + 1], data[i + 2]]
      const lum = 0.299 * r + 0.587 * g + 0.114 * b
      const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b
      const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b
      hit += Math.exp(-(((cb - 108) / 14) ** 2 + ((cr - 150) / 11) ** 2) / 2) * Math.min(1, lum / 60) > 0.3 ? 1 : 0
      all++
    }
  }
  return hit / Math.max(all, 1)
}

/** Human on TensorFlow's WASM backend, its face, hand and object
 * detectors, their weights read from its package. */
async function load(): Promise<Human> {
  // resolved at run time from the site, never bundled by Vite
  const require = createRequire(join(process.cwd(), 'package.json'))
  const root = dirname(dirname(require.resolve('@vladmandic/human')))
  const wasm = dirname(require.resolve('@tensorflow/tfjs-backend-wasm'))
  const { Human } = require(join(root, 'dist/human.node-wasm.js'))
  const model: Human = new Human({
    backend: 'wasm',
    wasmPath: `${pathToFileURL(wasm).href}/`,
    modelBasePath: `${pathToFileURL(join(root, 'models')).href}/`,
    debug: false,
    warmup: 'none',
    cacheSensitivity: 0,
    filter: { enabled: false },
    face: { enabled: true, detector: { rotation: false, maxDetected: 30, minConfidence: FACE }, mesh: { enabled: false }, iris: { enabled: false }, description: { enabled: false }, emotion: { enabled: false }, antispoof: { enabled: false }, liveness: { enabled: false }, attention: { enabled: false } },
    body: { enabled: false },
    // the hand detector returns its boxes only once their skeletons are
    // fitted, so its landmarks run though only the boxes are read
    hand: { enabled: true, rotation: false, minConfidence: 0.2, iouThreshold: 0.2, maxDetected: 20, landmarks: true },
    object: { enabled: true, minConfidence: VOUCH, maxDetected: 40 },
    gesture: { enabled: false },
    segmentation: { enabled: false },
  })
  // Human reads its weights by fetch, and Node's fetch reads no file: a
  // file URL is answered from the disk while it loads
  const fetch = globalThis.fetch
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const href = typeof url === 'string' ? url : url instanceof URL ? url.href : url.url
    if (href.startsWith('file:')) {
      return new Response(readFileSync(new URL(href)))
    }
    return fetch(url, init)
  }) as typeof fetch
  try {
    await model.load()
  } finally {
    globalThis.fetch = fetch
  }
  return model
}

/** The peaks of a photo's interest, at most three and none below 0.7 of
 * the highest, each the region round it where the interest stays above
 * two thirds of the peak, and none overlapping a stronger one. */
function peaks(grid: Grid): Found[] {
  const { w, h, data } = grid
  const at = (i: number, j: number) => (i < 0 || j < 0 || i >= w || j >= h ? 0 : data[j * w + i])
  const out: Found[] = []
  const taken = (i: number, j: number) => out.some((p) => Math.hypot(p.x * w - i, p.y * h - j) < p.r * w * 2)
  const order = Array.from(data, (v, k) => [v, k] as const).sort((p, q) => q[0] - p[0])
  for (const [v, k] of order) {
    if (out.length >= 3 || v < 0.7 * order[0][0]) {
      break
    }
    const [i, j] = [k % w, Math.floor(k / w)]
    if (taken(i, j)) {
      continue
    }
    // how far the peak's region reaches, the mean over eight directions
    let reach = 0
    for (let d = 0; d < 8; d++) {
      const [dx, dy] = [Math.cos((d * Math.PI) / 4), Math.sin((d * Math.PI) / 4)]
      let s = 1
      while (s < w / 4 && at(Math.round(i + dx * s), Math.round(j + dy * s)) > v * 0.67) {
        s++
      }
      reach += s / 8
    }
    // a region that would overlap a stronger one is the same subject's,
    // and two cells would split it
    if (out.some((p) => Math.hypot(p.x * w - i - 0.5, p.y * h - j - 0.5) < p.r * w + Math.max(reach, 2))) {
      continue
    }
    out.push({ kind: 'detail', score: v, x: (i + 0.5) / w, y: (j + 0.5) / h, r: Math.max(reach, 2) / w })
  }
  return out
}
