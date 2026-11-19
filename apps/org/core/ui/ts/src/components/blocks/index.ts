// The presentational block components a body draws, styled wholly by
// `Blocks`: structure and classes, no editing behaviour, which core
// body (or any slice keeping a body) attaches, binding each one's text
// and controls to its own state. Namespaced here since `Heading`,
// among them, would otherwise collide with the panel's own.
export { default as Paragraph } from './Paragraph.svelte'
export { default as Heading } from './Heading.svelte'
export { default as Quote } from './Quote.svelte'
export { default as List } from './List.svelte'
export { default as Item } from './Item.svelte'
export { default as Todo } from './Todo.svelte'
export { default as Code } from './Code.svelte'
export { default as Divider } from './Divider.svelte'
export { default as Embed } from './Embed.svelte'
