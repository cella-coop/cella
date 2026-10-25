// The retention class of the personal data a file holds, `none` for the
// co-op's own: receipts, employment records such as contracts, and
// members' records.
export const classes = ['none', 'expense-receipt', 'payroll', 'profile'] as const
export type Class = (typeof classes)[number]

// The part of the file table each class keeps its files in, which names
// its personal columns in `cella.personal`.
export const parts: Record<Class, string> = { none: 'shared', 'expense-receipt': 'receipt', payroll: 'contract', profile: 'record' }

// What each class is, in words.
export const kinds: Record<Class, string> = { none: 'the co-op’s', 'expense-receipt': 'receipt', payroll: 'employment record', profile: 'personal record' }

// The most a file may hold, as `file.largest()` says: 10 MiB.
export const largest = 10 * 1024 * 1024

// A file the co-op keeps, without its bytes: `hash` is their BLAKE3 in
// hex, null once erased.
export interface File {
  id: string
  class: Class
  subject: string | null
  name: string
  type: string
  size: number
  hash: string | null
  uploader: string
  uploaded: string
}

// A file as the collection lists it: its class in words, as its chip
// shows it, and its retention class.
export interface Listed extends Omit<File, 'class'> {
  class: string
  retention: Class
}

// A file to store, as a form uploads it, of a class and about a subject;
// the co-op's own name no subject.
export interface Store {
  class: Class
  subject: string | null
  name: string
  type: string
  bytes: Uint8Array
}

// What storing it came to: the file and its BLAKE3, in hex.
export interface Stored {
  file: string
  class: Class
  subject: string | null
  type: string
  size: number
  hash: string
}

// A size in words: bytes, KiB or MiB.
export const sized = (n: number) => (n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${Math.round(n / 1024)} KiB` : `${(n / 1024 / 1024).toFixed(1)} MiB`)
