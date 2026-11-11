import type { Component } from 'svelte'
import type { Kind } from '../../models/blocks.ts'
import type { View } from '../../hooks/EditorState.svelte.ts'
import Paragraph from './Paragraph.svelte'
import Heading from './Heading.svelte'
import Item from './Item.svelte'
import Quote from './Quote.svelte'
import Code from './Code.svelte'
import Divider from './Divider.svelte'
import Embed from './Embed.svelte'

// One component per kind of block.
export const bodies: Record<Kind, Component<{ view: View }>> = {
  paragraph: Paragraph,
  heading: Heading,
  bullet: Item,
  numbered: Item,
  todo: Item,
  quote: Quote,
  code: Code,
  divider: Divider,
  embed: Embed,
}
