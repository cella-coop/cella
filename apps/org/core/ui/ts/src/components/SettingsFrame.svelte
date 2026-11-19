<script lang="ts">
  import type { Component, Snippet } from 'svelte'
  import type { DrawerPanel, Prop } from '../models/view.ts'
  import { Info, Scales } from '../icons.ts'
  import Centred from './Centred.svelte'
  import Frame from './PageFrame.svelte'
  import Properties from './Properties.svelte'

  // A settings page, laid out as a record's (`Detail.svelte`): its block
  // in the one centred column, and in the drawer's Details what the page
  // holds that cannot be changed there, read-only as a record's
  // properties are; a page holding none has no Details. While changes
  // wait to be proposed, the drawer holds them too (`gathered`).
  let {
    title,
    icon,
    caption,
    properties = [],
    gathered,
    children,
  }: {
    title: string
    icon?: Component<any>
    caption?: string
    properties?: Prop[]
    gathered?: Snippet
    children: Snippet
  } = $props()

  const panels = $derived<DrawerPanel[]>([
    ...(properties.length ? [{ id: 'details', label: 'Details', icon: Info, body: details }] : []),
    ...(gathered ? [{ id: 'basket', label: 'Changes to propose', icon: Scales, body: gathered }] : []),
  ])
</script>

{#snippet details()}
  <Properties items={properties} />
{/snippet}

<Frame {title} {icon} {caption} {panels}>
  <Centred>{@render children()}</Centred>
</Frame>
