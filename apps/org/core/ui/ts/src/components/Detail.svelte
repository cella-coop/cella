<script lang="ts">
  import type { Snippet } from 'svelte'
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import Info from 'phosphor-svelte/lib/Info'
  import type { Event, Link, Prop, Tab } from '../models/view.ts'
  import { typing } from '../models/keys.ts'
  import { abandon } from '../models/navigation.ts'
  import Activity from './Activity.svelte'
  import Frame from './PageFrame.svelte'
  import Pill from './Pill.svelte'
  import Properties from './Properties.svelte'
  import Prose from './Prose.svelte'
  import Related from './Related.svelte'

  // The one record page, as Linear's issue page: in the content, the
  // record's title, large, its own words where it holds them as text,
  // its free-form content, and under a hairline its Activity, oldest
  // first, with the box that adds a comment where
  // its kind takes comments; in the drawer's Details panel, its
  // properties and Related on the drawer itself, nothing boxed. The
  // header names the record by its kind and reference, a crumb under its
  // collection, since the content holds its title.
  let {
    eyebrow,
    title,
    subtitle,
    summary,
    back,
    tabs = [],
    tab,
    properties = [],
    related = [],
    activity = [],
    actions,
    comment,
    children,
  }: {
    eyebrow: string
    title: string
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
    related?: Link[]
    activity?: Event[]
    actions?: Snippet
    // The box that adds a comment, under the Activity.
    comment?: Snippet
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
  {#if properties.length}
    <Properties items={properties} />
  {/if}
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
  <h1 class="record">{title}</h1>
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
    font-size: var(--text-2xl);
    padding-inline: var(--inset);
    overflow-wrap: anywhere;
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
    gap: var(--space-2);
  }
  .related:not(:first-child) {
    padding-top: var(--space-4);
    border-top: 1px solid var(--line);
  }
</style>
