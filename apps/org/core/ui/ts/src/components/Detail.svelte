<script lang="ts">
  import type { Snippet } from 'svelte'
  import { goto } from '$app/navigation'
  import Info from 'phosphor-svelte/lib/Info'
  import type { Event, Link, Prop } from '../models/view.ts'
  import { typing } from '../models/keys.ts'
  import Activity from './Activity.svelte'
  import Card from './Card.svelte'
  import Frame from './PageFrame.svelte'
  import Properties from './Properties.svelte'
  import Related from './Related.svelte'

  // The one detail view: the item's blocks in the content, and the drawer's
  // one panel, Details, its cards stacked as Linear stacks an issue's:
  // Properties, Related and Activity, whatever the item's kind.
  let {
    eyebrow,
    title,
    subtitle,
    back,
    properties = [],
    related = [],
    activity = [],
    actions,
    children,
  }: {
    eyebrow: string
    title: string
    subtitle?: string
    back: { href: string; label: string }
    properties?: Prop[]
    related?: Link[]
    activity?: Event[]
    actions?: Snippet
    children?: Snippet
  } = $props()

  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && !e.defaultPrevented && !typing(e) && !document.querySelector('dialog[open]')) {
      goto(back.href)
    }
  }
</script>

<svelte:window {onkeydown} />

{#snippet details()}
  {#if properties.length}
    <Card title="Properties"><Properties items={properties} /></Card>
  {/if}
  {#if related.length}
    <Card title="Related" count={related.length}><Related items={related} /></Card>
  {/if}
  {#if activity.length}
    <Card title="Activity" count={activity.length}><Activity items={activity} /></Card>
  {/if}
{/snippet}

<Frame
  {title}
  caption={eyebrow}
  {back}
  {actions}
  {subtitle}
  panels={[{ id: 'details', label: 'Details', icon: Info, body: details }]}
>
  {@render children?.()}
</Frame>
