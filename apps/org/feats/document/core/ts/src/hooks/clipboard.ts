import { atomic, indexOf, kind, parentOf, text } from '../models/blocks.ts'
import * as ops from '../models/edits.ts'
import type { EditorState } from './EditorState.svelte.ts'

const blocksType = 'application/x-cella-blocks'
const runsType = 'application/x-cella-runs'

// The clipboard: chosen blocks travel as fragments, a range of text as
// runs, and both as plain text for the world outside.
export class Clipboard {
  readonly #ed: EditorState

  constructor(ed: EditorState) {
    this.#ed = ed
  }

  copy(e: ClipboardEvent, cut: boolean): void {
    const ed = this.#ed
    const data = e.clipboardData
    if (!data) {
      return
    }
    if (ed.chosen.range) {
      e.preventDefault()
      const fs = ed.chosen.roots().map((id) => ops.fragment(ed.doc, id))
      data.setData(blocksType, JSON.stringify(fs))
      data.setData('text/plain', plain(fs, 0))
      if (cut) {
        ed.chosen.delete()
      }
      return
    }
    const s = ed.sel()
    if (!s || s.collapsed) {
      return
    }
    e.preventDefault()
    const t = text(ed.doc, s.id)
    data.setData(runsType, JSON.stringify(ops.runs(t, s.start, s.end)))
    data.setData('text/plain', t.toString().slice(s.start, s.end))
    if (cut) {
      ed.apply(() => {
        ops.remove(t, s.start, s.end - s.start)
        return { id: s.id, anchor: s.start, focus: s.start }
      })
    }
  }

  paste(e: ClipboardEvent): void {
    const ed = this.#ed
    const data = e.clipboardData
    if (!data) {
      return
    }
    e.preventDefault()
    const blocks = data.getData(blocksType)
    const s = ed.sel()
    const anchorId = s?.id ?? ed.chosen.roots().at(-1)
    if (!anchorId) {
      return
    }
    if (blocks) {
      const fs = JSON.parse(blocks) as ops.Fragment[]
      ed.apply(() => {
        const empty = s && kind(ed.doc, s.id) === 'paragraph' && text(ed.doc, s.id).length === 0
        const ids = ops.paste(ed.doc, parentOf(ed.doc, anchorId), indexOf(ed.doc, anchorId) + 1, fs)
        if (empty) {
          ops.drop(ed.doc, anchorId)
        }
        const last = [...ids].reverse().find((id) => !atomic.has(kind(ed.doc, id)))
        if (last) {
          const l = text(ed.doc, last).length
          return { id: last, anchor: l, focus: l }
        }
      })
      return
    }
    if (!s) {
      return
    }
    const runsJson = data.getData(runsType)
    const t = text(ed.doc, s.id)
    if (runsJson) {
      const rs = JSON.parse(runsJson) as ops.Run[]
      ed.apply(() => {
        ops.remove(t, s.start, s.end - s.start)
        const n = ops.insertRuns(t, s.start, rs)
        return { id: s.id, anchor: s.start + n, focus: s.start + n }
      })
      return
    }
    const str = data.getData('text/plain').replaceAll('\r\n', '\n')
    const lines = kind(ed.doc, s.id) === 'code' ? [str] : str.split('\n')
    ed.apply(() => {
      ops.remove(t, s.start, s.end - s.start)
      if (lines.length === 1) {
        ops.insert(t, s.start, lines[0])
        return { id: s.id, anchor: s.start + lines[0].length, focus: s.start + lines[0].length }
      }
      const tail = ops.runs(t, s.start)
      ops.remove(t, s.start, t.length - s.start)
      ops.insert(t, s.start, lines[0], {})
      let prev = s.id
      for (const l of lines.slice(1)) {
        prev = ops.after(ed.doc, prev, 'paragraph', {}, [{ text: l }])
      }
      const lt = text(ed.doc, prev)
      const at = lt.length
      ops.insertRuns(lt, at, tail)
      return { id: prev, anchor: at, focus: at }
    })
  }
}

function plain(fs: ops.Fragment[], depth: number): string {
  return fs
    .map((f) => {
      const t = f.runs.map((r) => r.text).join('')
      const line = `${'  '.repeat(depth)}${f.type === 'divider' ? '---' : f.type === 'embed' ? `[${f.embed} ${f.ref}]` : t}`
      return f.children.length ? `${line}\n${plain(f.children, depth + 1)}` : line
    })
    .join('\n')
}
