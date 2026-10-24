import { LoroDoc, LoroText, type LoroMap, type LoroTree, type LoroTreeNode, type TreeID } from 'loro-crdt'

export type { TreeID }

export const kinds = ['paragraph', 'heading', 'bullet', 'numbered', 'todo', 'quote', 'code', 'divider', 'decision'] as const
export type Kind = (typeof kinds)[number]

// Atomic blocks carry no editable text: they are selected and moved whole.
export const atomic: ReadonlySet<Kind> = new Set(['divider', 'decision'])

// The props each kind keeps; a kind change drops the rest.
export const propsOf: Record<Kind, readonly string[]> = {
  paragraph: [],
  heading: ['level'],
  bullet: [],
  numbered: [],
  todo: ['checked'],
  quote: [],
  code: ['language'],
  divider: [],
  decision: ['decision'],
}

export type Props = { level?: number; checked?: boolean; language?: string; decision?: string }

export const marks = ['bold', 'italic', 'code', 'link'] as const
export type Mark = (typeof marks)[number]
export type Marks = Partial<Record<Mark, true | string>>

export type Data = Record<string, unknown>
export type Node = LoroTreeNode<Data>

// A document: one tree of blocks. Every doc configures the same mark
// expansion, since Loro keeps it per doc and not in the history: typing at
// the end of bold text stays bold; typing at the end of a link does not.
export function createDoc(peer?: number | bigint): LoroDoc {
  const doc = new LoroDoc()
  if (peer !== undefined) {
    doc.setPeerId(peer)
  }
  doc.configTextStyle({
    bold: { expand: 'after' },
    italic: { expand: 'after' },
    code: { expand: 'after' },
    link: { expand: 'none' },
  })
  return doc
}

export function tree(doc: LoroDoc): LoroTree<Data> {
  return doc.getTree('blocks') as LoroTree<Data>
}

export function node(doc: LoroDoc, id: TreeID): Node {
  const n = tree(doc).getNodeByID(id)
  if (!n || tree(doc).isNodeDeleted(id)) {
    throw new Error(`no block ${id}`)
  }
  return n
}

export function exists(doc: LoroDoc, id: TreeID): boolean {
  const t = tree(doc)
  return t.has(id) && !t.isNodeDeleted(id)
}

export function kind(doc: LoroDoc, id: TreeID): Kind {
  return (node(doc, id).data.get('type') as Kind) ?? 'paragraph'
}

export function props(doc: LoroDoc, id: TreeID): Props {
  const data = node(doc, id).data
  const out: Props = {}
  for (const key of propsOf[kind(doc, id)]) {
    const v = data.get(key)
    if (v !== undefined) {
      ;(out as Data)[key] = v
    }
  }
  return out
}

// Every block holds a text, atomic ones too, so that turning a divider back
// into a paragraph never races two peers creating the text concurrently.
export function text(doc: LoroDoc, id: TreeID): LoroText {
  return node(doc, id).data.get('text') as LoroText
}

export function init(n: Node, k: Kind, p: Props = {}): LoroText {
  n.data.set('type', k)
  for (const key of propsOf[k]) {
    const v = (p as Data)[key]
    if (v !== undefined) {
      n.data.set(key, v as never)
    }
  }
  return (n.data as LoroMap<Data>).setContainer('text', new LoroText())
}

export function parentOf(doc: LoroDoc, id: TreeID): TreeID | undefined {
  return node(doc, id).parent()?.id
}

export function childrenOf(doc: LoroDoc, id: TreeID | undefined): Node[] {
  if (id === undefined) {
    return tree(doc).roots()
  }
  return node(doc, id).children() ?? []
}

export function indexOf(doc: LoroDoc, id: TreeID): number {
  return node(doc, id).index() ?? 0
}

export type Row = { id: TreeID; depth: number; parent: TreeID | undefined }

// The blocks in reading order, depth-first.
export function order(doc: LoroDoc): Row[] {
  const out: Row[] = []
  const walk = (nodes: Node[], depth: number, parent: TreeID | undefined) => {
    for (const n of nodes) {
      out.push({ id: n.id, depth, parent })
      walk(n.children() ?? [], depth + 1, n.id)
    }
  }
  walk(tree(doc).roots(), 0, undefined)
  return out
}

// The ids of a block and every block below it.
export function subtree(doc: LoroDoc, id: TreeID): TreeID[] {
  const out: TreeID[] = [id]
  for (const c of node(doc, id).children() ?? []) {
    out.push(...subtree(doc, c.id))
  }
  return out
}
