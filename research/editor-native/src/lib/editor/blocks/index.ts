import type { Component } from 'svelte'
import type { Kind } from '../../model/doc.ts'
import type { View } from '../../hooks/EditorState.svelte.ts'
import Paragraph from './Paragraph.svelte'
import Heading from './Heading.svelte'
import Bullet from './Bullet.svelte'
import Numbered from './Numbered.svelte'
import Todo from './Todo.svelte'
import Quote from './Quote.svelte'
import Code from './Code.svelte'
import Divider from './Divider.svelte'
import Decision from './Decision.svelte'

// One component per kind of block.
export const blocks: Record<Kind, Component<{ view: View }>> = {
  paragraph: Paragraph,
  heading: Heading,
  bullet: Bullet,
  numbered: Numbered,
  todo: Todo,
  quote: Quote,
  code: Code,
  divider: Divider,
  decision: Decision,
}
