import { Block, extension, type Nabu } from '@aionbuilders/nabu'
import DecisionCard from './Decision.svelte'

// A decision embedded in a document: an atomic block that holds only the
// decision's id. Like nabu's divider it has no text and one cursor
// position, so offsets step over it, and it is contenteditable=false, so
// the caret never enters it; it moves with the drag handle like any block.
// @ts-expect-error: nabu types `create` on the base class with its own `this`.
export class DecisionBlock extends Block {
  ref = $state('')

  constructor(nabu: Nabu, node: any) {
    super(nabu, node)
    this.ref = String(node.data.get('ref') ?? '')
    node.data.subscribe(() => {
      this.ref = String(node.data.get('ref') ?? '')
    })
    this.serializers.set('markdown', () => `[[decision:${this.ref}]]`)
    this.serializers.set('json', () => ({ id: this.id, type: 'decision', props: { ref: this.ref } }))
    this.serializers.set('application/x-nabu+json', () => ({ type: 'decision', partial: false, props: { ref: this.ref } }))
  }

  override positions = $derived(1)

  override getDOMPoint() {
    return null
  }

  override beforeinput() {
    return false
  }

  static toMarkdown(pb: any) {
    return `[[decision:${pb.props?.ref ?? ''}]]`
  }

  static toHtml(pb: any) {
    return `<p>Decision ${pb.props?.ref ?? ''}</p>`
  }

  static override create(nabu: Nabu, _type: string, props: any = {}, parentId: string | null = null, index: number | null = null) {
    // nabu's own create() passes `index || undefined`, which turns index 0
    // into "append"; pass it through as given.
    const node = (nabu.tree as any).createNode(parentId ?? undefined, index ?? undefined)
    node.data.set('type', 'decision')
    node.data.set('ref', String(props.ref ?? ''))
    return new DecisionBlock(nabu, node)
  }
}

// Insert a decision after the block holding the caret.
export function insertDecision(nabu: Nabu, ref: string) {
  const anchor = nabu.selection.anchorBlock as any
  const parentId = anchor?.node.parent()?.id.toString() ?? null
  const index = anchor ? (anchor.node.index() ?? 0) + 1 : nabu.children.length
  const block = DecisionBlock.create(nabu, 'decision', { ref }, parentId, index)
  return nabu.commit().then(() => block)
}

export const DecisionExtension = extension('decision', {
  block: DecisionBlock as any,
  component: DecisionCard as any,
  actions: {
    'decision:insert': (nabu, data) => insertDecision(nabu, data?.ref ?? 'd-2026-011'),
  },
})
