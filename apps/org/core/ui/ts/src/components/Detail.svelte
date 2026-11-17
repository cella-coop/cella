<script lang="ts">
  import type { Component, Snippet } from 'svelte'
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import Info from 'phosphor-svelte/lib/Info'
  import type { Event, Link, Prop, Tab } from '../models/view.ts'
  import { typing } from '../models/keys.ts'
  import { abandon } from '../models/navigation.ts'
  import { inked, inkOf } from '../models/ink.ts'
  import Activity from './Activity.svelte'
  import Frame from './PageFrame.svelte'
  import Icon from './Icon.svelte'
  import Pill from './Pill.svelte'
  import Properties from './Properties.svelte'
  import Prose from './Prose.svelte'
  import Related from './Related.svelte'

  // The one record page, as Linear's issue page: in the content, the
  // record's title, large, its own words where it holds them as text,
  // its free-form content, and under a hairline its Activity, oldest
  // first, with the box that adds a comment where
  // its kind takes comments; in the drawer's Details panel, its
  // properties, under the fields its slices set there, and Related on
  // the drawer itself, nothing boxed. The
  // header names the record by its kind and reference, a crumb under its
  // collection, since the content holds its title.
  let {
    eyebrow,
    title,
    icon,
    subtitle,
    summary,
    back,
    tabs = [],
    tab,
    properties = [],
    history = [],
    related = [],
    activity = [],
    actions,
    comment,
    fields,
    children,
  }: {
    eyebrow: string
    title: string
    // The record's own icon where it has one, else its collection's;
    // drawn in the record's own ink before its title. None draws none.
    icon?: Component<any>
    subtitle?: string
    // The record's own words, under its title on the first tab.
    summary?: string | null
    back: { href: string; label: string }
    // The page's tabs, as pills in the header when there are two or more,
    // and the open one, whose blocks the content holds; the first is the
    // record's content, and only it shows the Activity.
    tabs?: Tab[]
    tab?: string
    properties?: Prop[]
    // The log's four, Created, Updated and by whom, where a crowded page
    // keeps them out of its properties: its own History, at the foot.
    history?: Prop[]
    related?: Link[]
    activity?: Event[]
    actions?: Snippet
    // The box that adds a comment, under the Activity.
    comment?: Snippet
    // What the record's slices set in the Details, over its properties.
    fields?: Snippet
    children?: Snippet
  } = $props()

  const id = $props.id()
  const first = $derived(!tab || tab === tabs[0]?.id)

  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && !e.defaultPrevented && !typing(e) && !document.querySelector('dialog[open]')) {
      goto(back.href).catch(abandon)
    }
  }
</script>

<svelte:window {onkeydown} />

{#snippet details()}
  {@render fields?.()}
  <Properties items={[...properties, ...history]} />
  {#if related.length}
    <section class="related" aria-labelledby="{id}-related">
      <h2 id="{id}-related">Related<span class="count">{related.length}</span></h2>
      <Related items={related} />
    </section>
  {/if}
{/snippet}

<Frame
  title={subtitle ?? eyebrow}
  caption={eyebrow}
  heading={false}
  {back}
  {actions}
  panels={[{ id: 'details', label: 'Details', icon: Info, body: details }]}
>
  {#snippet bar()}
    {#if tabs.length > 1}
      <nav class="tabs" aria-label="{eyebrow} tabs">
        {#each tabs as t, i (t.id)}
          <Pill href={i === 0 ? page.url.pathname : `${page.url.pathname}?tab=${t.id}`} on={t.id === tab}>{t.label}</Pill>
        {/each}
      </nav>
    {/if}
  {/snippet}
  <h1 class="record">
    {#if icon}<span class="mark" style={inked(inkOf(title))}><Icon {icon} /></span>{/if}
    {title}
  </h1>
  {#if first && summary}<Prose text={summary} />{/if}
  {@render children?.()}
  {#if first && (activity.length || comment)}
    <section class="activity" aria-labelledby="{id}-activity">
      <h2 id="{id}-activity">Activity</h2>
      <Activity items={activity} />
      {@render comment?.()}
    </section>
  {/if}
</Frame>

<style>
  .tabs {
    display: flex;
    gap: var(--space-1);
  }
  .record {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--text-2xl);
    padding-inline: var(--inset);
    overflow-wrap: anywhere;
  }
  .mark {
    display: inline-flex;
    flex: none;
    color: var(--mark);
  }
  /* The Activity under a hairline, its heading quiet. */
  .activity {
    display: grid;
    gap: var(--space-3);
    margin-top: var(--space-2);
    padding: var(--space-4) var(--inset) 0;
    border-top: 1px solid var(--line);
  }
  h2 {
    font-family: var(--font-ui);
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--text-muted);
    letter-spacing: normal;
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
  }
  .count {
    color: var(--text-subtle);
    font-weight: 400;
    font-variant-numeric: tabular-nums;
  }
  .related {
    display: grid;
    gap: var(--space-1);
    margin-top: var(--space-3);
    padding-inline: var(--inset, 0);
  }
  .related:first-child {
    margin-top: 0;
  }
</style>
