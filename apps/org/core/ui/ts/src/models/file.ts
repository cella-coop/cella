// A file to upload as plain data: whether a field's `accept` takes it, as
// the browser's own picker reads it (a media type, a family of them such
// as image/*, or an extension such as .csv), and its size as a reader
// reads it. Drawn by `FilePicker`.

export interface Picked {
  name: string
  type: string
  size: number
}

// Whether `accept` takes the file: every file where it is empty.
export function accepts(accept: string | undefined, file: Picked): boolean {
  const kinds = (accept ?? '')
    .split(',')
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean)
  if (!kinds.length) {
    return true
  }
  const name = file.name.toLowerCase()
  const type = file.type.toLowerCase()
  return kinds.some((k) => (k.startsWith('.') ? name.endsWith(k) : k.endsWith('/*') ? type.startsWith(k.slice(0, -1)) : type === k))
}

// What `accept` offers, as a refusal names it: .csv, .txt, image/*.
export const offered = (accept: string | undefined) =>
  (accept ?? '')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean)
    .join(', ')

// A size in bytes as a reader reads it: 812 bytes, 24 KB, 1.2 MB. The
// format itself lives in `models/format.ts`, the kit's one place a
// figure is formatted; kept under its own name here, what a file picker
// reads.
export { bytes as sized } from './format.ts'
