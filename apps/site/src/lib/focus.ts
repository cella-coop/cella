// What a photo is of (index.md, figures): the regions a figure's cluster
// grows its largest cells round, whole and centred. The operator's own,
// a photo's sidecar `focus`, where given; otherwise found at build, its
// faces first, then the people no face was found on, and where there is
// neither, the peaks of its interest, its detail and skin. Faces and
// people are found by Human's detectors, their weights shipped in its
// package, run on TensorFlow's WASM backend: offline, no native build.
// Found once and cached as the engravings are.
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import sharp from 'sharp'
import type { Focus as BoxFocus, Grid } from '@cella/brand'
import { ratio } from './engrave'
import { interest } from './interest'

/** A region of a photo: its centre in fractions of its width and height,
 * its radius in fractions of its width. */
export type Focus = { x: number; y: number; r: number }

/** A region found in a photo, what found it and how sure it is. */
export type Found = Focus & { kind: 'face' | 'person' | 'detail'; score: number }

const CACHE = join(process.cwd(), '.astro/focus')
// A change to how a photo's focus is found bumps it, so none stale is reused
const VERSION = 3

// How sure a detector must be for its face or person to count
const FACE = 0.3
const PERSON = 0.35

const file = (name: string, ext: string) => {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
    throw new Error(`invalid photo name: ${name}`)
  }
  return join(process.cwd(), 'src/photos', `${name}.${ext}`)
}

/** Every region found in a photo, faces, people and its detail. */
export async function found(name: string): Promise<Found[]> {
  const cached = join(CACHE, `${name}-${statSync(file(name, 'jpg')).mtimeMs}-${VERSION}.json`)
  if (existsSync(cached)) {
    return JSON.parse(readFileSync(cached, 'utf8')) as Found[]
  }
  const out = [...(await detect(name)), ...peaks(await interest(name))]
  mkdirSync(CACHE, { recursive: true })
  writeFileSync(cached, JSON.stringify(out))
  return out
}

/** A photo's focus: its sidecar's, or the faces found in it, the people
 * with no face found, or else its detail. */
export async function focus(name: string): Promise<Focus[]> {
  const meta = JSON.parse(readFileSync(file(name, 'json'), 'utf8')) as { focus?: Focus[] }
  if (meta.focus?.length) {
    return meta.focus
  }
  const all = await found(name)
  const faces = all.filter((f) => f.kind === 'face')
  const people = all.filter((f) => f.kind === 'person')
  if (faces.length || people.length) {
    return [...faces, ...people].map(({ x, y, r }) => ({ x, y, r }))
  }
  return all.filter((f) => f.kind === 'detail').map(({ x, y, r }) => ({ x, y, r }))
}

/** A photo's focus in a figure's box, w by h, that the photo covers as the
 * figure lays it, centred and cut to fill; a region cut off is left out. */
export async function focusIn(name: string, w: number, h: number): Promise<BoxFocus[]> {
  const [r, regions] = await Promise.all([ratio(name), focus(name)])
  const tall = Math.max(h, w / r)
  const [pw, ox, oy] = [tall * r, (w - tall * r) / 2, (h - tall) / 2]
  return regions
    .map((f) => ({ x: ox + f.x * pw, y: oy + f.y * tall, r: f.r * pw }))
    .filter((f) => f.x > 0 && f.x < w && f.y > 0 && f.y < h)
}

// The photo is read 1024 wide, as the detectors' own inputs are smaller
const READ = 1024

type Human = {
  load: () => Promise<void>
  detect: (input: unknown) => Promise<{ face: { box: number[]; score: number }[]; object: { box: number[]; score: number; label: string }[] }>
  tf: { tensor4d: (data: Int32Array, shape: number[], dtype: string) => { dispose: () => void } }
}

let human: Promise<Human> | undefined
// one photo at a time through the detectors
let queue: Promise<unknown> = Promise.resolve()

/** The faces and people Human finds in a photo. */
async function detect(name: string): Promise<Found[]> {
  human ??= load()
  const run = queue.then(async () => {
    const model = await human!
    const { data, info } = await sharp(readFileSync(file(name, 'jpg'))).resize({ width: READ }).removeAlpha().raw().toBuffer({ resolveWithObject: true })
    const { width: w, height: h } = info
    const input = model.tf.tensor4d(Int32Array.from(data), [1, h, w, 3], 'int32')
    try {
      const result = await model.detect(input)
      // a face's box, x y w h in pixels, as the circle round the face in
      // it: the detector's box is half as tall again as the face
      const circle = ([x, y, bw, bh]: number[], score: number, kind: Found['kind']) => ({ kind, score, x: (x + bw / 2) / w, y: (y + bh / 2) / h, r: (Math.max(bw, bh) * 0.38) / w })
      const faces = result.face.filter((f) => f.score >= FACE).map((f) => circle(f.box, f.score, 'face'))
      // a person's head, the top of their box, unless a face was found in it
      const people = result.object
        .filter((o) => o.label === 'person' && o.score >= PERSON)
        .map((o) => {
          const [x, y, bw, bh] = o.box
          const r = Math.min(bw, bh) * 0.35
          return { kind: 'person' as const, score: o.score, x: (x + bw / 2) / w, y: (y + Math.min(bh * 0.2, r * 1.2)) / h, r: r / w, box: o.box }
        })
        .filter((p) => !faces.some((f) => within(f, p.box, w, h)))
        .map(({ box: _, ...p }) => p)
      return [...faces, ...people]
    } finally {
      input.dispose()
    }
  })
  queue = run.catch(() => undefined)
  return run
}

/** Whether a face's centre lies within a box in pixels. */
function within(f: Focus, [x, y, bw, bh]: number[], w: number, h: number) {
  return f.x * w >= x && f.x * w <= x + bw && f.y * h >= y && f.y * h <= y + bh
}

/** Human on TensorFlow's WASM backend, its face and object detectors, their
 * weights read from its package. */
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
    hand: { enabled: false },
    object: { enabled: true, minConfidence: PERSON, maxDetected: 30 },
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
 * two thirds of the peak. */
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
    out.push({ kind: 'detail', score: v, x: (i + 0.5) / w, y: (j + 0.5) / h, r: Math.max(reach, 2) / w })
  }
  return out
}
