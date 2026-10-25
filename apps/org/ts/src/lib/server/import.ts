import { done as made, importing, type Action, type Deps, type Done, type Importer, type Line } from '@cella/org-db'
import { record } from '@cella/org-import/api'
import type { Kind } from '@cella/org-import/models'
import { slices } from './slices.ts'

// Importing a file from another tool, across the slices: each slice reads
// the kinds of file whose records are its writes, and the root runs them
// as the importing member and records the run in the import feat. The
// Imports page and `cella import` both run it here.

// Every kind of file a slice imports, by its name.
export const kinds = (): (Kind & { importer: Importer })[] =>
  slices.flatMap((s) => Object.entries(s.imports ?? {}).map(([kind, importer]) => ({ kind, title: importer.title, formats: importer.formats, importer })))

// A file's text: UTF-8, or else Windows-1252, which older tools and many
// FEC exports write.
export function decoded(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return new TextDecoder('windows-1252').decode(bytes)
  }
}

// Reads a file of a kind, runs its records as writes, or tries them in a
// dry run, and records what each line came to.
export async function imported(deps: Deps, kind: string, name: string, bytes: Uint8Array, dry: boolean): Promise<{ lines: Line[]; done: Done }> {
  const known = kinds()
  const k = known.find((k) => k.kind === kind)
  if (!k) {
    throw new Error(`there is no import of ${kind || 'no kind'}; there are ${known.map((k) => k.kind).join(', ')}`)
  }
  const records = await k.importer.read(decoded(bytes), deps.db)
  if (!records.length) {
    throw new Error(`${name} holds nothing to import`)
  }
  const lines = await importing(records, deps, dry)
  const outcome = await record(
    {
      kind,
      name,
      dry,
      lines: lines.map((l) => ({ line: l.line, label: l.label, op: l.done.op, state: l.done.state, entry: l.done.entry, reason: l.done.reason })),
    },
    deps,
  )
  return { lines, done: made('import:run:record', outcome) }
}

// The Imports page's New form: a file of a kind, as a dry run or not.
export const run: Action = {
  op: 'import:run:record',
  run: async (form, deps) => {
    const file = form.file('file')
    if (!file) {
      throw new Error('choose a file to import')
    }
    const kind = form.get('kind')
    const dry = form.get('mode') !== 'import'
    const { done } = await imported(deps, kind, file.name, file.bytes, dry)
    return { request: { kind, name: file.name, dry }, done }
  },
}
