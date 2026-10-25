import type { Outcome } from '@cella/org-ops'
import { personal, write, type Db, type Deps, type Write } from '@cella/org-db'
import type { ops } from '../models/ops.ts'
import { largest, parts, type Store, type Stored } from '../models/file.ts'

const op = 'file:file:upload' satisfies keyof typeof ops

// What a member signs of a file: what it is, and its bytes in base64, so
// that their signature covers the content itself.
export const request = (input: Store) => ({
  class: input.class,
  subject: input.subject,
  name: input.name,
  type: input.type,
  bytes: Buffer.from(input.bytes).toString('base64'),
})

// Stores a file inside a write's transaction, uploaded by the actor on the
// verdict date; the database names its bytes by their BLAKE3. Each graft
// that attaches a file stores it so, in its own write.
export async function storing(tx: Db, input: Store, actor: string): Promise<Stored> {
  if (input.bytes.length > largest) {
    throw new Error(`${input.name} holds ${(input.bytes.length / 1024 / 1024).toFixed(1)} MiB; a file holds at most 10 MiB`)
  }
  const { rows } = await tx.query<{ id: string; hash: string }>(
    `INSERT INTO file.file (class, subject, name, type, size, bytes, uploader, uploaded)
     VALUES ($1, $2, $3, $4, $5, $6, $7, cella.verdict_date())
     RETURNING id, encode(hash, 'hex') AS hash`,
    [input.class, input.subject, input.name, input.type, input.bytes.length, Buffer.from(input.bytes), actor],
  )
  return { file: rows[0].id, class: input.class, subject: input.subject, type: input.type, size: input.bytes.length, hash: rows[0].hash }
}

// What the log commits to of a stored file: of the co-op's own, its name
// and its BLAKE3; of a personal file, commitments to both, which the vault
// opens until the file is erased.
export function committed(stored: Stored, name: string): Record<string, unknown> {
  if (stored.class === 'none' || !stored.subject) {
    return { ...stored, name }
  }
  const part = parts[stored.class]
  return {
    ...stored,
    name: personal(`file.${part}.name`, stored.subject, name),
    hash: personal(`file.${part}.bytes`, stored.subject, stored.hash),
  }
}

// Uploads a file of the co-op's own, which concerns no one. A personal
// file comes in through the graft that attaches it.
export const uploading = (input: Store, actor: string): Write<Stored> => ({
  op,
  request: request(input),
  state: (tx) => storing(tx, { ...input, class: 'none', subject: null }, actor),
  payload: (v) => committed(v, input.name),
})

export async function upload(input: Store, deps: Deps): Promise<Outcome<(typeof ops)[typeof op], Stored>> {
  return write(deps, uploading(input, deps.actor))
}
