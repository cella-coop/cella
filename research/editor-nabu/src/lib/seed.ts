import { LoroDoc, LoroText, type LoroTreeNode } from 'loro-crdt'

// The 2027 rate card (fixture rate-card-2027@2) in nabu's own shape: a
// LoroTree named "blocks" whose node maps hold a type, a LoroText and
// props, with lists as list > list-item wrappers. nabu has no table block,
// so the table's rows become a bulleted list.

type Delta = { insert: string; attributes?: Record<string, unknown> }[]

export type Seed =
  | { type: 'paragraph' | 'blockquote' | 'code'; delta: Delta }
  | { type: 'heading'; level: number; delta: Delta }
  | { type: 'divider' }
  | { type: 'decision'; ref: string }
  | { type: 'list'; listType: 'bullet' | 'ordered' | 'todo'; items: Item[] }

export type Item = { delta: Delta; checked?: boolean; sublist?: Extract<Seed, { type: 'list' }> }

const t = (insert: string, attributes?: Record<string, unknown>) => (attributes ? { insert, attributes } : { insert })

export const styles = {
  bold: { expand: 'none' },
  italic: { expand: 'none' },
  underline: { expand: 'none' },
  code: { expand: 'none' },
  strikethrough: { expand: 'none' },
  link: { expand: 'none' },
} as const

export const rateCard: Seed[] = [
  { type: 'heading', level: 1, delta: [t('Rate card 2027')] },
  {
    type: 'paragraph',
    delta: [
      t('Prices are per unit, before VAT. Associations and co-ops with fewer than ten staff pay the '),
      t('solidarity rate', { italic: true }),
      t('; see the '),
      t('règlement intérieur', { link: 'https://lanterne.example/documents/internal-rules' }),
      t('.'),
    ],
  },
  { type: 'heading', level: 2, delta: [t('Services')] },
  {
    type: 'list',
    listType: 'bullet',
    items: [
      { delta: [t('Day of work, per day: '), t('560 €', { bold: true }), t(' standard, '), t('380 €', { bold: true }), t(' solidarity')] },
      { delta: [t('Brand identity, per project: from '), t('6 500 €', { bold: true }), t(' / from 3 300 €')] },
      { delta: [t('Website, per project: from '), t('12 000 €', { bold: true }), t(' / from 7 500 €')] },
      {
        delta: [t('Online shop, per project: from '), t('9 500 €', { bold: true }), t(' / from 6 000 €')],
        sublist: { type: 'list', listType: 'bullet', items: [{ delta: [t('New in version 2')] }] },
      },
      { delta: [t('Marketing retainer, per month: from '), t('4 800 €', { bold: true }), t(' / from 2 400 €')] },
    ],
  },
  { type: 'decision', ref: 'd-2026-011' },
  { type: 'blockquote', delta: [t('Nuvola renews in January at the current rate; do we hold it for existing retainers? — Malik')] },
  {
    type: 'list',
    listType: 'todo',
    items: [
      { delta: [t('Answer Malik on existing retainers')], checked: false },
      { delta: [t('Publish once '), t('d-2026-011', { code: true }), t(' passes')], checked: false },
    ],
  },
  { type: 'divider' },
  { type: 'code', delta: [t('standard = 560\nsolidarity = 380')] },
]

type Node = LoroTreeNode<Record<string, unknown>>

function text(node: Node, delta: Delta) {
  const container = node.data.setContainer('text', new LoroText())
  container.applyDelta(delta as never)
}

function write(doc: LoroDoc, seed: Seed, parent?: Node) {
  const tree = doc.getTree('blocks')
  const node = tree.createNode(parent?.id) as Node
  node.data.set('type', seed.type)
  switch (seed.type) {
    case 'heading':
      node.data.set('level', seed.level)
      text(node, seed.delta)
      break
    case 'paragraph':
    case 'blockquote':
    case 'code':
      text(node, seed.delta)
      break
    case 'decision':
      node.data.set('ref', seed.ref)
      break
    case 'list':
      node.data.set('listType', seed.listType)
      for (const item of seed.items) {
        const li = tree.createNode(node.id) as Node
        li.data.set('type', 'list-item')
        text(li, item.delta)
        if (item.checked !== undefined) {
          li.data.set('checked', item.checked)
        }
        if (item.sublist) {
          write(doc, item.sublist, li)
        }
      }
      break
  }
}

export function seed(blocks: Seed[] = rateCard): Uint8Array {
  const doc = new LoroDoc()
  doc.setPeerId(1n)
  doc.configTextStyle(styles as never)
  for (const b of blocks) {
    write(doc, b)
  }
  doc.commit()
  return doc.export({ mode: 'snapshot' })
}
