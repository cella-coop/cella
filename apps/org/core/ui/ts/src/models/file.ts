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

// A size in bytes as a reader reads it: 812 bytes, 24 KB, 1.2 MB.
export function sized(bytes: number): string {
  if (bytes < 1000) {
    return `${bytes} ${bytes === 1 ? 'byte' : 'bytes'}`
  }
  const units = ['KB', 'MB', 'GB']
  let n = bytes / 1000
  let u = 0
  while (n >= 1000 && u < units.length - 1) {
    n /= 1000
    u++
  }
  return `${n < 10 ? n.toFixed(1).replace(/\.0$/, '') : Math.round(n)} ${units[u]}`
}
